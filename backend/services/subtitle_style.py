"""Validated caption controls shared by ASS export and raster preview."""
import math
import re

DEFAULT_STYLE = dict(text_color="#ffffff", highlight_color="#fcd34d", future_color="#999999",
                     background_color="#000000", background_opacity=62, outline_color="#000000",
                     outline_width=2, font_percent=3.4, bold=False, words_per_page=4,
                     characters_per_page=32, behavior="pulse", highlight_scale=104, margin_percent=5,
                     background=True)


def normalize_style(value=None, *, mode="kinetic", size="md"):
    if value is not None and not isinstance(value, dict):
        raise ValueError("Subtitle style must be an object.")
    result = {**DEFAULT_STYLE, "behavior": "static" if mode == "classic" else "pulse",
              "font_percent": {"sm": 2.6, "md": 3.4, "lg": 4.4}.get(size, 3.4)}
    result.update({k: v for k, v in (value or {}).items() if k in result})
    for key in ("text_color", "highlight_color", "future_color", "background_color", "outline_color"):
        if not isinstance(result[key], str) or not re.fullmatch(r"#[0-9a-fA-F]{6}", result[key]):
            raise ValueError(f"Invalid subtitle {key}.")
    for key, low, high in (("background_opacity", 0, 100), ("outline_width", 0, 8),
                           ("font_percent", 1.5, 8), ("words_per_page", 1, 8),
                           ("characters_per_page", 12, 80), ("highlight_scale", 100, 125),
                           ("margin_percent", 2, 25)):
        value = result[key]
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not low <= value <= high:
            raise ValueError(f"Subtitle {key} must be between {low} and {high}.")
    for key in ("words_per_page", "characters_per_page"):
        result[key] = int(result[key])
    if result["behavior"] not in ("static", "pulse", "highlight", "reveal", "word"):
        raise ValueError("Invalid subtitle behavior.")
    if not all(isinstance(result[key], bool) for key in ("bold", "background")):
        raise ValueError("Subtitle bold/background must be boolean.")
    return result


def ass_color(value, opacity=100):
    return f"&H{round(255 * (1-opacity/100)):02X}{value[5:7]}{value[3:5]}{value[1:3]}&".upper()
