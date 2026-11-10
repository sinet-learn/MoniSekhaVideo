import os
import gc
import hashlib
from .scene_timing import write_scene_audio
from .khmer_text import prepare_tts_text
import asyncio
import threading
import time
import torch
import soundfile as sf
import numpy as np

try:
    from voxcpm import VoxCPM
except ImportError:
    VoxCPM = None

_MODEL_STATE = "unloaded"
_VOXCPM_MODEL = None
_LOADED_LANGUAGE = None
_UNLOAD_TASK = None
_LAST_ACTIVITY_TIME = time.time()
_LOAD_LOCK = threading.Lock()
_CHARACTER_REFERENCE_LOCK = threading.Lock()
_MAIN_EVENT_LOOP = None

def get_model_download_progress():
    """Extracts live Hugging Face download progress for VoxCPM2 weights."""
    total_bytes = 4580080592  # 4.58 GB
    xet_log_dir = os.path.expanduser("~/.cache/huggingface/xet/logs")
    if os.path.exists(xet_log_dir):
        import glob
        import re
        logs = sorted(glob.glob(os.path.join(xet_log_dir, "xet_*.log")), key=os.path.getmtime, reverse=True)
        if logs:
            latest = logs[0]
            try:
                with open(latest, "rb") as f:
                    f.seek(max(0, os.path.getsize(latest) - 8192))
                    lines = f.read().decode("utf-8", errors="ignore").splitlines()
                    for line in reversed(lines):
                        if "observed bytes sent so far" in line:
                            m = re.search(r"observed bytes sent so far = (\d+)", line)
                            if m:
                                cur = int(m.group(1))
                                pct = min(99, int((cur / total_bytes) * 100))
                                return {
                                    "is_downloading": True,
                                    "downloaded_bytes": cur,
                                    "total_bytes": total_bytes,
                                    "percent": pct,
                                    "downloaded_str": f"{cur / (1024**3):.2f} GB",
                                    "total_str": f"{total_bytes / (1024**3):.2f} GB"
                                }
            except Exception:
                pass
    return None

KHMER_SEED_TEXT = "កាលពី ១ម៉ឺនឆ្នាំមុន មនុស្សសម័យបុរេប្រវត្តិ បានរកឃើញអាថ៌កំបាំងមួយយ៉ាងអស្ចារ្យ។"
ENGLISH_SEED_TEXT = "Ten thousand years ago, early humans made a remarkable discovery that would change everything."


def detect_language(text: str) -> str:
    """'km' when the text contains any Khmer script, otherwise 'en'."""
    return "km" if any("\u1780" <= ch <= "\u17ff" for ch in text or "") else "en"


def _model_name(language: str) -> str:
    if language == "en":
        return os.getenv("VOXCPM_EN_MODEL_NAME", "openbmb/VoxCPM2")
    return os.getenv("VOXCPM_MODEL_NAME", "ravuthz/VoxCPM2-khmer")


def _seed_text(language: str) -> str:
    return ENGLISH_SEED_TEXT if language == "en" else KHMER_SEED_TEXT


def _prepare_text(text: str, language: str) -> str:
    return " ".join(text.split()) if language == "en" else prepare_tts_text(text)


def set_event_loop(loop):
    global _MAIN_EVENT_LOOP
    _MAIN_EVENT_LOOP = loop

def load_model(language: str = "km") -> bool:
    """Load the model for `language`, swapping out a different one first (one model in memory at a time)."""
    global _MODEL_STATE, _VOXCPM_MODEL, _LAST_ACTIVITY_TIME, _LOADED_LANGUAGE
    with _LOAD_LOCK:
        _LAST_ACTIVITY_TIME = time.time()

        if _MODEL_STATE == "loaded" and _VOXCPM_MODEL is not None:
            if _LOADED_LANGUAGE in (None, language):
                _cancel_unload_task()
                return True
            _unload_locked()

        _MODEL_STATE = "loading"
        print("Loading VoxCPM Model into Unified Memory...")
        try:
            if VoxCPM is not None:
                model_name = _model_name(language)
                print(f"Loading VoxCPM model from: {model_name}...")
                _VOXCPM_MODEL = VoxCPM.from_pretrained(model_name, load_denoiser=False)
            else:
                print("voxcpm module not found, mocking load.")
                _VOXCPM_MODEL = "MockModelData"
            _MODEL_STATE = "loaded"
            _LOADED_LANGUAGE = language
            print("VoxCPM Model loaded successfully.")
        except Exception as e:
            _MODEL_STATE = "unloaded"
            _VOXCPM_MODEL = None
            _LOADED_LANGUAGE = None
            print(f"Failed to load VoxCPM Model: {e}")
            raise e

        _cancel_unload_task()
        return True

