import re
import unittest
from backend.services.khmer_text import analyze_khmer_text, subtitle_payload, subtitle_pages
from backend.services.render_engine import format_srt_timestamp, generate_srt


class SubtitlePageTests(unittest.TestCase):
    def check_pages(self, source):
        analysis = analyze_khmer_text(source)
        pages = subtitle_pages(analysis)
        self.assertTrue(pages)
        self.assertEqual(pages[0]["start_word"], 0)
        self.assertEqual(pages[-1]["end_word"], len(analysis.words))
        reconstructed = ""
        previous_word, previous_part, previous_end = 0, 0, 0
        for page in pages:
            self.assertEqual(page["start_word"], previous_word)
            self.assertEqual(page["part_start"], previous_part)
            self.assertEqual(page["start"], previous_end)
            self.assertGreater(page["end_word"], page["start_word"])
            self.assertLessEqual(page["end_word"] - page["start_word"], 4)
            self.assertGreater(page["end"], page["start"])
            if page["end_word"] - page["start_word"] > 1:
                self.assertLessEqual(len(page["text"].replace("\u200b", "")), 32)
            reconstructed += "".join(part.text for part in analysis.parts[page["part_start"]:page["part_end"]])
            previous_word, previous_part, previous_end = page["end_word"], page["part_end"], page["end"]
        self.assertEqual(reconstructed, source.replace("\u200b", ""))
        self.assertEqual(pages[-1]["end"], 1)
        return analysis, pages

    def test_long_khmer_narration_displays_only_a_few_complete_words(self):
        source = "ការអប់រំមានសារៈសំខាន់ណាស់។ សិស្សទាំងអស់ត្រូវចូលរួមក្នុងសកម្មភាពនេះ។"
        analysis, pages = self.check_pages(source)
        self.assertGreater(len(pages), 1)
        self.assertTrue(all(page["text"] != analysis.display_text for page in pages))
        self.assertTrue(pages[0]["text"].endswith("។"))
        self.assertTrue(any("\u200b" in page["text"] for page in pages))

    def test_english_dosages_and_long_words_stay_intact(self):
        self.check_pages("Take Paracetamol 500mg once daily with food and water.")
        _, pages = self.check_pages("Paracetamol hydrochlorothiazide 0.5mg/kg daily.")
        self.assertTrue(any("hydrochlorothiazide" in page["text"] for page in pages))
        self.assertTrue(any("0.5mg/kg" in page["text"] for page in pages))
        long_word = "a" * 70
        _, pages = self.check_pages(f"{long_word} next word.")
        self.assertEqual(pages[0]["text"], long_word)
        self.assertEqual(pages[0]["end_word"] - pages[0]["start_word"], 1)

    def test_sentence_endings_and_opening_brackets_stay_with_the_right_page(self):
        _, pages = self.check_pages("one two. three four five six seven.")
        self.assertEqual(pages[0]["text"], "one two.")
        _, pages = self.check_pages("one two three four (five six seven eight) nine.")
        self.assertFalse(pages[0]["text"].endswith("("))
        self.assertTrue(pages[1]["text"].startswith("("))
        self.assertTrue(pages[1]["text"].endswith(")"))

    def test_srt_timing_matches_preview_pages_and_continues_across_scenes(self):
        source = "one two three four five six seven eight nine."
        payload = subtitle_payload(source)
        duration = 3.25
        srt = generate_srt([
            {"narration_khmer": source, "duration": duration},
            {"narration_khmer": "", "duration": 1},
            {"narration_khmer": "Last page.", "duration": 0.75},
        ])
        blocks = srt.strip().split("\n\n")
        self.assertEqual(len(blocks), len(payload["pages"]) + 1)
        for index, page in enumerate(payload["pages"]):
            self.assertIn(page["text"], blocks[index])
            start = format_srt_timestamp(duration * page["start"])
            end = format_srt_timestamp(duration * page["end"])
            self.assertIn(f"{start} --> {end}", blocks[index])
        self.assertIn("00:00:04,250 --> 00:00:05,000", blocks[-1])
        self.assertEqual(re.findall(r"^\d+$", srt, flags=re.MULTILINE), [str(i+1) for i in range(len(blocks))])

    def test_short_caption_remains_one_page_and_empty_text_has_none(self):
        _, pages = self.check_pages("សួស្តីសិស្ស។")
        self.assertEqual(len(pages), 1)
        self.assertEqual(subtitle_pages(analyze_khmer_text("")), [])
        self.assertEqual(generate_srt([]), "")

    def test_timestamp_rounding_carries_at_second_and_minute_boundaries(self):
        self.assertEqual(format_srt_timestamp(59.9996), "00:01:00,000")
        self.assertEqual(format_srt_timestamp(3599.9996), "01:00:00,000")
