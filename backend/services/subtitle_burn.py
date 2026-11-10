"""ASS captions rendered into video frames, using the preview's word pages."""
from .subtitle_style import normalize_style, ass_color
from .khmer_text import ZERO_WIDTH_SPACE, analyze_khmer_text, subtitle_pages


def _timestamp(seconds: float) -> str:
    centiseconds = max(0, int(round(seconds * 100)))
    whole, fraction = divmod(centiseconds, 100)
    minutes, second = divmod(whole, 60)
    hours, minute = divmod(minutes, 60)
    return f"{hours}:{minute:02d}:{second:02d}.{fraction:02d}"


def _literal(text: str) -> str:
    # libass supports escaped braces; a word joiner keeps source '\N', '\n'
    # and '\h' sequences literal without changing their visible characters.
    return (text.replace("\\", "\\\u2060").replace("{", "\\{").replace("}", "\\}")
            .replace("\r\n", "\n").replace("\r", "\n").replace("\n", "\\N"))


def generate_ass(items: list[dict], width: int, height: int, *, mode="kinetic",
                 size="md", position="bottom", font_family="Khmer OS Battambang", latin_font_family="Arial", style=None) -> str:
    if mode not in ("kinetic", "classic", "off"):
        raise ValueError("Unknown subtitle mode. Choose Pulse, Classic or Off.")
    if mode == "off":
        return ""
    if size not in ("sm", "md", "lg") or position not in ("bottom", "center", "top"):
        raise ValueError("Invalid subtitle size or position.")
    settings = normalize_style(style, mode=mode, size=size)
    font_size = max(12, round(height * settings["font_percent"] / 100))
    alignment = {"bottom": 2, "center": 5, "top": 8}[position]
    margin_x, margin_y = max(4, round(width * 0.06)), max(4, round(height * settings["margin_percent"] / 100))
    family = font_family.replace(",", " ").replace("\n", " ").replace("\r", " ")
    primary = ass_color(settings["text_color"])
    future = ass_color(settings["future_color"])
    highlight = ass_color(settings["highlight_color"]).replace("&H00", "&H", 1)
    outline = ass_color(settings["outline_color"])
    background = ass_color(settings["background_color"], settings["background_opacity"])
    border_style = 4 if settings["background"] else 1
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
ScaledBorderAndShadow: yes
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,{family},{font_size},{primary},{future},{outline},{background},{-1 if settings["bold"] else 0},0,0,0,100,100,0,0,{border_style},{settings["outline_width"]},0,{alignment},{margin_x},{margin_x},{margin_y},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    def font_tag(text):
        selected = family if any("\u1780" <= char <= "\u17ff" for char in text) else latin_font_family
        selected = selected.replace("\\", "").replace("{", "").replace("}", "").replace("\n", " ").replace("\r", " ")
        return "{\\fn" + selected + "}"

    events = []
    scene_start = 0.0

    def emit(start, end, text):
        if end <= start:
            return
        first, last = _timestamp(start), _timestamp(end)
        if first == last:
            return
        events.append(f"Dialogue: 0,{first},{last},Caption,,0,0,0,,{text}")

    for item in items:
        duration = float(item.get("duration") or 0)
        if duration <= 0:
            continue
        analysis = analyze_khmer_text((item.get("narration_khmer") or "").strip())
        cumulative = [0.0]
        for weight in analysis.weights:
            cumulative.append(cumulative[-1] + weight)
        for page in subtitle_pages(analysis, 1 if settings["behavior"] == "word" else settings["words_per_page"], settings["characters_per_page"]):
            selected = analysis.parts[page["part_start"]:page["part_end"]]
            while selected and selected[0].kind == "space":
                selected = selected[1:]
            while selected and selected[-1].kind == "space":
                selected = selected[:-1]
            if settings["behavior"] in ("static", "word"):
                fragments = []
                for index, part in enumerate(selected):
                    if index > 0 and part.break_before:
                        fragments.append(ZERO_WIDTH_SPACE)
                    fragments.append(font_tag(part.text) + _literal(part.text) + r"{\rCaption}")
                emit(scene_start + duration * page["start"], scene_start + duration * page["end"], "".join(fragments))
                continue
            for active in range(page["start_word"], page["end_word"]):
                fragments = []
                for index, part in enumerate(selected):
                    if index > 0 and part.break_before:
                        fragments.append(ZERO_WIDTH_SPACE)
                    text = font_tag(part.text) + _literal(part.text)
                    if part.word_index == active:
                        scale = settings["highlight_scale"] if settings["behavior"] == "pulse" else 100
                        fragments.append(f"{{\\1c{highlight}\\b1\\fscx{scale}\\fscy{scale}}}" + text + r"{\rCaption}")
                    elif part.word_index > active:
                        tag = r"{\alpha&HFF&}" if settings["behavior"] == "reveal" else "{\\1c" + future + "}"
                        fragments.append(tag + text + r"{\rCaption}")
                    else:
                        fragments.append(text)
                emit(scene_start + duration * cumulative[active] / cumulative[-1],
                     scene_start + duration * cumulative[active+1] / cumulative[-1], "".join(fragments))
        scene_start += duration
    return header + "\n".join(events) + "\n" if events else ""
