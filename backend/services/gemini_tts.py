"""
Gemini 3.8 Flash TTS Engine for MoniSekha
Supports Google's high-speed speech synthesis with prebuilt voices,
expressive delivery styles (TED-Ed, Documentary, Clinical, Classroom),
and a fixed synthesis model for consistent narration.
"""
import os
import io
import time
import hashlib
import base64
import requests
import numpy as np
import soundfile as sf
import google.generativeai as genai
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from .scene_timing import write_scene_audio
from .khmer_text import prepare_tts_text

# Supported Prebuilt Voices in Gemini Flash TTS
GEMINI_VOICES: List[Dict[str, Any]] = [
    {
        "id": "Puck",
        "name": "Puck — Energetic & Bright",
        "gender": "Male",
        "tone": "Bright, enthusiastic, engaging, youthful",
        "recommended_for": "Kids education, lively explainers, science fun",
    },
    {
        "id": "Charon",
        "name": "Charon — Deep & Steady",
        "gender": "Male",
        "tone": "Deep, authoritative, resonant, calm",
        "recommended_for": "History, documentaries, serious narratives",
    },
    {
        "id": "Kore",
        "name": "Kore — Warm & Reassuring",
        "gender": "Female",
        "tone": "Warm, empathetic, clear, gentle",
        "recommended_for": "Healthcare, pharmacy, patient counseling, teacher instruction",
    },
    {
        "id": "Fenrir",
        "name": "Fenrir — Strong & Dramatic",
        "gender": "Male",
        "tone": "Bold, theatrical, commanding, powerful",
        "recommended_for": "Epic stories, motivational, ceremonies",
    },
    {
        "id": "Aoede",
        "name": "Aoede — Melodic & Articulate",
        "gender": "Female",
        "tone": "Clear, refined, inquisitive, melodic",
        "recommended_for": "STEM, tutorials, technology guides",
    },
    {
        "id": "Leda",
        "name": "Leda — Composed & Thoughtful",
        "gender": "Female",
        "tone": "Composed, gentle, articulate, reflective",
        "recommended_for": "Mindfulness, literature, storytelling",
    },
    {
        "id": "Orus",
        "name": "Orus — Balanced & Curious",
        "gender": "Male",
        "tone": "Crisp, curious, conversational, modern",
        "recommended_for": "TED-Ed style lessons, general explainers",
    },
    {
        "id": "Zephyr",
        "name": "Zephyr — Friendly & Natural",
        "gender": "Female",
        "tone": "Natural, upbeat, easygoing, friendly",
        "recommended_for": "Everyday conversations, classroom activities",
    },
]

# Preset Delivery Styles
GEMINI_STYLES: List[Dict[str, str]] = [
    {
        "id": "ted_ed",
        "name": "🎓 TED-Ed Style",
        "prompt": "TED-Ed animated lesson style: Inquisitive, articulate, captivating storytelling, rhythmic educational pacing, engaging inflections.",
    },
    {
        "id": "documentary",
        "name": "🎙️ Documentary Narrator",
        "prompt": "National Geographic documentary narrator style: Deep, cinematic, contemplative, measured and authoritative pacing.",
    },
    {
        "id": "clinical",
        "name": "💊 Clinical / Pharmacist",
        "prompt": "Healthcare clinical educator style: Calm, reassuring, precise, caring patient counseling delivery with clear scientific enunciation.",
    },
    {
        "id": "classroom",
        "name": "🏫 Teacher / Classroom",
        "prompt": "Enthusiastic classroom teacher style: Warm, encouraging, clear instructional delivery, friendly pacing for students.",
    },
    {
        "id": "conversational",
        "name": "☕ Conversational & Friendly",
        "prompt": "Casual conversational style: Friendly, warm, relaxed everyday chat directly speaking to the listener.",
    },
    {
        "id": "energetic",
        "name": "⚡ High-Energy Presenter",
        "prompt": "Dynamic presenter style: Upbeat, fast-paced, spirited, inspiring and high energy.",
    },
]

# Keep previews and all scenes on the same acoustic model. A failed request
# must not silently change the narrator by switching model families.
TTS_MODEL_NAME = "gemini-3.8-flash-tts"

