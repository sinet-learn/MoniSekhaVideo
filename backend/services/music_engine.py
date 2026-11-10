"""Local background-music generation with MusicGen (Hugging Face transformers).

The model is loaded for one request and released straight after, so it never sits
in memory next to the voice or image models.
"""
import gc
import os
import threading

import numpy as np
import soundfile as sf
import torch

MODEL_NAME = os.getenv("MUSICGEN_MODEL_NAME", "facebook/musicgen-small")
SEGMENT_SECONDS = 20  # one generation pass; longer requests are looped with a crossfade
CROSSFADE_SECONDS = 2.0
TOKENS_PER_SECOND = 50  # MusicGen frame rate

_LOCK = threading.Lock()

STYLE_SUFFIX = "instrumental, no vocals, steady background music, no sudden changes"


def _device() -> str:
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def _loop_to_length(audio: np.ndarray, sample_rate: int, seconds: float) -> np.ndarray:
    """Tile `audio` to `seconds` with equal-power crossfades at each seam."""
    target = int(seconds * sample_rate)
    if len(audio) >= target:
        return audio[:target]
    fade = min(int(CROSSFADE_SECONDS * sample_rate), len(audio) // 2)
    ramp = np.linspace(0.0, np.pi / 2, fade, dtype=np.float32)
    fade_in, fade_out = np.sin(ramp), np.cos(ramp)
    out = audio.copy()
    while len(out) < target:
        out[-fade:] = out[-fade:] * fade_out + audio[:fade] * fade_in
        out = np.concatenate((out, audio[fade:]))
    return out[:target]


def generate_music(prompt: str, duration: float, output_path: str) -> str:
    """Write a `duration`-second WAV for `prompt` to `output_path`."""
    from transformers import AutoProcessor, MusicgenForConditionalGeneration

    with _LOCK:
        device = _device()
        model = None
        try:
            processor = AutoProcessor.from_pretrained(MODEL_NAME)
            model = MusicgenForConditionalGeneration.from_pretrained(MODEL_NAME).to(device)
            inputs = processor(text=[f"{prompt.strip()}, {STYLE_SUFFIX}"], padding=True, return_tensors="pt").to(device)
            segment = min(float(duration), SEGMENT_SECONDS)
            with torch.no_grad():
                tokens = model.generate(**inputs, do_sample=True, guidance_scale=3.0,
                                        max_new_tokens=int(segment * TOKENS_PER_SECOND))
            sample_rate = model.config.audio_encoder.sampling_rate
            audio = tokens[0, 0].float().cpu().numpy()
        finally:
            del model
            gc.collect()
            if torch.backends.mps.is_available():
                torch.mps.empty_cache()
            elif torch.cuda.is_available():
                torch.cuda.empty_cache()

    peak = float(np.max(np.abs(audio))) or 1.0
    audio = _loop_to_length(audio / peak * 0.9, sample_rate, float(duration))
    fade = int(1.5 * sample_rate)  # soft start and end so clips never click
    audio[:fade] *= np.linspace(0.0, 1.0, min(fade, len(audio)), dtype=np.float32)
    audio[-fade:] *= np.linspace(1.0, 0.0, min(fade, len(audio)), dtype=np.float32)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    sf.write(output_path, audio, sample_rate)
    return output_path
