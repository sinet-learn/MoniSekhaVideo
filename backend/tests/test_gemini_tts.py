import base64
import io
import unittest
from unittest.mock import Mock, patch

import numpy as np
import requests
import soundfile as sf

from backend.services import gemini_tts


class GeminiSpeechTests(unittest.TestCase):
    def wave_response(self):
        stream = io.BytesIO()
        sf.write(stream, np.full(2400, 0.25, dtype="float32"), 24000, format="WAV")
        return Mock(json=Mock(return_value={"steps": [{"type": "model_output", "content": [{
            "type": "audio", "data": base64.b64encode(stream.getvalue()).decode(),
        }]}]}))

    def test_both_modern_models_keep_style_out_of_spoken_text(self):
        for model in ("gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts"):
            for text in ("Hello, Paracetamol 500mg.", "សួស្តី។ Paracetamol 500mg។"):
                with self.subTest(model=model, text=text), \
                     patch.object(gemini_tts, "TTS_MODEL_NAME", model), \
                     patch.object(gemini_tts, "resolve_gemini_api_key", return_value="test-key"), \
                     patch.object(gemini_tts.requests, "post", return_value=self.wave_response()) as post:
                    audio, rate = gemini_tts.synthesize_gemini_speech(text, "Kore", "clinical")
                    part = post.call_args.kwargs["json"]["input"][0]["content"][0]
                    expected = gemini_tts.prepare_tts_text(text) if "ស" in text else text
                    self.assertEqual(part["text"], expected)
                    self.assertEqual(part["annotations"], [{"type": "speech_metadata",
                        "style": gemini_tts.resolve_style_prompt("clinical")}])
                    self.assertEqual(post.call_args.kwargs["json"]["generation_config"],
                                     {"speech_config": [{"voice": "Kore"}]})
                    self.assertEqual(rate, 24000)
                    self.assertGreater(len(audio), 0)

    def test_failure_never_switches_model_or_voice(self):
        with patch.object(gemini_tts, "resolve_gemini_api_key", return_value="test-key"), \
             patch.object(gemini_tts.requests, "post", side_effect=requests.HTTPError("Unavailable")) as post, \
             patch.object(gemini_tts.genai, "GenerativeModel") as legacy:
            with self.assertRaisesRegex(RuntimeError, "model was kept unchanged"):
                gemini_tts.synthesize_gemini_speech("Hello.", "Kore", "clinical")
            self.assertEqual(post.call_count, 1)
            self.assertEqual(post.call_args.kwargs["json"]["model"], "gemini-3.8-flash-tts")
            legacy.assert_not_called()

    def test_repeated_lines_use_identical_voice_model_and_delivery(self):
        with patch.object(gemini_tts, "resolve_gemini_api_key", return_value="test-key"), \
             patch.object(gemini_tts.requests, "post", return_value=self.wave_response()) as post:
            for text in ("First scene.", "Second scene.", "Third scene."):
                gemini_tts.synthesize_gemini_speech(text, "Charon", "documentary")
            bodies = [call.kwargs["json"] for call in post.call_args_list]
            for body in bodies:
                self.assertEqual(body["model"], "gemini-3.8-flash-tts")
                self.assertEqual(body["generation_config"], {"speech_config": [{"voice": "Charon"}]})
                self.assertEqual(body["input"][0]["content"][0]["annotations"],
                    [{"type": "speech_metadata", "style": "calm, measured, authoritative"}])

    def test_preset_id_and_saved_description_resolve_to_same_short_delivery(self):
        for preset in gemini_tts.GEMINI_STYLES:
            self.assertEqual(gemini_tts.resolve_style_prompt(preset["id"]),
                             gemini_tts.resolve_style_prompt(preset["prompt"]))
        self.assertEqual(gemini_tts.resolve_style_prompt("My custom delivery"), "My custom delivery")

    def test_unknown_voice_is_not_silently_replaced(self):
        with patch.object(gemini_tts, "resolve_gemini_api_key", return_value="test-key"), \
             patch.object(gemini_tts.requests, "post") as post:
            with self.assertRaisesRegex(ValueError, "Unknown Gemini voice"):
                gemini_tts.synthesize_gemini_speech("Hello.", "Missing voice")
            post.assert_not_called()

    def test_empty_text_makes_no_network_request(self):
        with patch.object(gemini_tts.requests, "post") as post:
            with self.assertRaisesRegex(ValueError, "empty text"):
                gemini_tts.synthesize_gemini_speech("  ")
            post.assert_not_called()
