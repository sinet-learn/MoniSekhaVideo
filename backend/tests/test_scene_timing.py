import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch
from pathlib import Path
import numpy as np
import soundfile as sf
from backend.services.scene_timing import validate_scene_duration, write_scene_audio


class SceneTimingTests(unittest.TestCase):
    def test_accepts_long_voiceovers_and_rejects_invalid_durations(self):
        for duration in (10, 12.27, 15.001, 60, 600):
            self.assertEqual(validate_scene_duration(duration), duration)
        for duration in (0, -1, float("nan"), float("inf")):
            with self.assertRaises(ValueError):
                validate_scene_duration(duration)

    def test_rejected_speech_does_not_overwrite_previous_recording(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "scene_001.wav"
            write_scene_audio(str(path), np.ones(1000, dtype="float32"), 1000)
            previous = path.read_bytes()
            with self.assertRaisesRegex(ValueError, "no measurable duration"):
                write_scene_audio(str(path), np.zeros(0, dtype="float32"), 1000)
            self.assertEqual(path.read_bytes(), previous)
            self.assertEqual(sf.info(path).duration, 1)


class GeneratedSpeechDurationTests(unittest.TestCase):
    def test_both_generation_paths_save_long_voiceovers(self):
        from backend.services import voice_engine
        model = Mock()
        model.tts_model = SimpleNamespace(sample_rate=1000)
        def generated(**kwargs):
            count = 20000 if kwargs.get("prompt_wav_path") else 1000
            return np.sin(np.arange(count) * 0.1).astype("float32")
        model.generate.side_effect = generated
        with tempfile.TemporaryDirectory() as root, patch.object(voice_engine, "__file__", str(Path(root) / "backend/services/voice_engine.py")), patch.object(voice_engine, "_MODEL_STATE", "loaded"), patch.object(voice_engine, "_VOXCPM_MODEL", model), patch.object(voice_engine, "VoxCPM", object()), patch.object(voice_engine, "schedule_unload"):
            batch = voice_engine.generate_scene_audio_chunk("Long voice line.", "batch", "(Calm)", 1)
            single = voice_engine.generate_single_scene_audio("Long voice line.", "single", 1)
            for path in (batch, single):
                self.assertTrue(Path(path).is_file())
                self.assertGreater(sf.info(path).duration, 20)
