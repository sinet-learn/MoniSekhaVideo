"""Real Khmer NLP segmentation; TTS inference stays mocked."""
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import numpy as np
import soundfile as sf

from backend.services import khmer_text, voice_engine, render_engine


class KhmerWordBoundaryTests(unittest.TestCase):
    def test_real_words_stay_intact_with_lossless_invisible_breaks(self):
        source = "ការអប់រំមានសារៈសំខាន់ណាស់។"
        result = khmer_text.analyze_khmer_text(source)
        self.assertEqual(result.words, ("ការអប់រំ", "មាន", "សារៈសំខាន់", "ណាស់"))
        self.assertEqual(result.display_text, "ការអប់រំ\u200bមាន\u200bសារៈសំខាន់\u200bណាស់។")
        self.assertEqual(result.display_text.replace("\u200b", ""), source)
        self.assertEqual(result.speech_text, "ការអប់រំ មាន សារៈសំខាន់ ណាស់។")

    def test_whitespace_dosages_and_technical_terms_are_preserved(self):
        source = "  អ្នកជំងឺប្រើ Paracetamol 500mg\n\t0.5mg/kg។  "
        result = khmer_text.analyze_khmer_text(source)
        self.assertEqual(result.display_text.replace("\u200b", ""), source)
        self.assertEqual("".join(part.text for part in result.parts), source)
        self.assertIn("Paracetamol", result.words)
        self.assertIn("500mg", result.words)
        self.assertIn("0.5mg/kg", result.words)
        self.assertIn("\n\t", result.speech_text)

    def test_existing_invisible_boundaries_are_idempotent(self):
        display = khmer_text.analyze_khmer_text("សួស្តីសិស្សទាំងអស់។").display_text
        self.assertEqual(khmer_text.analyze_khmer_text(display).display_text, display)
        self.assertNotIn("\u200b", khmer_text.prepare_tts_text(display))
        self.assertNotIn("\u200b\u200b", display)

    def test_repetition_mark_is_attached_to_its_word(self):
        result = khmer_text.analyze_khmer_text("ថ្មីៗនេះយើងសិក្សា។")
        self.assertIn("ថ្មីៗ", result.words)
        self.assertNotIn("ៗ", result.words)
        self.assertNotIn("\u200bៗ", result.display_text)

    def test_tokenizer_cannot_normalize_away_source_characters(self):
        source = "សុខភាព"
        khmer_text.analyze_khmer_text.cache_clear()
        khmer_text._khmer_words.cache_clear()
        try:
            with patch.object(khmer_text, "word_tokenize", return_value=["សុខ"]):
                result = khmer_text.analyze_khmer_text(source)
            self.assertEqual(result.display_text, source)
            self.assertEqual(result.speech_text, source)
        finally:
            khmer_text.analyze_khmer_text.cache_clear()
            khmer_text._khmer_words.cache_clear()

    def test_no_boundary_can_split_coeng_from_its_consonant(self):
        source = "ស្ត្រី"
        khmer_text.analyze_khmer_text.cache_clear()
        khmer_text._khmer_words.cache_clear()
        try:
            with patch.object(khmer_text, "word_tokenize", return_value=["ស្", "ត្រី"]):
                result = khmer_text.analyze_khmer_text(source)
            self.assertEqual(result.words, (source,))
            self.assertNotIn("្\u200b", result.display_text)
        finally:
            khmer_text.analyze_khmer_text.cache_clear()
            khmer_text._khmer_words.cache_clear()

    def test_subtitle_payload_and_srt_use_the_same_boundaries(self):
        source = "ប្រទេសកម្ពុជាមានប្រជាជនច្រើន។"
        payload = khmer_text.subtitle_payload(source)
        self.assertEqual("".join(part["text"] for part in payload["parts"]), source)
        self.assertEqual(payload["timing"], "estimated")
        self.assertTrue(all(word["weight"] > 0 for word in payload["words"]))
        srt = render_engine.generate_srt([{"narration_khmer": source, "duration": 3.25}])
        for page in payload["pages"]:
            self.assertIn(page["text"], srt)
        self.assertIn("00:00:03,250", srt)

    def test_empty_or_latin_text_is_not_rewritten(self):
        for source in ("", "Hello, world! Paracetamol 500mg (0.5mg/kg).\n"):
            result = khmer_text.analyze_khmer_text(source)
            self.assertEqual(result.display_text, source)
            self.assertEqual(result.speech_text, source)


class KhmerSpeechInputTests(unittest.TestCase):
    def test_target_reference_and_auditions_share_segmentation_without_mutating_source(self):
        source = "ការអប់រំមានសារៈសំខាន់ណាស់។"
        expected = khmer_text.prepare_tts_text(source)
        model = Mock()
        model.tts_model = SimpleNamespace(sample_rate=16000)
        model.generate.return_value = np.sin(np.arange(1600) * 0.1).astype("float32")
        with tempfile.TemporaryDirectory() as root, \
             patch.object(voice_engine, "__file__", str(Path(root) / "backend/services/voice_engine.py")), \
             patch.object(voice_engine, "_MODEL_STATE", "loaded"), \
             patch.object(voice_engine, "_VOXCPM_MODEL", model), \
             patch.object(voice_engine, "VoxCPM", object()), \
             patch.object(voice_engine, "schedule_unload"):
            reference = Path(root) / "reference.wav"
            sf.write(reference, model.generate.return_value, 16000)
            voice_engine.generate_single_scene_audio(source, "test", 1, str(reference), source)
            self.assertEqual(model.generate.call_args.kwargs["text"], expected)
            self.assertEqual(model.generate.call_args.kwargs["prompt_text"], expected)
            voice_engine.generate_character_preview("(Female, Warm)", source)
            self.assertEqual(model.generate.call_args.kwargs["text"], f"(Female, Warm){expected}")
            voice_engine.generate_clone_preview(str(reference), source, source)
            self.assertEqual(model.generate.call_args.kwargs["text"], expected)
            self.assertEqual(model.generate.call_args.kwargs["prompt_text"], expected)
        self.assertEqual(source, "ការអប់រំមានសារៈសំខាន់ណាស់។")
