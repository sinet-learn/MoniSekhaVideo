import base64
from io import BytesIO
import json
import os
import subprocess
import tempfile
import unittest

import imageio_ffmpeg
from PIL import Image, ImageChops, ImageStat
from backend.services.subtitle_burn import generate_ass
from backend.services.subtitle_style import normalize_style
from backend.services.subtitle_preview import render_preview, prepare_fonts
from backend.services.render_engine import get_best_khmer_font, generate_srt


class SubtitleCustomizationTests(unittest.TestCase):
    def test_invalid_styles_rejected(self):
        for value in ({"text_color": "red:foo"}, {"font_percent": float('nan')},
                      {"words_per_page": 0}, {"behavior": "unknown"}, {"background": "false"}):
            with self.subTest(value=value), self.assertRaises(ValueError):
                normalize_style(value)

    def test_paging_and_behavior(self):
        items = [dict(narration_khmer="one two three four five six", duration=6)]
        for behavior, count in (("static", 3), ("word", 6), ("highlight", 6), ("reveal", 6)):
            with self.subTest(behavior=behavior):
                ass = generate_ass(items, 1280, 720, position="top", style=dict(behavior=behavior, words_per_page=2))
                self.assertEqual(ass.count("Dialogue:"), count)
                self.assertIn(",8,77,77,36,1", ass)
                if behavior == "reveal":
                    self.assertIn(r"\alpha&HFF&", ass)
                if behavior == "highlight":
                    self.assertIn(r"\fscx100", ass)

    def test_srt_follows_custom_page_limits(self):
        items = [dict(narration_khmer="one two three four", duration=4)]
        self.assertEqual(generate_srt(items, {"words_per_page": 2}).count(" --> "), 2)
        self.assertEqual(generate_srt(items, {"behavior": "word"}).count(" --> "), 4)

    def test_colors_box_outline_and_size(self):
        ass = generate_ass([dict(narration_khmer="Hello screen", duration=1)], 1280, 720,
                           style=dict(text_color="#112233", highlight_color="#abcdef", background=False,
                                      outline_width=4, font_percent=5, bold=True))
        self.assertIn("&H00332211&", ass)
        self.assertIn(r"\1c&HEFCDAB&", ass)
        self.assertIn("Caption,Khmer OS Battambang,36,", ass)
        self.assertIn(",100,100,0,0,1,4,0,", ass)

    def test_raster_preview_matches_export_renderer_and_is_transparent(self):
        # Native output dimensions and fonts are identical on both paths.
        text = "សួស្តីសិស្សទាំងអស់។ Hello screen."
        width, height = 640, 360
        settings = dict(mode="kinetic", size="md", position="bottom",
                        style=dict(font_percent=6, highlight_color="#a3e635", background_opacity=75))
        preview = render_preview(text, width, height, json.dumps(settings), get_best_khmer_font())
        self.assertGreater(len(preview["frames"]), 1)
        self.assertEqual(preview["frames"][0]["start"], 0)
        self.assertEqual(preview["frames"][-1]["end"], 1)
        with tempfile.TemporaryDirectory() as directory:
            ass = generate_ass([dict(narration_khmer=text, duration=10)], width, height,
                               **settings, **prepare_fonts(directory, get_best_khmer_font()))
            with open(os.path.join(directory, "caption.ass"), "w") as target:
                target.write(ass)
            for index in (0, len(preview["frames"])-1):
                frame = preview["frames"][index]
                overlay = Image.open(BytesIO(base64.b64decode(frame["image"].split(",")[1])))
                self.assertEqual(overlay.mode, "RGBA")
                self.assertEqual(overlay.getpixel((0, 0))[3], 0)
                self.assertEqual(overlay.getextrema()[3], (0, 255))
                composed = Image.new("RGBA", (width, height), "#406080")
                composed.alpha_composite(overlay)
                midpoint = (frame["start"] + frame["end"]) * 5
                # RGB source deliberately avoids YUV conversion to isolate caption rendering.
                result = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-f", "lavfi", "-i",
                    f"color=c=0x406080:s={width}x{height}:r=10,format=rgba", "-vf",
                    "ass=filename=caption.ass:fontsdir=subtitle_fonts", "-ss", str(midpoint),
                    "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                    cwd=directory, check=True, capture_output=True)
                direct = Image.frombytes("RGB", (width, height), result.stdout)
                bounds = overlay.getchannel("A").getbbox()
                self.assertIsNotNone(bounds)
                difference = ImageStat.Stat(ImageChops.difference(composed.convert("RGB"), direct).crop(bounds))
                # libass alpha compositing rounds differently on transparent surfaces;
                # allow a small rounding difference within the visible caption region.
                self.assertLess(max(difference.mean), 1)
