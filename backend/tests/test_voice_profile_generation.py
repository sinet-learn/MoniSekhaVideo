"""Exercise automatic seed creation and reuse without loading model weights."""
import hashlib
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import numpy as np
import soundfile as sf

from backend.services import voice_engine


class VoiceProfileGenerationTests(unittest.TestCase):
    def test_scene_paths_create_and_reuse_language_specific_profiles(self):
        tag = "(Warm, ស្ងប់ស្ងាត់)"
        for generate in (voice_engine.generate_scene_audio_chunk,
                         voice_engine.generate_single_scene_audio):
            with self.subTest(generator=generate.__name__), \
                 tempfile.TemporaryDirectory() as root, \
                 patch.object(voice_engine, "__file__", str(Path(root) / "backend/services/voice_engine.py")), \
                 patch.object(voice_engine, "load_model"), \
                 patch.object(voice_engine, "schedule_unload"), \
                 patch.object(voice_engine, "VoxCPM", object()):
                model = Mock()
                model.tts_model = SimpleNamespace(sample_rate=16000)
                model.generate.return_value = np.sin(np.arange(1600) * 0.1).astype("float32")
                with patch.object(voice_engine, "_VOXCPM_MODEL", model):
                    for text, suffix in (("សួស្តី។", ""), ("Hello.", "|en")):
                        with self.subTest(language=suffix or "km"):
                            digest = hashlib.sha256(f"{tag}|2.0|15{suffix}".encode("utf-8")).hexdigest()[:16]
                            seed = Path(root) / "workspace/test" / f"voice_profile_{digest}.wav"
                            def synthesize(number):
                                return generate(text=text, project_slug="test", scene_number=number,
                                                profile_tag=tag)

                            model.generate.reset_mock()
                            output = synthesize(1)
                            self.assertTrue(seed.is_file())
                            self.assertGreater(sf.info(output).duration, 0)
                            self.assertEqual(model.generate.call_count, 2)
                            self.assertEqual(model.generate.call_args.kwargs["prompt_wav_path"], str(seed))
                            original_seed = seed.read_bytes()

                            model.generate.reset_mock()
                            output = synthesize(2)
                            self.assertGreater(sf.info(output).duration, 0)
                            self.assertEqual(model.generate.call_count, 1)
                            self.assertEqual(seed.read_bytes(), original_seed)
