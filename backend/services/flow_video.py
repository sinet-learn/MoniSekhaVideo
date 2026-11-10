"""Text-to-video and image-to-video through the installed gflow CLI; never auto-retry paid jobs."""
import os
import json
import subprocess
import tempfile
from pathlib import Path

import imageio_ffmpeg

from . import flow_engine
from .scene_timing import validate_scene_duration

VIDEO_MODELS = (
    "veo-lite", "veo-fast", "veo-quality", "veo-lite-lp",
    "omni-flash", "omni-1.2-flash", "omni-1.2",
)


def format_generation_error(stdout: str, stderr: str, *, image_input: bool = False) -> str:
    """Extract the provider's problem detail without exposing its JSON log envelope."""
    combined = f"{stdout}\n{stderr}"
    lowered = combined.lower()
    # Older errors can start in the middle of a JSON log after truncation.
    if "flowhostmigratederror" in lowered or "flow-host-migrated" in lowered:
        if image_input or "video i2v" in lowered or "i2v is not ported" in lowered:
            return (
                "This Flow account's interface does not support image-to-video through the installed integration. "
                "Choose Animated video in Brainstorming to generate directly from the video prompt."
            )
        return (
            "The installed Flow integration does not support this request on your account's interface. "
            "Check the Flow project before retrying."
        )

    def problem_detail(value):
        if not isinstance(value, dict):
            return None
        problem = value.get("problem")
        if isinstance(problem, dict):
            return problem.get("detail") or problem.get("title")
        error = value.get("error")
        if isinstance(error, dict):
            return problem_detail(error) or error.get("detail") or error.get("message")
        if value.get("type") and value.get("title"):
            return value.get("detail") or value["title"]
        return None

    # Prefer structured stdout results over stderr warnings such as cookie-seed
    # diagnostics; also support pretty JSON and newline-delimited JSON logs.
    for output in (stdout, stderr):
        candidates = [output, *reversed(output.splitlines())]
        for candidate in candidates:
            try:
                detail = problem_detail(json.loads(candidate))
            except (ValueError, TypeError):
                continue
            if isinstance(detail, str) and detail.strip():
                return f"Flow video generation failed: {detail.strip()[:600]}"
    plain = (stderr or stdout).strip()
    if not plain or "{" in plain or "}" in plain:
        return "Flow could not generate this video. Check your Flow account and project before retrying."
    return f"Flow video generation failed: {plain[:600]}"


def generate_scene_video(image_path: str | None, prompt: str, output_path: str,
                         aspect_ratio: str = "16:9", model: str = "veo-lite",
                         flow_project_id: str = None, duration: float | None = None) -> str:
    """Replace the previous scene clip only after a new MP4 decodes successfully."""
    if duration is not None:
        validate_scene_duration(duration)
    image = Path(image_path).resolve() if image_path else None
    output = Path(output_path).resolve()
    if image is not None and not image.is_file():
        raise ValueError("The scene image is missing. Generate or upload an image first.")
    if aspect_ratio not in ("16:9", "9:16"):
        raise ValueError("Flow animation supports 16:9 and 9:16 projects.")
    if model not in VIDEO_MODELS:
        raise ValueError("Unsupported Flow video model.")
    if not prompt.strip():
        raise ValueError("Enter a motion prompt.")

    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="_flow_video_", dir=output.parent) as temp_dir:
        candidate = Path(temp_dir) / "clip.mp4"
        command = [
            flow_engine.GFLOW_BIN, "video", "i2v" if image is not None else "t2v",
            "--aspect", aspect_ratio, "--model", model, "--count", "1",
            "--output", str(candidate), "--profile", flow_engine.DEFAULT_PROFILE,
            "--json",
        ]
        if image is not None:
            command.extend(["--initial-frame", str(image)])
        project_id = flow_project_id or os.getenv("FLOW_PROJECT_ID")
        if project_id:
            command.extend(["--project", project_id])
        else:
            command.extend(["--project-name", f"MoniSekha_{output.parent.name}"])
        # '--' keeps a prompt beginning with '-' from being parsed as CLI options.
        generation_prompt = prompt.strip()
        if duration is not None:
            generation_prompt += f" Complete the action in approximately {duration:.2f} seconds, with no speech or captions."
        command.extend(["--", generation_prompt])
        try:
            result = subprocess.run(command, capture_output=True, text=True, timeout=1200)
        except FileNotFoundError as exc:
            raise RuntimeError("gflow is unavailable. Configure GFLOW_BIN or install gflow-cli.") from exc
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError(
                "Flow did not finish within 20 minutes. Check Flow for a submitted clip before retrying."
            ) from exc
        if result.returncode:
            raise RuntimeError(format_generation_error(result.stdout, result.stderr, image_input=image is not None))
        if not candidate.is_file() or candidate.stat().st_size < 1000:
            raise RuntimeError("Flow returned no usable MP4. Check the Flow project before retrying.")
        validation = subprocess.run([
            imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-xerror",
            "-i", str(candidate), "-map", "0:v:0", "-frames:v", "1", "-f", "null", "-",
        ], capture_output=True, text=True, timeout=30)
        if validation.returncode:
            raise RuntimeError("Flow returned an invalid video. Your previous scene clip was kept.")
        if duration is not None:
            _, source_duration = imageio_ffmpeg.count_frames_and_secs(str(candidate))
            if source_duration <= 0:
                raise RuntimeError("Flow returned a video with no measurable duration.")
            fitted = Path(temp_dir) / "timed.mp4"
            timing = subprocess.run([
                imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-v", "error", "-i", str(candidate),
                "-vf", f"setpts=(PTS-STARTPTS)*{duration/source_duration:.9f},fps=30,tpad=stop_mode=clone:stop_duration={duration:.6f},trim=duration={duration:.6f}",
                "-t", f"{duration:.6f}", "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", str(fitted),
            ], capture_output=True, text=True, timeout=120)
            if timing.returncode:
                raise RuntimeError("Could not fit the animation to its narration. Your previous scene clip was kept.")
            candidate = fitted
        os.replace(candidate, output)
    return str(output)
