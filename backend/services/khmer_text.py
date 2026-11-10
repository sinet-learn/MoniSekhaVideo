"""Lossless Khmer word boundaries shared by speech and subtitle presentation."""
from dataclasses import dataclass
from functools import lru_cache
import re
import threading
import unicodedata

from khmernltk import word_tokenize

ZERO_WIDTH_SPACE = "\u200b"
_KHMER_RUNS = re.compile(r"[\u1780-\u17ff]+|[^\u1780-\u17ff]+")
_OTHER_PARTS = re.compile(r"\s+|[^\W_]+(?:[./+%\-][^\W_]+)*%?|[^\s]", re.UNICODE)
_TOKENIZER_LOCK = threading.Lock()


@dataclass(frozen=True)
class TextPart:
    text: str
    kind: str
    word_index: int
    break_before: bool = False


@dataclass(frozen=True)
class KhmerText:
    parts: tuple[TextPart, ...]
    words: tuple[str, ...]
    weights: tuple[float, ...]
    display_text: str
    speech_text: str


def _is_word(text):
    return any(unicodedata.category(char)[0] in ("L", "N") and not "\u17d4" <= char <= "\u17dd" for char in text)


@lru_cache(maxsize=4096)
def _khmer_words(run: str) -> tuple[str, ...]:
    if not _is_word(run):
        return (run,)
    with _TOKENIZER_LOCK:
        predicted = tuple(token for token in word_tokenize(run, return_tokens=True) if token)
    # khmer-nltk normalizes some legacy spellings internally. Its predictions
    # may introduce boundaries, but must never replace source characters.
    if not predicted or "".join(predicted) != run:
        return (run,)
    safe = []
    for token in predicted:
        if safe and (token == "ៗ" or unicodedata.category(token[0]).startswith("M") or token[0] == "\u17d2" or safe[-1].endswith("\u17d2")):
            safe[-1] += token
        else:
            safe.append(token)
    return tuple(safe)


def _word_weight(word: str) -> float:
    khmer_bases = sum("\u1780" <= char <= "\u17b3" for char in word)
    if khmer_bases:
        return float(max(1, khmer_bases))
    vowels = len(re.findall(r"[aeiouy]+", word, flags=re.IGNORECASE))
    return max(1.0, vowels, len(word) / 4)


@lru_cache(maxsize=1024)
def analyze_khmer_text(text: str) -> KhmerText:
    # Existing invisible markers are derived boundaries, not spoken characters.
    source = (text or "").replace(ZERO_WIDTH_SPACE, "")
    raw_parts = []
    for match in _KHMER_RUNS.finditer(source):
        run = match.group()
        if "\u1780" <= run[0] <= "\u17ff":
            raw_parts.extend(_khmer_words(run))
        else:
            raw_parts.extend(_OTHER_PARTS.findall(run))
    parts, words, weights, display, speech = [], [], [], [], []
    previous_kind = None
    for token in raw_parts:
        kind = "space" if token.isspace() else "word" if _is_word(token) else "punctuation"
        boundary = previous_kind == "word" and kind == "word"
        if boundary:
            display.append(ZERO_WIDTH_SPACE)
            speech.append(" ")
        index = -1
        if kind == "word":
            index = len(words)
            words.append(token)
            weights.append(_word_weight(token))
        elif kind == "punctuation" and words:
            index = len(words) - 1
            if re.search(r"[។៕.!?]", token):
                weights[index] += 1.0
            elif re.search(r"[,;៖:]", token):
                weights[index] += 0.4
        parts.append(TextPart(token, kind, index, boundary))
        display.append(token)
        speech.append(token)
        previous_kind = kind
    assert "".join(part.text for part in parts) == source
    return KhmerText(tuple(parts), tuple(words), tuple(weights), "".join(display), "".join(speech))


def prepare_tts_text(text: str) -> str:
    """Use ordinary boundaries only in the model input; keep editable text intact."""
    return analyze_khmer_text(text).speech_text


SUBTITLE_WORDS_PER_PAGE = 4
SUBTITLE_CHARACTERS_PER_PAGE = 32


def subtitle_pages(analysis: KhmerText, max_words: int = SUBTITLE_WORDS_PER_PAGE, max_characters: int = SUBTITLE_CHARACTERS_PER_PAGE) -> list[dict]:
    """Bounded, whole-word captions with scene-relative estimated timing."""
    if not analysis.words:
        return []
    word_parts = [index for index, part in enumerate(analysis.parts) if part.kind == "word"]
    boundaries = [0]
    for index in word_parts[1:]:
        # Carry opening brackets/quotes onto the next page, not the previous one.
        cursor = index
        while cursor > boundaries[-1] and analysis.parts[cursor - 1].kind == "space":
            cursor -= 1
        opening = cursor
        while opening > boundaries[-1] and analysis.parts[opening - 1].kind == "punctuation" and all(char in "([{«“‘" for char in analysis.parts[opening - 1].text):
            opening -= 1
        boundaries.append(opening if opening < cursor else index)
    boundaries.append(len(analysis.parts))

    def display(start, end):
        selected = analysis.parts[boundaries[start]:boundaries[end]]
        return "".join((ZERO_WIDTH_SPACE if index > 0 and part.break_before else "") + part.text for index, part in enumerate(selected)).strip()

    cumulative = [0.0]
    for weight in analysis.weights:
        cumulative.append(cumulative[-1] + weight)
    pages = []

    def emit(start, end):
        pages.append({
            "start_word": start, "end_word": end,
            "part_start": boundaries[start], "part_end": boundaries[end],
            "text": display(start, end),
            "start": cumulative[start] / cumulative[-1],
            "end": cumulative[end] / cumulative[-1],
        })

    start = 0
    for index in range(len(analysis.words)):
        end = index + 1
        length = len(display(start, end).replace(ZERO_WIDTH_SPACE, ""))
        if index > start and (end - start > max_words or length > max_characters):
            emit(start, index)
            start = index
        trailing = analysis.parts[word_parts[index]+1:boundaries[end]]
        if any(part.kind == "punctuation" and re.search(r"[។៕.!?]", part.text) for part in trailing):
            emit(start, end)
            start = end
    if start < len(analysis.words):
        emit(start, len(analysis.words))
    return pages


def subtitle_payload(text: str) -> dict:
    analysis = analyze_khmer_text(text)
    return {
        "text": analysis.display_text,
        "parts": [
            {"text": part.text, "kind": part.kind, "word_index": part.word_index, "break_before": part.break_before}
            for part in analysis.parts
        ],
        "words": [{"text": word, "weight": weight} for word, weight in zip(analysis.words, analysis.weights)],
        "timing": "estimated",
        "pages": subtitle_pages(analysis),
    }
