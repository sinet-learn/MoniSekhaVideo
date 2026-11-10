"""Render a bounded, cached set of transparent libass frames for the editor."""
import base64
from functools import lru_cache
import json
from io import BytesIO
import numpy as np
import os
import shutil
import subprocess
import tempfile
from PIL import ImageFont, Image
import imageio_ffmpeg
from .subtitle_burn import generate_ass, _timestamp


def prepare_fonts(directory, khmer_path):
    fonts = os.path.join(directory, "subtitle_fonts")
    os.makedirs(fonts, exist_ok=True)
    latin_path = next((p for p in (
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "C:/Windows/Fonts/arial.ttf",
    ) if os.path.isfile(p)), None)
    def family(path, default):
        try:
            return ImageFont.truetype(path, 32).getname()[0] if path else default
        except OSError:
            return default
    for path in (khmer_path, latin_path):
        if path and os.path.isfile(path):
            shutil.copyfile(path, os.path.join(fonts, os.path.basename(path)))
    return dict(font_family=family(khmer_path, "Khmer Sangam MN"), latin_font_family=family(latin_path, "Arial"))


def _seconds(value):
    hours, minutes, seconds = value.split(":")
    return int(hours) * 3600 + int(minutes) * 60 + float(seconds)


@lru_cache(maxsize=24)
def render_preview(text, width, height, settings_json, khmer_path):
    settings = json.loads(settings_json)
    with tempfile.TemporaryDirectory(prefix="cavepaint-captions-") as directory:
        ass = generate_ass([dict(narration_khmer=text, duration=10)], width, height,
                           **settings, **prepare_fonts(directory, khmer_path))
        if not ass:
            return {"frames": []}
        header, events = ass.split("[Events]\n", 1)
        lines = [line for line in events.splitlines() if line.startswith("Dialogue:")]
        if len(lines) > 256:
            raise ValueError("Caption preview is limited to 256 words per scene.")
        frames, sequential = [], []
        for index, line in enumerate(lines):
            fields = line.split(",", 9)
            frames.append(dict(start=_seconds(fields[1]) / 10, end=_seconds(fields[2]) / 10))
            fields[1], fields[2] = _timestamp(index / 10), _timestamp((index + 1) / 10)
            sequential.append(",".join(fields))
        with open(os.path.join(directory, "captions.ass"), "w", encoding="utf-8") as output:
            output.write(header + "[Events]\n" + events.splitlines()[0] + "\n" + "\n".join(sequential) + "\n")
        # Recover straight alpha from opaque black/white renders. FFmpeg's ASS
        # alpha=1 path compounds background alpha, which makes translucent boxes
        # lighter in browsers than in the final opaque video.
        caption_filter = "ass=filename=captions.ass:fontsdir=subtitle_fonts"
        command = [imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error"]
        for color in ("black", "white"):
            command += ["-f", "lavfi", "-i", f"color=c={color}:s={width}x{height}:r=10,format=rgba"]
        for index, color in enumerate(("black", "white")):
            command += ["-map", f"{index}:v", "-vf", caption_filter, "-frames:v", str(len(frames)),
                        "-threads", "1", f"{color}-%03d.png"]
        subprocess.run(command, cwd=directory, check=True, capture_output=True, timeout=45)
        for index, frame in enumerate(frames):
            with Image.open(os.path.join(directory, f"black-{index+1:03d}.png")) as image:
                black = np.asarray(image.convert("RGB"), dtype=np.float32)
            with Image.open(os.path.join(directory, f"white-{index+1:03d}.png")) as image:
                white = np.asarray(image.convert("RGB"), dtype=np.float32)
            alpha = np.clip(255 - np.mean(white - black, axis=2), 0, 255)
            rgb = np.clip(np.round(black * 255 / np.maximum(alpha[:, :, None], 1)), 0, 255)
            rgba = np.dstack((rgb, np.round(alpha))).astype(np.uint8)
            output = BytesIO()
            Image.fromarray(rgba).save(output, format="PNG")
            frame["image"] = "data:image/png;base64," + base64.b64encode(output.getvalue()).decode("ascii")
        return {"frames": frames}
