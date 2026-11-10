"""Animation-first storyboard integration, with isolated SQLite and mocked AI."""
import asyncio
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import imageio_ffmpeg
import numpy as np
import soundfile as sf
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from PIL import Image


class VideoStoryboardTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        # Import-time migrations and default presets must also stay in memory.
        with patch("sqlalchemy.create_engine", return_value=cls.engine):
            from backend import main, database, queue_worker
        from backend.services import render_engine, scene_animator
        cls.api, cls.dbm, cls.worker = main, database, queue_worker
        cls.render_engine, cls.scene_animator = render_engine, scene_animator
        cls.factory = sessionmaker(bind=cls.engine)
        cls.media = tempfile.TemporaryDirectory()
        sample = Path(cls.media.name) / "sample.mp4"
        subprocess.run([
            imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-v", "error", "-f", "lavfi",
            "-i", "color=c=blue:s=128x72:r=10", "-t", "0.5", "-c:v", "libx264",
            "-pix_fmt", "yuv420p", str(sample),
        ], capture_output=True, check=True)
        cls.sample_bytes = sample.read_bytes()

    @classmethod
    def tearDownClass(cls):
        cls.engine.dispose()
        cls.media.cleanup()

    def setUp(self):
        self.dbm.Base.metadata.drop_all(self.engine)
        self.dbm.Base.metadata.create_all(self.engine)
        self.directory = tempfile.TemporaryDirectory()
        self.workspace = Path(self.directory.name) / "workspace"
        self.project_dir = self.workspace / "video-first"
        self.project_dir.mkdir(parents=True)
        Image.new("RGB", (128, 72), "blue").save(self.project_dir / "scene_001.png")
        with self.factory() as db:
            project = self.dbm.Project(title="Video first", slug="video-first", visual_mode="video", aspect_ratio="16:9")
            db.add(project); db.commit()
            self.project_id = project.id
        def isolated_db():
            with self.factory() as db:
                yield db
        self.api.app.dependency_overrides[self.api.get_db] = isolated_db
        self.client = TestClient(self.api.app)
        self.patches = [
            patch.object(self.api, "workspace_dir", str(self.workspace)),
            patch.object(self.dbm, "DB_PATH", str(self.workspace / "studio.db")),
            patch.object(self.worker, "SessionLocal", self.factory),
            patch.object(self.worker, "image_queue", asyncio.Queue()),
            patch.object(self.worker, "__file__", str(Path(self.directory.name) / "backend/queue_worker.py")),
            patch.object(self.worker.voice_engine, "__file__", str(Path(self.directory.name) / "backend/services/voice_engine.py")),
            patch.object(self.render_engine, "WORKSPACE_DIR", str(self.workspace)),
            patch.dict(self.render_engine.ASPECT_RATIO_RESOLUTIONS, {"16:9": (128, 72)}),
            patch.dict(self.scene_animator.ASPECT_RATIO_DIMENSIONS, {"16:9": (128, 72)}),
        ]
        for item in self.patches: item.start()

    def tearDown(self):
        for item in reversed(self.patches): item.stop()
        self.api.app.dependency_overrides.clear()
        self.directory.cleanup()

    def add_voice(self, scene_id, duration=0.5, status="completed"):
        audio = self.project_dir / "scene_001.wav"
        sf.write(str(audio), np.sin(np.arange(int(16000 * duration)) * 0.1).astype("float32"), 16000)
        with self.factory() as db:
            scene = db.get(self.dbm.Scene, scene_id)
            scene.audio_path = "video-first/scene_001.wav"
            scene.audio_status = status
            db.commit()

    def generate_storyboard(self, payload):
        with patch("backend.services.llm.client.generate_text", return_value=json.dumps(payload, ensure_ascii=False)):
            return self.client.post(f"/api/projects/{self.project_id}/auto-generate-scenes", json={"prompt": "Create an animated storyboard", "visual_mode": "video", "mode": "replace"})

    def test_structured_storyboard_prompt_switches_to_video_directions(self):
        from backend.services.llm.orchestrators.educational_domain import get_educational_structure_prompt
        from backend.services.llm.orchestrators import structure
        video_system = get_educational_structure_prompt("teacher_education", visual_mode="video")
        self.assertIn("video_prompt", video_system)
        self.assertIn("action unfolding over time", video_system)
        self.assertIn("camera movement", video_system)
        self.assertIn('"image_prompt_english"', get_educational_structure_prompt("teacher_education"))
        with patch.object(structure, "generate_text", return_value='[{"scene_number":1,"video_prompt":"A teacher waves."}]') as model:
            structure.build_structured_scenes(None, "research", "concept", "script", "style", "voice", visual_mode="video")
            self.assertIn("video_prompt", model.call_args.args[1])

    def test_video_prompt_survives_generation_edit_json_and_project_copy(self):
        prompt = "A teacher waves to her students; the camera slowly tracks left, ending on their raised hands."
        response = self.generate_storyboard([{"narration_khmer": "សួស្តី។", "video_prompt": prompt, "image_prompt_english": "A teacher beside a classroom desk, flat 2D art."}])
        self.assertEqual(response.status_code, 200, response.text)
        project = self.client.get(f"/api/projects/{self.project_id}").json()
        scene = project["scenes"][0]
        self.assertEqual(scene["scene_number"], 1)
        self.assertEqual(scene["video_prompt"], prompt)
        self.assertIn("teacher", scene["image_prompt_english"])
        updated = prompt + " Keep clothing consistent."
        self.assertEqual(self.client.put(f"/api/scenes/{scene['id']}", json={"video_prompt": updated}).status_code, 200)
        with self.factory() as db:
            self.assertEqual(json.loads(db.get(self.dbm.Project, self.project_id).structured_json_data)[0]["video_prompt"], updated)
        response = self.client.post(f"/api/projects/{self.project_id}/duplicate")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["visual_mode"], "images")
        self.assertEqual(response.json()["scenes"][0]["video_prompt"], updated)

    def test_missing_ai_image_prompts_do_not_replace_existing_work(self):
        with self.factory() as db:
            db.add(self.dbm.Scene(project_id=self.project_id, scene_number=1, video_prompt="Existing video direction")); db.commit()
        clip = self.project_dir / "scene_001_video.mp4"
        clip.write_bytes(self.sample_bytes)
        response = self.generate_storyboard([{"narration_khmer": "សួស្តី។", "video_prompt": "A moving scene"}])
        self.assertEqual(response.status_code, 422)
        with self.factory() as db:
            self.assertEqual(db.query(self.dbm.Scene).one().video_prompt, "Existing video direction")
        self.assertEqual(clip.read_bytes(), self.sample_bytes)

    def test_local_animation_matches_long_narration(self):
        with self.factory() as db:
            scene = self.dbm.Scene(project_id=self.project_id, scene_number=1, narration_khmer="សួស្តី។")
            db.add(scene); db.commit()
            scene_id = scene.id
        self.add_voice(scene_id, duration=1.3)
        response = self.client.post(f"/api/scenes/{scene_id}/generate-motion", json={"motion_type": "zoom_in", "duration": 99})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertAlmostEqual(response.json()["duration"], 1.3)
        _, duration = imageio_ffmpeg.count_frames_and_secs(str(self.project_dir / "scene_001_motion.mp4"))
        self.assertAlmostEqual(duration, 1.3, delta=1/30)
        self.add_voice(scene_id, duration=16.2)
        response = self.client.post(f"/api/scenes/{scene_id}/generate-motion", json={"motion_type": "zoom_in"})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertAlmostEqual(response.json()["duration"], 16.2)
        status = self.client.get(f"/api/projects/{self.project_id}/assembly-status").json()
        self.assertEqual(status["coupled_count"], 1)
        self.assertEqual(status["scenes"][0]["coupling_status"], "ready")
        self.assertFalse(status["scenes"][0]["duration_limit_exceeded"])

    def test_subtitle_settings_burn_into_pixels_and_off_removes_them(self):
        with self.factory() as db:
            scene = self.dbm.Scene(project_id=self.project_id, scene_number=1, narration_khmer="Hello screen.")
            db.add(scene); db.commit()
            scene_id = scene.id
        self.add_voice(scene_id, duration=0.6)
        frames = {}
        with patch.dict(self.render_engine.ASPECT_RATIO_RESOLUTIONS, {"16:9": (320, 180)}), patch.dict(self.scene_animator.ASPECT_RATIO_DIMENSIONS, {"16:9": (320, 180)}):
            for mode, position in (("off", "bottom"), ("classic", "bottom"), ("kinetic", "bottom"), ("classic", "center")):
                settings = {"animation_mode": "none", "subtitle_mode": mode, "subtitle_size": "md", "subtitle_position": position}
                response = self.client.put(f"/api/projects/{self.project_id}/timeline", json=settings)
                self.assertEqual(response.status_code, 200)
                with self.factory() as db:
                    self.assertEqual(json.loads(db.get(self.dbm.Project, self.project_id).timeline_data)["subtitle_mode"], mode)
                    asyncio.run(self.render_engine.render_project_video(self.project_id, db))
                output = self.project_dir / "final_output.mp4"
                for moment in (0.1, 0.45):
                    decoded = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-ss", str(moment), "-i", str(output), "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True)
                    frames[(mode, position, moment)] = np.frombuffer(decoded.stdout, dtype=np.uint8).reshape(180, 320, 3).astype(int)
                probe = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-i", str(output)], capture_output=True, text=True)
                self.assertNotIn("Subtitle:", probe.stderr)
                self.assertIn("Video:", probe.stderr)
                self.assertIn("Audio:", probe.stderr)
        off = frames[("off", "bottom", 0.1)]
        classic = frames[("classic", "bottom", 0.1)]
        pulse = frames[("kinetic", "bottom", 0.1)]
        center = frames[("classic", "center", 0.1)]
        self.assertGreater(np.count_nonzero(np.max(np.abs(classic-off), axis=2) > 30), 100)
        self.assertGreater(np.count_nonzero((pulse[:,:,0] > 150) & (pulse[:,:,1] > 100) & (pulse[:,:,2] < 140)), 10)
        self.assertGreater(np.count_nonzero(np.max(np.abs(pulse-frames[("kinetic", "bottom", 0.45)]), axis=2) > 30), 30)
        bottom_rows = np.where(np.max(np.abs(classic-off), axis=2) > 30)[0]
        center_rows = np.where(np.max(np.abs(center-off), axis=2) > 30)[0]
        self.assertLess(np.mean(center_rows), np.mean(bottom_rows) - 20)

    def test_missing_burn_filter_fails_clearly_without_destroying_old_export(self):
        with self.factory() as db:
            scene = self.dbm.Scene(project_id=self.project_id, scene_number=1, narration_khmer="Hello screen.")
            db.add(scene); db.commit()
            scene_id = scene.id
        self.add_voice(scene_id)
        previous = self.project_dir / "final_output.mp4"
        previous.write_bytes(b"previous completed export")
        with patch.object(self.render_engine, "check_filter_supported", side_effect=lambda executable, name: name != "ass"):
            with self.factory() as db, self.assertRaisesRegex(RuntimeError, "libass"):
                asyncio.run(self.render_engine.render_project_video(self.project_id, db))
        self.assertEqual(previous.read_bytes(), b"previous completed export")

    def test_existing_scene_can_plan_image_without_replacing_voice_or_motion(self):
        with self.factory() as db:
            scene = self.dbm.Scene(project_id=self.project_id, scene_number=1, narration_khmer="សួស្តី។", video_prompt="Keep this motion")
            db.add(scene); db.commit()
            scene_id = scene.id
        self.add_voice(scene_id)
        response_data = {"image_prompt_english": "A teacher standing in a bright classroom, clean 2D illustration.", "video_prompt": "A different motion"}
        with patch("backend.services.llm.client.generate_text", return_value=json.dumps(response_data)):
            response = self.client.post(f"/api/scenes/{scene_id}/plan-image")
        self.assertEqual(response.status_code, 200, response.text)
        with self.factory() as db:
            scene = db.get(self.dbm.Scene, scene_id)
            self.assertEqual(scene.video_prompt, "Keep this motion")
            self.assertEqual(scene.narration_khmer, "សួស្តី។")
            self.assertEqual(scene.audio_status, "completed")
            self.assertEqual(scene.image_prompt_english, response_data["image_prompt_english"])

    def test_split_keeps_all_words_and_illustration_and_archives_media(self):
        original = "The teacher introduces the lesson. The students discuss their ideas."
        with self.factory() as db:
            scene = self.dbm.Scene(project_id=self.project_id, scene_number=1, narration_khmer=original, image_path="video-first/scene_001.png", image_prompt_english="A classroom", video_prompt="Slow pan")
            db.add(scene); db.commit()
            scene_id = scene.id
        self.add_voice(scene_id, duration=11)
        (self.project_dir / "scene_001_video.mp4").write_bytes(self.sample_bytes)
        (self.project_dir / "scene_002_video.mp4").write_bytes(self.sample_bytes)
        response = self.client.post(f"/api/scenes/{scene_id}/split", json={"chunks": ["The teacher introduces the lesson.", "The students discuss their ideas."]})
        self.assertEqual(response.status_code, 200, response.text)
        with self.factory() as db:
            scenes = db.query(self.dbm.Scene).order_by(self.dbm.Scene.scene_number).all()
            self.assertEqual(len(scenes), 2)
            self.assertEqual(" ".join(scene.narration_khmer for scene in scenes), original)
            self.assertEqual([scene.scene_number for scene in scenes], [1, 2])
            self.assertTrue(all(scene.audio_status == "idle" and not scene.audio_path for scene in scenes))
            self.assertTrue(all((self.workspace / scene.image_path).is_file() for scene in scenes))
            self.assertTrue(all(scene.image_prompt_english == "A classroom" for scene in scenes))
        self.assertFalse((self.project_dir / "scene_001_video.mp4").exists())
        self.assertFalse((self.project_dir / "scene_002_video.mp4").exists())
        self.assertEqual(len(list((self.project_dir / "_scene_history").glob("*/scene_001.wav"))), 1)
        response = self.client.post(f"/api/scenes/{scene_id}/split", json={"chunks": ["Changed", "words"]})
        self.assertEqual(response.status_code, 422)

    def test_json_import_retains_video_direction(self):
        response = self.client.post(f"/api/projects/{self.project_id}/import-scenes", json={"mode": "replace", "scenes": [{"narration_khmer": "សួស្តី។", "video_prompt": "A character turns and walks away, camera locked."}]})
        self.assertEqual(response.status_code, 200, response.text)
        project = self.client.get(f"/api/projects/{self.project_id}").json()
        self.assertIn("walks away", project["scenes"][0]["video_prompt"])

    def test_animation_requires_image_and_ready_voice_without_duration_cap(self):
        with self.factory() as db:
            scene = self.dbm.Scene(project_id=self.project_id, scene_number=1, video_prompt="A teacher waves.")
            db.add(scene); db.commit()
            scene_id = scene.id
        url = f"/api/scenes/{scene_id}/generate-video"
        settings = {"prompt": "A teacher waves."}
        self.assertEqual(self.client.post(url, json=settings).status_code, 400)
        self.add_voice(scene_id, status="outdated")
        self.assertEqual(self.client.post(url, json=settings).status_code, 400)
        self.add_voice(scene_id, duration=20.1)
        response = self.client.post(url, json=settings)
        self.assertEqual(response.status_code, 202, response.text)
        task = self.worker.image_queue.get_nowait()
        self.assertEqual(task.payload["duration"], 20.1)
        self.assertEqual(task.payload["image_path"], str(self.project_dir / "scene_001.png"))

    def test_image_workflow_still_uses_the_selected_reference(self):
        image = self.project_dir / "variant.png"
        image.write_bytes(b"selected image")
        with self.factory() as db:
            db.get(self.dbm.Project, self.project_id).visual_mode = "images"
            scene = self.dbm.Scene(project_id=self.project_id, scene_number=1, image_path="video-first/variant.png")
            db.add(scene); db.commit()
            scene_id = scene.id
        self.add_voice(scene_id)
        response = self.client.post(f"/api/scenes/{scene_id}/generate-video", json={"prompt": "The character waves."})
        self.assertEqual(response.status_code, 202, response.text)
        self.assertEqual(self.worker.image_queue.get_nowait().payload["image_path"], str(image))

    def test_image_and_voice_storyboard_runs_through_queue_and_real_mp4_export(self):
        response = self.generate_storyboard([{"narration_khmer": "សួស្តី។", "video_prompt": "A teacher waves and smiles; the camera pans slowly left.", "image_prompt_english": "A smiling teacher in a classroom."}])
        self.assertEqual(response.status_code, 200, response.text)
        with self.factory() as db:
            scene = db.query(self.dbm.Scene).one()
            scene_id, prompt = scene.id, scene.video_prompt
            audio = self.project_dir / "scene_001.wav"
            sf.write(str(audio), np.sin(np.arange(8000) * 0.1).astype("float32"), 16000)
            scene.audio_path = "video-first/scene_001.wav"
            scene.audio_status = "completed"
            db.commit()
        response = self.client.post(f"/api/scenes/{scene_id}/generate-video", json={"prompt": prompt})
        self.assertEqual(response.status_code, 202, response.text)
        task = self.worker.image_queue.get_nowait()
        self.assertEqual(task.payload["image_path"], str(self.project_dir / "scene_001.png"))
        self.assertEqual(task.payload["duration"], 0.5)
        def fake_video(image, text, output, *args):
            self.assertEqual(image, str(self.project_dir / "scene_001.png"))
            self.assertEqual(text, prompt)
            Path(output).write_bytes(self.sample_bytes)
            return output
        with patch.object(self.worker.flow_video, "generate_scene_video", side_effect=fake_video):
            asyncio.run(self.worker.process_task(task))
        status = self.client.get(f"/api/projects/{self.project_id}/assembly-status").json()
        self.assertEqual(status["coupled_count"], 1)
        self.assertEqual(status["scenes"][0]["coupling_status"], "ready")
        self.assertTrue(status["scenes"][0]["image_exists"])
        self.assertTrue(status["scenes"][0]["animation"]["has_video"])
        with self.factory() as db:
            asyncio.run(self.render_engine.render_project_video(self.project_id, db))
        job = self.render_engine.RENDER_JOBS[self.project_id]
        self.assertEqual(job["status"], "completed", job.get("error"))
        final = self.project_dir / "final_output.mp4"
        self.assertTrue(final.is_file())
        probe = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-i", str(final)], capture_output=True, text=True)
        self.assertIn("Video:", probe.stderr)
        self.assertIn("Audio:", probe.stderr)


if __name__ == "__main__":
    unittest.main()