def _cancel_unload_task():
    global _UNLOAD_TASK
    if _UNLOAD_TASK is not None:
        try:
            _UNLOAD_TASK.cancel()
        except Exception:
            pass
        _UNLOAD_TASK = None

async def _idle_unloader():
    while True:
        await asyncio.sleep(10)  # check periodically
        # Keep model warm for 10 minutes (600s) after last synthesis activity
        if _MODEL_STATE == "loaded" and (time.time() - _LAST_ACTIVITY_TIME) >= 600:
            unload_model()
            break

async def _schedule_on_loop():
    global _UNLOAD_TASK
    _cancel_unload_task()
    _UNLOAD_TASK = asyncio.create_task(_idle_unloader())

def schedule_unload():
    global _UNLOAD_TASK, _MAIN_EVENT_LOOP
    _cancel_unload_task()
    try:
        loop = None
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = _MAIN_EVENT_LOOP
            
        if loop and loop.is_running():
            asyncio.run_coroutine_threadsafe(_schedule_on_loop(), loop)
    except Exception as e:
        print(f"Failed to schedule unload task: {e}")

def _unload_locked() -> bool:
    global _MODEL_STATE, _VOXCPM_MODEL, _LOADED_LANGUAGE
    if _MODEL_STATE == "unloaded":
        return True

    _MODEL_STATE = "unloading"
    print("Unloading VoxCPM Model to recover Unified Memory...")
    _VOXCPM_MODEL = None
    _LOADED_LANGUAGE = None

    # Explicit garbage collection
    gc.collect()

    # PyTorch device cache flusher
    if torch.backends.mps.is_available():
        torch.mps.empty_cache()
        print("MPS cache cleared.")
    elif torch.cuda.is_available():
        torch.cuda.empty_cache()
        print("CUDA cache cleared.")

    _MODEL_STATE = "unloaded"
    return True


def unload_model() -> bool:
    with _LOAD_LOCK:
        return _unload_locked()

def trim_audio_silence(
    audio_data: np.ndarray,
    sample_rate: int,
    threshold: float = 0.01,
    lead_in_ms: float = 45.0,
    trail_cushion_ms: float = 50.0
) -> np.ndarray:
    """
    Trims leading dead air and trailing silence from generated speech audio,
    preserving a clean lead_in buffer (default 45ms) before speech onset
    and a trailing cushion (default 50ms) after speech ends.
    """
    if len(audio_data) == 0:
        return audio_data

    is_speech = np.abs(audio_data) > threshold
    indices = np.nonzero(is_speech)[0]
    if len(indices) == 0:
        return audio_data

    first_speech_idx = indices[0]
    last_speech_idx = indices[-1]

    lead_in_frames = int((lead_in_ms / 1000.0) * sample_rate)
    trail_frames = int((trail_cushion_ms / 1000.0) * sample_rate)

    start_idx = max(0, first_speech_idx - lead_in_frames)
    end_idx = min(len(audio_data), last_speech_idx + trail_frames)

    return audio_data[start_idx:end_idx]