_STYLE_DELIVERY = {
    "ted_ed": "curious, articulate, measured pacing",
    "documentary": "calm, measured, authoritative",
    "clinical": "calm, reassuring, precise",
    "classroom": "warm, encouraging, clear",
    "conversational": "friendly, relaxed, conversational",
    "energetic": "upbeat, lively, brisk pacing",
}


def resolve_style_prompt(style_id_or_prompt: Optional[str]) -> str:
    """Returns the descriptive style direction prompt for Gemini TTS."""
    if not style_id_or_prompt or not style_id_or_prompt.strip():
        return _STYLE_DELIVERY[GEMINI_STYLES[0]["id"]]

    cleaned = style_id_or_prompt.strip()
    for preset in GEMINI_STYLES:
        if cleaned in (preset["id"], preset["prompt"]):
            return _STYLE_DELIVERY[preset["id"]]

    # Custom style prompt entered directly by user
    return cleaned


def resolve_gemini_api_key(db_session: Optional[Session] = None) -> str:
    """Resolves active Gemini API key from database Setting or environment variables."""
    from ..database import Setting

    slot = 1
    if db_session is not None:
        try:
            setting = db_session.query(Setting).first()
            if setting and setting.active_slot:
                slot = setting.active_slot
        except Exception:
            pass

    key_name = f"GEMINI_KEY_{slot}"
    api_key = (
        os.environ.get(key_name)
        or os.environ.get("GEMINI_API_KEY")
        or os.environ.get("GEMINI_KEY_1")
        or os.environ.get("GEMINI_KEY_2")
    )
    if not api_key:
        raise ValueError(
            "Gemini API Key is not set. Please set GEMINI_KEY_1 or configure Engine Settings in the sidebar."
        )
    return api_key


def trim_silence(audio_data: np.ndarray, sample_rate: int, threshold: float = 0.005) -> np.ndarray:
    """Trims excessive leading and trailing silence from generated speech."""
    if len(audio_data) == 0:
        return audio_data
    is_speech = np.abs(audio_data) > threshold
    indices = np.nonzero(is_speech)[0]
    if len(indices) == 0:
        return audio_data

    lead_in_frames = int(0.04 * sample_rate)  # 40ms lead-in
    trail_frames = int(0.06 * sample_rate)    # 60ms cushion
    start_idx = max(0, indices[0] - lead_in_frames)
    end_idx = min(len(audio_data), indices[-1] + trail_frames)
    return audio_data[start_idx:end_idx]


def _generate_styled_audio(model_name: str, api_key: str, text: str,
                           style: str, voice: str) -> tuple[bytes, str]:
    if model_name.startswith("gemini-3.8-"):
        # 3.8 reads text verbatim. Delivery directions belong in annotations,
        # never in the spoken transcript (including labels or quotation marks).
        response = requests.post(
            "https://generativelanguage.googleapis.com/v1beta/interactions",
            headers={"x-goog-api-key": api_key},
            json={
                "model": model_name,
                "input": [{"type": "user_input", "content": [{
                    "type": "text", "text": text,
                    "annotations": [{"type": "speech_metadata", "style": style}],
                }]}],
                "response_format": {"type": "audio"},
                "generation_config": {"speech_config": [{"voice": voice}]},
            },
            timeout=180,
        )
        response.raise_for_status()
        for step in reversed(response.json().get("steps", [])):
            if step.get("type") == "model_output":
                for part in reversed(step.get("content", [])):
                    if part.get("type") == "audio" and part.get("data"):
                        return base64.b64decode(part["data"]), "audio/wav"
    else:
        # Older TTS models use a structured natural-language performance prompt.
        prompt = (
            "Synthesize only the transcript below, in its original language. "
            "Do not speak headings or performance directions.\n\n"
            f"### DIRECTOR'S NOTES\n{style}\n\n"
            f"#### TRANSCRIPT\n{text}"
        )
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name)
        response = model.generate_content(prompt, generation_config={
            "response_modalities": ["AUDIO"],
            "speech_config": {"voice_config": {
                "prebuilt_voice_config": {"voice_name": voice},
            }},
        })
        for part in response.parts or []:
            inline_data = getattr(part, "inline_data", None)
            if inline_data and inline_data.data:
                return inline_data.data, inline_data.mime_type
    raise RuntimeError(f"{model_name} returned no audio.")


