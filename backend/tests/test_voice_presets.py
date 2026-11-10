"""Run with: .venv/bin/python -m unittest discover -s backend/tests -v"""
import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import numpy as np
from sqlalchemy import create_engine

from backend.services import voice_engine
from backend.voice_presets import ENGLISH_VOICE_PRESETS, VOICE_PRESETS


class PresetInstallationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Load a separate database module against SQLite memory. The real studio
        # database and any user voices must never be changed by this test suite.
        cls.engine = create_engine("sqlite://")
        name = "backend._voice_preset_test_database"
        spec = importlib.util.spec_from_file_location(
            name, Path(__file__).parents[1] / "database.py"
        )
        cls.database = importlib.util.module_from_spec(spec)
        sys.modules[name] = cls.database
        with patch("sqlalchemy.create_engine", return_value=cls.engine):
            spec.loader.exec_module(cls.database)

    @classmethod
    def tearDownClass(cls):
        cls.engine.dispose()
        sys.modules.pop(cls.database.__name__, None)

    def setUp(self):
        self.db = self.database.SessionLocal()
        self.db.query(self.database.Character).delete()
        self.db.query(self.database.VoicePresetInstallation).delete()
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_existing_library_receives_all_presets_without_duplicate_or_overwrite(self):
        custom = self.database.Character(name="My own voice", audio_path="custom.wav")
        self.db.add(custom)
        self.db.commit()
        self.database.seed_fictional_voice_presets()
        self.database.seed_fictional_voice_presets()
        self.assertEqual(self.db.query(self.database.Character).count(), len(VOICE_PRESETS) + len(ENGLISH_VOICE_PRESETS) + 1)
        self.db.refresh(custom)
        self.assertEqual(custom.audio_path, "custom.wav")
        self.assertEqual(len({p[0] for p in VOICE_PRESETS}), 48)
        self.assertEqual(len({p[1] for p in VOICE_PRESETS}), 48)

    def test_deleted_or_renamed_presets_stay_deleted_or_renamed(self):
        self.database.seed_fictional_voice_presets()
        first, second = self.db.query(self.database.Character).order_by(self.database.Character.id).limit(2).all()
        second.name = "My renamed narrator"
        self.db.delete(first)
        self.db.commit()
        self.database.seed_fictional_voice_presets()
        self.assertEqual(self.db.query(self.database.Character).count(), len(VOICE_PRESETS) + len(ENGLISH_VOICE_PRESETS) - 1)
        self.db.refresh(second)
        self.assertEqual(second.name, "My renamed narrator")


class SavedVoiceTests(unittest.TestCase):
    def test_first_use_saves_each_voice_once_and_reuses_it(self):
        model = Mock()
        model.tts_model = SimpleNamespace(sample_rate=16000)
        model.generate.return_value = np.sin(np.arange(1600) * 0.1).astype("float32")
        with tempfile.TemporaryDirectory() as directory, \
             patch.object(voice_engine, "__file__", str(Path(directory) / "backend/services/voice_engine.py")), \
             patch.object(voice_engine, "_MODEL_STATE", "loaded"), \
             patch.object(voice_engine, "_VOXCPM_MODEL", model), \
             patch.object(voice_engine, "VoxCPM", object()), \
             patch.object(voice_engine, "schedule_unload"):
            tag = "(Male, Adult, Calm narrator tone, Normal speed)"
            first = voice_engine.ensure_character_reference(101, tag, "សួស្តី", 2.5, 20)
            self.assertTrue((Path(directory) / "workspace" / first).is_file())
            self.assertEqual(model.generate.call_args.kwargs["cfg_value"], 2.5)
            self.assertEqual(model.generate.call_args.kwargs["inference_timesteps"], 20)
            again = voice_engine.ensure_character_reference(101, tag, "សួស្តី", 1.5, 30)
            self.assertEqual(first, again)
            self.assertEqual(model.generate.call_count, 1)
            second = voice_engine.ensure_character_reference(102, tag, "សួស្តី")
            self.assertNotEqual(first, second)
            self.assertEqual(model.generate.call_count, 2)
            # A temporary Factory audition must not replace a saved speaker.
            voice_engine.generate_character_preview(tag, "សួស្តី")
            self.assertTrue((Path(directory) / "workspace" / first).is_file())

    def test_failed_audio_write_does_not_return_a_saved_reference(self):
        model = Mock()
        model.tts_model = SimpleNamespace(sample_rate=16000)
        model.generate.return_value = np.ones(100, dtype="float32")
        with tempfile.TemporaryDirectory() as directory, \
             patch.object(voice_engine, "__file__", str(Path(directory) / "backend/services/voice_engine.py")), \
             patch.object(voice_engine, "_MODEL_STATE", "loaded"), \
             patch.object(voice_engine, "_VOXCPM_MODEL", model), \
             patch.object(voice_engine, "VoxCPM", object()), \
             patch.object(voice_engine.sf, "write", side_effect=OSError("disk full")):
            with self.assertRaises(OSError):
                voice_engine.ensure_character_reference(103, "(Calm)", "សួស្តី")


if __name__ == "__main__":
    unittest.main()