def generate_scene_audio_chunk(text: str, project_slug: str, profile_tag: str, scene_number: int, audio_format: str = "wav", cfg_value: float = 2.0, inference_steps: int = 15):
    global _MODEL_STATE, _LAST_ACTIVITY_TIME, _VOXCPM_MODEL
    
    language = detect_language(text)
    load_model(language)
        
    _LAST_ACTIVITY_TIME = time.time()
    
    workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "workspace"))
    project_dir = os.path.join(workspace_dir, project_slug)
    os.makedirs(project_dir, exist_ok=True)
    
    seed_path = os.path.join(project_dir, f"voice_profile_{hashlib.sha256((f'{profile_tag}|{cfg_value}|{inference_steps}' + ('|en' if language == 'en' else '')).encode('utf-8')).hexdigest()[:16]}.wav")
    seed_text = _seed_text(language)
    
    sample_rate = _VOXCPM_MODEL.tts_model.sample_rate if hasattr(_VOXCPM_MODEL, 'tts_model') and hasattr(_VOXCPM_MODEL.tts_model, 'sample_rate') else 22050
    
    # 1. Automated Voice Seed Profile Creation
    if not os.path.exists(seed_path):
        print(f"Generating Voice Design Seed Profile for {project_slug}...")
        if VoxCPM is not None and hasattr(_VOXCPM_MODEL, 'generate'):
            # Real model call
            design_prompt = f"{profile_tag}{_prepare_text(seed_text, language)}"
            seed_audio = _VOXCPM_MODEL.generate(
                text=design_prompt,
                cfg_value=cfg_value,
                inference_timesteps=inference_steps
            )
        else:
            # Mock audio for testing
            duration = 1.0
            t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
            seed_audio = 0.5 * np.sin(2 * np.pi * 440 * t)
            
        # Normalize seed audio
        seed_audio_data = np.array(seed_audio, dtype=np.float32)
        seed_max = np.max(np.abs(seed_audio_data))
        if seed_max > 0:
            seed_audio_data = seed_audio_data / seed_max
        seed_audio_data = np.clip(seed_audio_data, -1.0, 1.0)

        try:
            sf.write(seed_path, seed_audio_data, sample_rate)
        except Exception as e:
            print(f"Failed to write seed audio: {e}")

    # 2. Text Preparation & Punctuation Context
    text = text.strip()
    sentence_terminators = ("។", "៕", "!", "?", ".", "…")
    is_sentence_end = any(text.endswith(p) for p in sentence_terminators)
        
    if VoxCPM is not None and hasattr(_VOXCPM_MODEL, 'generate'):
        raw_audio = _VOXCPM_MODEL.generate(
            text=_prepare_text(text, language),
            prompt_wav_path=seed_path,
            prompt_text=_prepare_text(seed_text, language),
            cfg_value=cfg_value,
            inference_timesteps=inference_steps
        )
    else:
        duration = 1.5
        t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
        raw_audio = 0.5 * np.sin(2 * np.pi * 440 * t)

    # Audio Normalization and Clipping
    audio_data = np.array(raw_audio, dtype=np.float32)
    max_amp = np.max(np.abs(audio_data))
    if max_amp > 0:
        audio_data = audio_data / max_amp
    audio_data = np.clip(audio_data, -1.0, 1.0)

    # 3. Trim Leading Dead Air & Trailing Decay
    # Preserves a clean 45ms lead-in buffer and a 50ms trailing cushion
    audio_data = trim_audio_silence(audio_data, sample_rate, threshold=0.01, lead_in_ms=45.0, trail_cushion_ms=50.0)

    # 4. Contextual Trailing Silence Padding
    # Complete sentence: add extra 0.15s pause (50ms + 150ms = 200ms total trailing silence; ~245ms gap to next speech).
    # Mid-sentence break (phrases cut in half by Enter): add extra 0.095s pause (50ms + 95ms = 145ms trailing silence;
    # ~190ms natural clause/comma gap to next speech, giving comfortable breathing room without breaking momentum).
    if is_sentence_end:
        extra_silence_frames = int(0.150 * sample_rate)
    else:
        extra_silence_frames = int(0.095 * sample_rate)
        
    extra_silence = np.zeros(extra_silence_frames, dtype=np.float32)
    padded_audio = np.concatenate((audio_data, extra_silence))
    
    # Flattened path layout
    padded_scene_number = f"{int(scene_number):03d}"
    extension = "mp3" if audio_format.lower() == "mp3" else "wav"
    save_path = os.path.join(project_dir, f"scene_{padded_scene_number}.{extension}")
    
    schedule_unload()
    write_scene_audio(save_path, padded_audio, sample_rate)

    _LAST_ACTIVITY_TIME = time.time()
    schedule_unload()
    return save_path