def synthesize_gemini_speech(
    text: str,
    voice_name: str = "Puck",
    style_direction: Optional[str] = "ted_ed",
    db_session: Optional[Session] = None,
) -> tuple[np.ndarray, int]:
    """
    Synthesizes speech using Google Gemini Flash TTS with style direction.
    Returns (audio_numpy_float32, sample_rate).
    """
    clean_text = text.strip()
    if not clean_text:
        raise ValueError("Cannot synthesize empty text.")

    # Prepare Khmer text with word-boundary awareness if containing Khmer script
    has_khmer = any("\u1780" <= ch <= "\u17ff" for ch in clean_text)
    prepared_text = prepare_tts_text(clean_text) if has_khmer else clean_text

    resolved_style = resolve_style_prompt(style_direction)

    primary_api_key = resolve_gemini_api_key(db_session)
    if not any(v["id"] == voice_name for v in GEMINI_VOICES):
        raise ValueError(f"Unknown Gemini voice: {voice_name}. Select a supported voice.")
    voice_target = voice_name

    try:
        audio_bytes, mime_type = _generate_styled_audio(
            TTS_MODEL_NAME, primary_api_key, prepared_text, resolved_style, voice_target,
        )
        if mime_type.lower().startswith("audio/l16"):
            # Legacy Gemini TTS returns headerless, little-endian PCM16.
            rate = next((p.split("=", 1)[1] for p in mime_type.split(";")
                         if p.strip().startswith("rate=")), "24000")
            sample_rate = int(rate)
            audio_data = np.frombuffer(audio_bytes, dtype="<i2").astype(np.float32) / 32768.0
        else:
            audio_data, sample_rate = sf.read(io.BytesIO(audio_bytes), dtype="float32")
        if audio_data.ndim > 1:
            audio_data = np.mean(audio_data, axis=1)
        return trim_silence(audio_data, sample_rate), sample_rate
    except Exception as exc:
        raise RuntimeError(
            f"Gemini TTS failed using {TTS_MODEL_NAME}. Retry this line; "
            "the model was kept unchanged to preserve the narrator's voice."
        ) from exc


def generate_gemini_scene_audio(
    text: str,
    project_slug: str,
    scene_number: int,
    voice_name: str = "Puck",
    style_direction: Optional[str] = "ted_ed",
    audio_format: str = "wav",
    db_session: Optional[Session] = None,
) -> str:
    """
    Generates audio for an individual scene using Gemini TTS and saves it into the project workspace.
    Returns the absolute file path of the saved audio file.
    """
    workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "workspace"))
    project_dir = os.path.join(workspace_dir, project_slug)
    os.makedirs(project_dir, exist_ok=True)

    samples, sample_rate = synthesize_gemini_speech(
        text=text,
        voice_name=voice_name,
        style_direction=style_direction,
        db_session=db_session,
    )

    fmt = (audio_format or "wav").lower()
    save_path = os.path.join(project_dir, f"scene_{scene_number:03d}.{fmt}")

    # Use write_scene_audio to atomically save and validate duration
    write_scene_audio(save_path, samples, sample_rate)
    return save_path


def generate_gemini_preview(
    voice_name: str = "Puck",
    style_direction: Optional[str] = "ted_ed",
    sample_text: Optional[str] = None,
    db_session: Optional[Session] = None,
) -> str:
    """
    Generates a preview audio clip for auditioning voice and delivery style.
    Returns the workspace-relative path of the preview audio file.
    """
    workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "workspace"))
    previews_dir = os.path.join(workspace_dir, "previews")
    os.makedirs(previews_dir, exist_ok=True)

    default_text = (
        sample_text
        if sample_text and sample_text.strip()
        else "សួស្តី! នេះជាសំឡេងគំរូរបស់ប្រព័ន្ធ Gemini TTS សម្រាប់វីដេអូអប់រំ MoniSekha។"
    )

    samples, sample_rate = synthesize_gemini_speech(
        text=default_text,
        voice_name=voice_name,
        style_direction=style_direction,
        db_session=db_session,
    )

    style_slug = hashlib.md5(f"{voice_name}_{style_direction}".encode()).hexdigest()[:8]
    filename = f"preview_gemini_{voice_name.lower()}_{style_slug}.wav"
    save_path = os.path.join(previews_dir, filename)

    sf.write(save_path, samples, sample_rate)
    return os.path.relpath(save_path, workspace_dir).replace("\\", "/")
