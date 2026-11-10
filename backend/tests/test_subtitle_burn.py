import unittest
from backend.services.subtitle_burn import generate_ass, _literal


class SubtitleBurnStyleTests(unittest.TestCase):
    def test_off_has_no_burn_events(self):
        self.assertEqual(generate_ass([{"narration_khmer": "Hello.", "duration": 1}], 1920, 1080, mode="off"), "")

    def test_classic_uses_short_pages_and_selected_size_and_position(self):
        items = [{"narration_khmer": "one two three four five six seven eight nine.", "duration": 4}]
        small = generate_ass(items, 1920, 1080, mode="classic", size="sm", position="bottom")
        large = generate_ass(items, 1920, 1080, mode="classic", size="lg", position="center")
        self.assertEqual(small.count("Dialogue:"), 3)
        self.assertIn(",2,115,115,54,1", small)
        self.assertIn(",5,115,115,54,1", large)
        small_font = int(next(line for line in small.splitlines() if line.startswith("Style:")).split(",")[2])
        large_font = int(next(line for line in large.splitlines() if line.startswith("Style:")).split(",")[2])
        self.assertGreater(large_font, small_font)

    def test_pulse_has_word_highlights_with_estimated_word_times(self):
        ass = generate_ass([{"narration_khmer": "ការអប់រំមានសារៈសំខាន់ណាស់។", "duration": 4}], 1920, 1080)
        events = [line for line in ass.splitlines() if line.startswith("Dialogue:")]
        self.assertEqual(len(events), 4)
        self.assertTrue(all(r"\1c&H4DD3FC&" in line and r"\fscx104" in line for line in events))
        self.assertIn("0:00:00.00", events[0])
        self.assertIn("0:00:04.00", events[-1])
        self.assertIn("សារៈសំខាន់", ass)

    def test_source_text_cannot_become_ass_positioning_or_linebreak_commands(self):
        ass = generate_ass([{"narration_khmer": r"Hello {\pos(1,2)} \N", "duration": 2}], 1920, 1080, mode="classic")
        events = "\n".join(line for line in ass.splitlines() if line.startswith("Dialogue:"))
        self.assertNotIn(r"{\pos", events)
        self.assertIn(r"\{", events)
        self.assertIn("\\\u2060N", _literal(r"\N"))