def generate_single_scene_audio(text: str, project_slug: str, scene_number: int, reference_audio_path: str = None, reference_text: str = None, audio_format: str = "wav", profile_tag: str = "(Male, Adult, Documentary tone, Normal speed)", cfg_value: float = 2.0, inference_steps: int = 15):
    global _MODEL_STATE, _LAST_ACTIVITY_TIME, _VOXCPM_MODEL
    
    language = detect_language(text)
    load_model(language)
        
    _LAST_ACTIVITY_TIME = time.time()
    
    workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "workspace"))
    project_dir = os.path.join(workspace_dir, project_slug)
    os.makedirs(project_dir, exist_ok=True)
    
    sample_rate = _VOXCPM_MODEL.tts_model.sample_rate if hasattr(_VOXCPM_MODEL, 'tts_model') and hasattr(_VOXCPM_MODEL.tts_model, 'sample_rate') else 22050
    
    if reference_audio_path and reference_text and os.path.exists(reference_audio_path):
        seed_path = reference_audio_path
        seed_text = reference_text
    else:
        seed_path = os.path.join(project_dir, f"voice_profile_{hashlib.sha256((f'{profile_tag}|{cfg_value}|{inference_steps}' + ('|en' if language == 'en' else '')).encode('utf-8')).hexdigest()[:16]}.wav")
        seed_text = _seed_text(language)
        if not os.path.exists(seed_path):
            print(f"Auto-generating Voice Design Seed Profile for single scene in {project_slug}...")
            if VoxCPM is not None and hasattr(_VOXCPM_MODEL, 'generate'):
                tag = profile_tag or "(Male, Adult, Documentary tone, Normal speed)"
                design_prompt = f"{tag}{_prepare_text(seed_text, language)}"
                seed_audio = _VOXCPM_MODEL.generate(
                    text=design_prompt,
                    cfg_value=cfg_value,
                    inference_timesteps=inference_steps
                )
            else:
                duration = 1.0
                t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
                seed_audio = 0.5 * np.sin(2 * np.pi * 440 * t)
                
            seed_audio_data = np.array(seed_audio, dtype=np.float32)
            seed_max = np.max(np.abs(seed_audio_data))
            if seed_max > 0:
                seed_audio_data = seed_audio_data / seed_max
            seed_audio_data = np.clip(seed_audio_data, -1.0, 1.0)
            try:
                sf.write(seed_path, seed_audio_data, sample_rate)
            except Exception as e:
                print(f"Failed to write single scene seed audio: {e}")
    
    text = text.strip()
    sentence_terminators = ("។", "៕", "!", "?", ".", "…")
    is_sentence_end = any(text.endswith(p) for p in sentence_terminators)
        
    if VoxCPM is not None and hasattr(_VOXCPM_MODEL, 'generate'):
        raw_audio = _VOXCPM_MODEL.generate(
            text=_prepare_text(text, language),
            prompt_wav_path=seed_path,
            prompt_text=_prepare_text(seed_text, detect_language(seed_text)),
            cfg_value=cfg_value,
            inference_timesteps=inference_steps
        )
    else:
        duration = 1.5
        t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
        raw_audio = 0.5 * np.sin(2 * np.pi * 440 * t)

    audio_data = np.array(raw_audio, dtype=np.float32)
    max_amp = np.max(np.abs(audio_data))
    if max_amp > 0:
        audio_data = audio_data / max_amp
    audio_data = np.clip(audio_data, -1.0, 1.0)

    # Trim leading dead air & trailing decay
    audio_data = trim_audio_silence(audio_data, sample_rate, threshold=0.01, lead_in_ms=45.0, trail_cushion_ms=50.0)

    # Contextual Trailing Silence Padding
    # Complete sentence: add extra 0.15s pause (50ms + 150ms = 200ms total trailing silence; ~245ms gap to next speech).
    # Mid-sentence break (phrases cut in half by Enter): add extra 0.095s pause (50ms + 95ms = 145ms trailing silence;
    # ~190ms natural clause/comma gap to next speech, giving comfortable breathing room without breaking momentum).
    if is_sentence_end:
        extra_silence_frames = int(0.150 * sample_rate)
    else:
        extra_silence_frames = int(0.095 * sample_rate)
        
    extra_silence = np.zeros(extra_silence_frames, dtype=np.float32)
    padded_audio = np.concatenate((audio_data, extra_silence))
    
    padded_scene_number = f"{int(scene_number):03d}"
    extension = "mp3" if audio_format.lower() == "mp3" else "wav"
    save_path = os.path.join(project_dir, f"scene_{padded_scene_number}.{extension}")
    
    schedule_unload()
    write_scene_audio(save_path, padded_audio, sample_rate)

    _LAST_ACTIVITY_TIME = time.time()
    schedule_unload()
    return save_path

