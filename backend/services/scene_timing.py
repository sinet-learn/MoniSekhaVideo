"""Shared timing rules for voice, animation and export."""
import os
import math
import tempfile
import soundfile as sf

def validate_scene_duration(duration: float) -> float:
    if not math.isfinite(duration) or duration <= 0:
        raise ValueError("The scene voiceover has no measurable duration. Generate its voiceover first.")
    return duration


def ready_voice_duration(scene, project, workspace: str) -> float:
    if scene.audio_status != "completed":
        raise ValueError("Generate an up-to-date voiceover first so animation can match its duration.")
    paths = []
    if scene.audio_path:
        paths.append(os.path.join(workspace, scene.audio_path))
    paths.append(os.path.join(workspace, project.slug, f"scene_{scene.scene_number:03d}.{project.audio_format or 'wav'}"))
    for path in paths:
        if os.path.isfile(path):
            try:
                return validate_scene_duration(float(sf.info(path).duration))
            except RuntimeError as exc:
                raise ValueError("Could not read this voiceover. Generate it again before animating.") from exc
    raise ValueError("Generate this scene's voiceover first so animation can match its duration.")


def write_scene_audio(path: str, samples, sample_rate: int) -> None:
    """Keep an existing recording until the new one has a valid measured duration."""
    validate_scene_duration(len(samples) / sample_rate)
    descriptor, temporary = tempfile.mkstemp(suffix=os.path.splitext(path)[1], dir=os.path.dirname(path))
    os.close(descriptor)
    try:
        sf.write(temporary, samples, sample_rate)
        validate_scene_duration(float(sf.info(temporary).duration))
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.remove(temporary)
