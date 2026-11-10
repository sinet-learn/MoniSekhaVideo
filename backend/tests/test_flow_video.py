"""Flow calls are mocked; MP4 validation and silent export use real FFmpeg."""
import subprocess
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import imageio_ffmpeg

from backend.services import flow_video, scene_animator

_REAL_RUN = subprocess.run


class FlowVideoTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.media_dir = tempfile.TemporaryDirectory()
        cls.sample = Path(cls.media_dir.name) / "sample.mp4"
        _REAL_RUN([
            imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-v", "error",
            "-f", "lavfi", "-i", "color=c=blue:s=32x32:r=10",
            "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=16000",
            "-t", "0.5", "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-c:a", "aac", str(cls.sample),
        ], check=True, capture_output=True)
        cls.sample_bytes = cls.sample.read_bytes()

    @classmethod
    def tearDownClass(cls):
        cls.media_dir.cleanup()

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        self.image = self.root / "selected-scene.png"
        self.image.write_bytes(b"image supplied to mocked Flow")
        self.output = self.root / "scene_001_video.mp4"
        self.output.write_bytes(b"previous clip")

    def tearDown(self):
        self.directory.cleanup()

    def test_success_uses_selected_image_one_clip_and_atomic_replacement(self):
        def fake_flow(command, **kwargs):
            if "i2v" in command:
                self.assertEqual(command[command.index("--initial-frame") + 1], str(self.image.resolve()))
                self.assertEqual(command[command.index("--count") + 1], "1")
                self.assertEqual(command[-2:], ["--", "-gentle motion"])
                Path(command[command.index("--output") + 1]).write_bytes(self.sample_bytes)
                self.assertEqual(self.output.read_bytes(), b"previous clip")
                return SimpleNamespace(returncode=0, stdout="{}", stderr="")
            return _REAL_RUN(command, **kwargs)
        with patch.object(flow_video.subprocess, "run", side_effect=fake_flow):
            result = flow_video.generate_scene_video(str(self.image), "-gentle motion", str(self.output))
        self.assertEqual(result, str(self.output.resolve()))
        self.assertEqual(self.output.read_bytes(), self.sample_bytes)
        self.assertFalse(list(self.root.glob("_flow_video_*")))

    def test_flow_clip_is_fitted_to_measured_voice_without_keeping_generated_audio(self):
        def fake_flow(command, **kwargs):
            if "i2v" in command:
                self.assertIn("1.35 seconds", command[-1])
                Path(command[command.index("--output") + 1]).write_bytes(self.sample_bytes)
                return SimpleNamespace(returncode=0, stdout="{}", stderr="")
            return _REAL_RUN(command, **kwargs)
        with patch.object(flow_video.subprocess, "run", side_effect=fake_flow):
            flow_video.generate_scene_video(str(self.image), "Gentle motion", str(self.output), duration=1.35)
        _, duration = imageio_ffmpeg.count_frames_and_secs(str(self.output))
        self.assertAlmostEqual(duration, 1.35, delta=1/30)
        probe = _REAL_RUN([imageio_ffmpeg.get_ffmpeg_exe(), "-i", str(self.output)], capture_output=True, text=True)
        self.assertNotIn("Audio:", probe.stderr)

    def test_text_to_video_does_not_require_or_upload_an_image(self):
        def fake_flow(command, **kwargs):
            if "t2v" in command:
                self.assertNotIn("--initial-frame", command)
                Path(command[command.index("--output") + 1]).write_bytes(self.sample_bytes)
                return SimpleNamespace(returncode=0, stdout="{}", stderr="")
            return _REAL_RUN(command, **kwargs)
        self.image.unlink()
        with patch.object(flow_video.subprocess, "run", side_effect=fake_flow):
            flow_video.generate_scene_video(None, "A teacher raises her hand as the camera tracks left.", str(self.output))
        self.assertEqual(self.output.read_bytes(), self.sample_bytes)

    def test_provider_failure_keeps_old_clip_without_retry(self):
        with patch.object(flow_video.subprocess, "run", return_value=SimpleNamespace(returncode=1, stdout="", stderr="Sign in to Flow")) as run:
            with self.assertRaisesRegex(RuntimeError, "Sign in"):
                flow_video.generate_scene_video(str(self.image), "motion", str(self.output))
            self.assertEqual(run.call_count, 1)
        self.assertEqual(self.output.read_bytes(), b"previous clip")

    def test_migration_error_is_readable_even_when_the_old_log_was_truncated(self):
        truncated = 't.context_cookie_seed_unavailable", "error_class": "FlowHostMigratedError", "cli_command": "video i2v", "correlation_id": "private-diagnostic-id"'
        message = flow_video.format_generation_error("", truncated)
        self.assertIn("does not support image-to-video", message)
        self.assertIn("Animated video", message)
        self.assertNotIn("correlation_id", message)
        self.assertNotIn("{", message)

    def test_structured_problem_is_used_instead_of_cookie_warning(self):
        stdout = json.dumps({"error": {"problem": {"type": "https://gflow-cli.dev/errors/insufficient-credits", "title": "Insufficient credits", "detail": "Your Flow account has insufficient credits."}}})
        message = flow_video.format_generation_error(stdout, '{"event":"t.context_cookie_seed_unavailable","level":"warning"}')
        self.assertIn("insufficient credits", message)
        self.assertNotIn("cookie_seed", message)
        self.assertNotIn("problem", message)

    def test_unknown_structured_error_does_not_dump_diagnostics(self):
        message = flow_video.format_generation_error("", '{"level":"error","correlation_id":"diagnostic-id"}')
        self.assertIn("Check your Flow account", message)
        self.assertNotIn("correlation_id", message)

    def test_invalid_mp4_is_rejected_and_old_clip_survives(self):
        def fake_flow(command, **kwargs):
            if "i2v" in command:
                Path(command[command.index("--output") + 1]).write_bytes(b"invalid video" * 1000)
                return SimpleNamespace(returncode=0, stdout="{}", stderr="")
            return _REAL_RUN(command, **kwargs)
        with patch.object(flow_video.subprocess, "run", side_effect=fake_flow):
            with self.assertRaisesRegex(RuntimeError, "invalid video"):
                flow_video.generate_scene_video(str(self.image), "motion", str(self.output))
        self.assertEqual(self.output.read_bytes(), b"previous clip")

    def test_timeout_reports_uncertain_submission_without_retry(self):
        with patch.object(flow_video.subprocess, "run", side_effect=subprocess.TimeoutExpired("gflow", 1200)) as run:
            with self.assertRaisesRegex(RuntimeError, "before retrying"):
                flow_video.generate_scene_video(str(self.image), "motion", str(self.output))
            self.assertEqual(run.call_count, 1)
        self.assertEqual(self.output.read_bytes(), b"previous clip")

    def test_bad_input_is_rejected_before_submitting(self):
        with patch.object(flow_video.subprocess, "run") as run:
            for aspect, prompt in (("1:1", "motion"), ("16:9", "   ")):
                with self.assertRaises(ValueError):
                    flow_video.generate_scene_video(str(self.image), prompt, str(self.output), aspect)
            self.image.unlink()
            with self.assertRaises(ValueError):
                flow_video.generate_scene_video(str(self.image), "motion", str(self.output))
            run.assert_not_called()

    def test_scene_chunk_omits_generated_audio_for_separate_voiceover(self):
        output = self.root / "silent-chunk.mp4"
        with patch.dict(scene_animator.ASPECT_RATIO_DIMENSIONS, {"16:9": (32, 32)}):
            scene_animator.prepare_scene_chunk(str(self.image), str(output), 0.5, custom_video_path=str(self.sample))
        result = _REAL_RUN([imageio_ffmpeg.get_ffmpeg_exe(), "-i", str(output)], capture_output=True, text=True)
        self.assertIn("Video:", result.stderr)
        self.assertNotIn("Audio:", result.stderr)


if __name__ == "__main__":
    unittest.main()