def compile_master_voiceover(project_id: int, db_session):
    from ..database import Scene, Project
    
    project = db_session.query(Project).filter(Project.id == project_id).first()
    if not project:
        print(f"compile_master_voiceover: Project {project_id} not found.")
        return
        
    scenes = db_session.query(Scene).filter(Scene.project_id == project_id).order_by(Scene.scene_number.asc()).all()
    if not scenes:
        print(f"compile_master_voiceover: No scenes found for project {project_id}.")
        return

    workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "workspace"))
    extension = "mp3" if (project.audio_format and project.audio_format.lower() == "mp3") else "wav"
    
    # 1. First pass: determine base sample rate from the first existing audio segment
    base_sample_rate = 22050
    for scene in scenes:
        cand_path = None
        if scene.audio_path:
            p = os.path.join(workspace_dir, scene.audio_path)
            if os.path.exists(p):
                cand_path = p
        if not cand_path:
            padded = f"{int(scene.scene_number):03d}"
            p = os.path.join(workspace_dir, project.slug, f"scene_{padded}.{extension}")
            if os.path.exists(p):
                cand_path = p
        if cand_path:
            try:
                info = sf.info(cand_path)
                if info.samplerate > 0:
                    base_sample_rate = info.samplerate
                    break
            except Exception:
                pass

    segments = []
    has_real_audio = False
    
    for scene in scenes:
        cand_path = None
        if scene.audio_path:
            p = os.path.join(workspace_dir, scene.audio_path)
            if os.path.exists(p):
                cand_path = p
        if not cand_path:
            padded = f"{int(scene.scene_number):03d}"
            p = os.path.join(workspace_dir, project.slug, f"scene_{padded}.{extension}")
            if os.path.exists(p):
                cand_path = p
                
        if cand_path:
            try:
                data, sr = sf.read(cand_path)
                # Convert to mono if stereo
                if data.ndim > 1:
                    data = data.mean(axis=1)
                # Resample if sample rate doesn't match base_sample_rate
                if sr != base_sample_rate:
                    import scipy.signal
                    num_samples = int(len(data) * base_sample_rate / sr)
                    data = scipy.signal.resample(data, num_samples).astype(np.float32)
                segments.append(data.astype(np.float32))
                has_real_audio = True
            except Exception as e:
                print(f"Error reading {cand_path}: {e}")
                segments.append(np.zeros(int(3.0 * base_sample_rate), dtype=np.float32))
        else:
            # 3.0s placeholder silence for uncoupled/missing audio scene to maintain timeline synchronization
            segments.append(np.zeros(int(3.0 * base_sample_rate), dtype=np.float32))
                    
    if segments and has_real_audio:
        master_audio = np.concatenate(segments, axis=0)
        
        project_dir = os.path.join(workspace_dir, project.slug)
        os.makedirs(project_dir, exist_ok=True)
        master_path = os.path.join(project_dir, f"master_voiceover.{extension}")
        
        try:
            sf.write(master_path, master_audio, base_sample_rate)
            rel_master_path = os.path.relpath(master_path, workspace_dir).replace("\\", "/")
            project.master_audio_path = rel_master_path
            db_session.commit()
            print(f"Master voiceover compiled and saved to {master_path}")
            return master_path
        except Exception as e:
            print(f"Failed to write master voiceover: {e}")
            db_session.rollback()
    else:
        print("No valid audio segments found to concatenate.")

def generate_character_preview(personality_tag: str, reference_text: str, cfg_value: float = 2.0, inference_steps: int = 15, *, character_id: int = None) -> str:
    global _MODEL_STATE, _LAST_ACTIVITY_TIME, _VOXCPM_MODEL
    
    language = detect_language(reference_text)
    load_model(language)
        
    _LAST_ACTIVITY_TIME = time.time()
    
    workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "workspace"))
    shared_characters_dir = os.path.join(workspace_dir, "shared_characters")
    os.makedirs(shared_characters_dir, exist_ok=True)
    
    filename = f"character_{int(character_id)}.wav" if character_id is not None else "temp_preview.wav"
    save_path = os.path.join(shared_characters_dir, filename)
    
    design_prompt = f"{personality_tag}{_prepare_text(reference_text, language)}"
    sample_rate = _VOXCPM_MODEL.tts_model.sample_rate if hasattr(_VOXCPM_MODEL, 'tts_model') and hasattr(_VOXCPM_MODEL.tts_model, 'sample_rate') else 22050
    
    print(f"Generating Character Preview... Prompt: {design_prompt}")
    
    if VoxCPM is not None and hasattr(_VOXCPM_MODEL, 'generate'):
        raw_audio = _VOXCPM_MODEL.generate(
            text=design_prompt,
            cfg_value=cfg_value,
            inference_timesteps=inference_steps
        )
    else:
        duration = 1.0
        t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
        raw_audio = 0.5 * np.sin(2 * np.pi * 440 * t)
        
    audio_data = np.array(raw_audio, dtype=np.float32)
    max_amp = np.max(np.abs(audio_data))
    if max_amp > 0:
        audio_data = audio_data / max_amp
    audio_data = np.clip(audio_data, -1.0, 1.0)
    audio_data = trim_audio_silence(audio_data, sample_rate, threshold=0.01, lead_in_ms=45.0, trail_cushion_ms=50.0)
    
    sf.write(save_path, audio_data, sample_rate)
        
    _LAST_ACTIVITY_TIME = time.time()
    schedule_unload()
    
    return f"shared_characters/{filename}"

def ensure_character_reference(character_id: int, personality_tag: str, reference_text: str,
                               cfg_value: float = 2.0, inference_steps: int = 15) -> str:
    """Design once, then reuse the same speaker sample in every project."""
    relative_path = f"shared_characters/character_{int(character_id)}.wav"
    workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "workspace"))
    with _CHARACTER_REFERENCE_LOCK:
        if os.path.isfile(os.path.join(workspace_dir, relative_path)):
            return relative_path
        return generate_character_preview(
            personality_tag, reference_text, cfg_value, inference_steps,
            character_id=character_id,
        )


def generate_clone_preview(reference_audio_path: str, reference_text: str, text_to_speak: str = "កាលពី ១ម៉ឺនឆ្នាំមុន មនុស្សសម័យបុរេប្រវត្តិ បានរកឃើញអាថ៌កំបាំងមួយយ៉ាងអស្ចារ្យ។", cfg_value: float = 2.0, inference_steps: int = 15) -> str:
    global _MODEL_STATE, _LAST_ACTIVITY_TIME, _VOXCPM_MODEL
    
    language = detect_language(reference_text)
    if language == "en" and detect_language(text_to_speak) == "km":
        text_to_speak = ENGLISH_SEED_TEXT  # default sample is Khmer; match the reference voice language
    load_model(language)
        
    _LAST_ACTIVITY_TIME = time.time()
    
    workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "workspace"))
    custom_voices_dir = os.path.join(workspace_dir, "custom_voices")
    os.makedirs(custom_voices_dir, exist_ok=True)
    
    save_path = os.path.join(custom_voices_dir, "temp_clone_preview.wav")
    sample_rate = _VOXCPM_MODEL.tts_model.sample_rate if hasattr(_VOXCPM_MODEL, 'tts_model') and hasattr(_VOXCPM_MODEL.tts_model, 'sample_rate') else 22050
    
    print(f"Generating Clone Preview... Reference Text: {reference_text}")
    
    if VoxCPM is not None and hasattr(_VOXCPM_MODEL, 'generate'):
        raw_audio = _VOXCPM_MODEL.generate(
            text=_prepare_text(text_to_speak, language),
            prompt_wav_path=reference_audio_path,
            prompt_text=_prepare_text(reference_text, language),
            cfg_value=cfg_value,
            inference_timesteps=inference_steps
        )
    else:
        duration = 1.0
        t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
        raw_audio = 0.5 * np.sin(2 * np.pi * 440 * t)
        
    audio_data = np.array(raw_audio, dtype=np.float32)
    max_amp = np.max(np.abs(audio_data))
    if max_amp > 0:
        audio_data = audio_data / max_amp
    audio_data = np.clip(audio_data, -1.0, 1.0)
    audio_data = trim_audio_silence(audio_data, sample_rate, threshold=0.01, lead_in_ms=45.0, trail_cushion_ms=50.0)
    
    try:
        sf.write(save_path, audio_data, sample_rate)
    except Exception as e:
        print(f"Failed to write clone preview audio: {e}")
        
    _LAST_ACTIVITY_TIME = time.time()
    schedule_unload()
    
    return "custom_voices/temp_clone_preview.wav"
