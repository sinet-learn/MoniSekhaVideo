import os
import re
import json
import asyncio
import requests
import dotenv
import time
import uuid
import unicodedata
from contextlib import asynccontextmanager
from typing import List, Optional, Literal

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))
dotenv.load_dotenv(dotenv_path=os.path.join(ROOT_DIR, ".env"))
dotenv.load_dotenv(dotenv_path=os.path.join(ROOT_DIR, ".env.local"), override=True)

workspace_dir = os.path.abspath(os.path.join(ROOT_DIR, "workspace"))
os.makedirs(workspace_dir, exist_ok=True)

from pydantic import BaseModel, ConfigDict, Field
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
import shutil

from .database import get_db, Project, Scene, Character, Setting, Generation, SHARED_CHARACTERS_DIR, sync_project_json
from .queue_worker import start_queue_worker, task_queue, GenerationTask
from .services import voice_engine, flow_engine, render_engine, scene_animator, flow_video
from .services.scene_timing import ready_voice_duration

# Pydantic Schemas

class SceneBase(BaseModel):
    scene_number: int
    narration_khmer: Optional[str] = None
    image_prompt_english: Optional[str] = None
    video_prompt: Optional[str] = Field(default=None, max_length=4000)
    negative_prompt: Optional[str] = None
    user_refinement_prompt: Optional[str] = None
    audio_path: Optional[str] = None
    audio_text: Optional[str] = None
    audio_error: Optional[str] = None
    audio_duration: float = 0.0
    image_path: Optional[str] = None
    images_list: Optional[str] = "[]"
    reference_images: Optional[str] = "[]"
    audio_status: Optional[str] = "idle"
    image_status: Optional[str] = "idle"
    video_status: str = "idle"
    video_error: Optional[str] = None
    video_model: Optional[str] = None

class SceneUpdate(BaseModel):
    narration_khmer: Optional[str] = None
    image_prompt_english: Optional[str] = None
    video_prompt: Optional[str] = Field(default=None, max_length=4000)
    negative_prompt: Optional[str] = None
    user_refinement_prompt: Optional[str] = None
    character_id: Optional[int] = None
    character_name: Optional[str] = None
    audio_status: Optional[str] = None
    audio_text: Optional[str] = None

class SceneOut(SceneBase):
    id: int
    project_id: int
    character_id: Optional[int] = None
    character_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class CharacterOut(BaseModel):
    id: int
    name: str
    gender: str
    personality_tag: str
    audio_path: Optional[str] = None
    reference_text: str

    model_config = ConfigDict(from_attributes=True)

class VoiceSynthesisSettings(BaseModel):
    cfg_value: float = Field(default=2.0, ge=1.0, le=5.0)
    inference_steps: int = Field(default=15, ge=4, le=50)


class PreviewPayload(VoiceSynthesisSettings):
    gender: str
    personality_tag: str
    reference_text: str

class ProjectBase(BaseModel):
    title: str
    is_pinned: bool = False
    raw_research: Optional[str] = None
    script_narrative: Optional[str] = None
    video_concept: Optional[str] = None
    visual_mode: Literal["images", "video"] = "images"
    illustration_style: Optional[str] = None
    global_voice_style: Optional[str] = None
    structured_json_data: Optional[str] = None
    status: Optional[str] = "draft"
    master_audio_path: Optional[str] = None
    voice_profile_tag: Optional[str] = None
    voice_provider: Optional[str] = "voxcpm2"
    gemini_voice_name: Optional[str] = "Puck"
    gemini_voice_style: Optional[str] = "ted_ed"
    audio_format: Optional[str] = "wav"
    voice_cfg_value: float = Field(default=2.0, ge=1.0, le=5.0)
    voice_inference_steps: int = Field(default=15, ge=4, le=50)
    theme_era: Optional[str] = None
    theme_mood: Optional[str] = None
    theme_custom: Optional[str] = None
    aspect_ratio: Optional[str] = "16:9"
    character_attire: Optional[str] = None
    theme_region: Optional[str] = "cambodia"
    scene_staging: Optional[str] = "studio"
    art_style: Optional[str] = "stickman"
    flow_project_id: Optional[str] = None
    timeline_data: Optional[str] = None

class ProjectCreate(BaseModel):
    title: Optional[str] = None

class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    is_pinned: Optional[bool] = None
    raw_research: Optional[str] = None
    script_narrative: Optional[str] = None
    video_concept: Optional[str] = None
    visual_mode: Literal["images", "video"] = "images"
    illustration_style: Optional[str] = None
    global_voice_style: Optional[str] = None
    structured_json_data: Optional[str] = None
    status: Optional[str] = None
    master_audio_path: Optional[str] = None
    voice_profile_tag: Optional[str] = None
    voice_provider: Optional[str] = None
    gemini_voice_name: Optional[str] = None
    gemini_voice_style: Optional[str] = None
    audio_format: Optional[str] = None
    voice_cfg_value: float = Field(default=2.0, ge=1.0, le=5.0)
    voice_inference_steps: int = Field(default=15, ge=4, le=50)
    theme_era: Optional[str] = None
    theme_region: Optional[str] = None
    theme_mood: Optional[str] = None
    theme_custom: Optional[str] = None
    aspect_ratio: Optional[str] = None
    character_attire: Optional[str] = None
    scene_staging: Optional[str] = None
    art_style: Optional[str] = None
    flow_project_id: Optional[str] = None
    timeline_data: Optional[str] = None

class ProjectOutList(ProjectBase):
    id: int
    slug: str

    model_config = ConfigDict(from_attributes=True)

class ProjectSummary(BaseModel):
    id: int
    title: str
    slug: str
    is_pinned: bool = False
    status: Optional[str] = "draft"
    scene_count: int = 0
    scenes_with_images: int = 0
    scenes_with_audio: int = 0

    model_config = ConfigDict(from_attributes=True)

class ProjectOut(ProjectBase):
    id: int
    slug: str
    scenes: List[SceneOut] = []

    model_config = ConfigDict(from_attributes=True)

class SceneRefine(BaseModel):
    user_instruction: str

class FlowAdjustPayload(BaseModel):
    instruction: str
    target_image: Optional[str] = None
    reference_images: Optional[List[str]] = None
    reference_image: Optional[str] = None  # Backwards compatibility
    refine_prompt_text: bool = False
    generate_image: bool = True
    model: Optional[str] = "nano2"
    aspect_ratio: Optional[str] = "16:9"
    count: Optional[int] = 1
    image_provider: Optional[str] = "flow"

class GenerateFieldPayload(BaseModel):
    field_name: str

class GenerateScriptFromPromptPayload(BaseModel):
    prompt: str
    target_length: Optional[str] = "medium"  # "short", "medium", "detailed"
    domain: Optional[str] = "auto"           # "auto", "pharmacy", "teacher_education", "general"
    tone: Optional[str] = "educational"      # "educational", "storytelling", "conversational"
    language: Optional[str] = "khmer"        # "khmer", "english", "bilingual"
    apply_to_project: Optional[bool] = True

class SettingUpdate(BaseModel):
    active_provider: Optional[str] = "gemini"
    active_slot: Optional[int] = 1
    image_provider: Optional[str] = "local"
    voice_provider: Optional[str] = "voxcpm2"
    api_key: Optional[str] = None

class GeminiVoicePreviewPayload(BaseModel):
    voice_name: Optional[str] = "Puck"
    style_direction: Optional[str] = "ted_ed"
    sample_text: Optional[str] = None

class ImageGeneratePayload(BaseModel):
    aspect_ratio: Optional[str] = "16:9"
    guidance_scale: Optional[float] = 7.5
    inference_steps: Optional[int] = 10
    model: Optional[str] = "nano2"
    count: Optional[int] = 1
    image_provider: Optional[str] = None
    target_image: Optional[str] = None
    reference_images: Optional[List[str]] = None
    scene_ids: Optional[List[int]] = None
    skip_existing: Optional[bool] = False

class SetActiveImagePayload(BaseModel):
    image_path: str

class VideoGeneratePayload(BaseModel):
    provider: Literal["flow"] = "flow"
    prompt: str = Field(min_length=1, max_length=4000)
    model: Literal["veo-lite", "veo-fast", "veo-quality", "veo-lite-lp", "omni-flash", "omni-1.2-flash", "omni-1.2"] = "veo-lite"


class MotionGeneratePayload(BaseModel):
    motion_type: Optional[str] = "zoom_in"
    duration: Optional[float] = None


def generate_project_slug(title: str, db: Session, current_project_id: Optional[int] = None, current_slug: Optional[str] = None) -> str:
    normalized = unicodedata.normalize('NFKD', title or '').encode('ascii', 'ignore').decode('ascii')
    base_slug = re.sub(r'[^a-z0-9]+', '-', normalized.lower()).strip('-')
    if not base_slug:
        base_slug = f"project-{current_project_id}" if current_project_id else "project"

    slug = base_slug
    counter = 2
    while True:
        db_collision = db.query(Project).filter(Project.slug == slug, Project.id != current_project_id).first() is not None
        fs_collision = (slug != current_slug) and os.path.exists(os.path.join(workspace_dir, slug))
        if not db_collision and not fs_collision:
            return slug
        slug = f"{base_slug}-{counter}"
        counter += 1


def rename_project_workspace_and_paths(project: Project, new_slug: str, db: Session):
    old_slug = project.slug
    if not old_slug or old_slug == new_slug:
        project.slug = new_slug
        return

    old_dir = os.path.join(workspace_dir, old_slug)
    new_dir = os.path.join(workspace_dir, new_slug)

    # 1. Rename workspace folder on disk
    if os.path.exists(old_dir):
        if os.path.exists(new_dir) and old_dir != new_dir:
            raise HTTPException(
                status_code=409,
                detail=f"Target workspace folder '{new_slug}' already exists."
            )
        try:
            shutil.move(old_dir, new_dir)
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to rename workspace folder from '{old_slug}' to '{new_slug}': {str(e)}"
            )
    else:
        os.makedirs(new_dir, exist_ok=True)

    # 2. Update Project fields
    project.slug = new_slug

    if project.master_audio_path and project.master_audio_path.startswith(f"{old_slug}/"):
        project.master_audio_path = f"{new_slug}/" + project.master_audio_path[len(f"{old_slug}/"):]

    if project.timeline_data:
        try:
            project.timeline_data = project.timeline_data.replace(f'"{old_slug}/', f'"{new_slug}/')
        except Exception as e:
            print(f"Warning: Failed to update timeline_data paths: {e}")

    # 3. Update Scenes and Generations
    scenes = db.query(Scene).filter(Scene.project_id == project.id).all()
    scene_ids = [s.id for s in scenes]

    for scene in scenes:
        if scene.image_path and scene.image_path.startswith(f"{old_slug}/"):
            scene.image_path = f"{new_slug}/" + scene.image_path[len(f"{old_slug}/"):]

        if scene.audio_path and scene.audio_path.startswith(f"{old_slug}/"):
            scene.audio_path = f"{new_slug}/" + scene.audio_path[len(f"{old_slug}/"):]

        if scene.images_list:
            try:
                imgs = json.loads(scene.images_list)
                if isinstance(imgs, list):
                    updated_imgs = [
                        (f"{new_slug}/" + p[len(f"{old_slug}/"):]) if isinstance(p, str) and p.startswith(f"{old_slug}/") else p
                        for p in imgs
                    ]
                    scene.images_list = json.dumps(updated_imgs)
            except Exception:
                pass

        if scene.reference_images:
            try:
                refs = json.loads(scene.reference_images)
                if isinstance(refs, list):
                    updated_refs = [
                        (f"{new_slug}/" + p[len(f"{old_slug}/"):]) if isinstance(p, str) and p.startswith(f"{old_slug}/") else p
                        for p in refs
                    ]
                    scene.reference_images = json.dumps(updated_refs)
            except Exception:
                pass

    if scene_ids:
        generations = db.query(Generation).filter(Generation.scene_id.in_(scene_ids)).all()
        for gen in generations:
            if gen.output_paths:
                try:
                    out_paths = json.loads(gen.output_paths)
                    if isinstance(out_paths, list):
                        updated_paths = [
                            (f"{new_slug}/" + p[len(f"{old_slug}/"):]) if isinstance(p, str) and p.startswith(f"{old_slug}/") else p
                            for p in out_paths
                        ]
                        gen.output_paths = json.dumps(updated_paths)
                except Exception:
                    pass
            if gen.reference_media_ids:
                try:
                    ref_ids = json.loads(gen.reference_media_ids)
                    if isinstance(ref_ids, list):
                        updated_ref_ids = [
                            (f"{new_slug}/" + p[len(f"{old_slug}/"):]) if isinstance(p, str) and p.startswith(f"{old_slug}/") else p
                            for p in ref_ids
                        ]
                        gen.reference_media_ids = json.dumps(updated_ref_ids)
                except Exception:
                    pass

    sync_project_json(project.id, db)


# Background worker task reference
worker_task = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global worker_task
    from .services import voice_engine
    from .database import SessionLocal, Scene, Project
    
    # Auto-heal orphaned processing states from previous server crashes/restarts
    try:
        cleanup_db = SessionLocal()
        orphaned = cleanup_db.query(Scene).filter(Scene.audio_status == "processing").all()
        if orphaned:
            print(f"[STARTUP] Found {len(orphaned)} orphaned audio processing scene(s). Recovering states...")
            for s in orphaned:
                if s.audio_path:
                    s.audio_status = "completed"
                else:
                    s.audio_status = "idle"
            cleanup_db.commit()
        interrupted_videos = cleanup_db.query(Scene).filter(Scene.video_status.in_(["queued", "processing"])).all()
        for scene in interrupted_videos:
            scene.video_status = "failed"
            scene.video_error = "Animation was interrupted by a backend restart. Check Flow for a submitted clip before retrying."
        # Convert diagnostics saved by older app versions into readable errors.
        old_video_failures = cleanup_db.query(Scene).filter(
            Scene.video_status == "failed",
            Scene.video_error.like("Flow video generation failed:%"),
        ).all()
        for scene in old_video_failures:
            if "{" in scene.video_error or "FlowHostMigratedError" in scene.video_error:
                scene.video_error = flow_video.format_generation_error("", scene.video_error)
        cleanup_db.commit()
        cleanup_db.close()
    except Exception as cleanup_err:
        print(f"[STARTUP] Failed to cleanup orphaned scene statuses: {cleanup_err}")

    # Auto-heal desynchronized project folder names and slugs
    try:
        heal_db = SessionLocal()
        projects_to_heal = heal_db.query(Project).all()
        for p in projects_to_heal:
            if p.title and p.title.strip().lower() != "untitled" and p.slug and p.slug.startswith("untitled"):
                target_slug = generate_project_slug(p.title, heal_db, current_project_id=p.id, current_slug=p.slug)
                if target_slug != p.slug:
                    print(f"[STARTUP] Healing project folder '{p.slug}' -> '{target_slug}' for project '{p.title}'...")
                    rename_project_workspace_and_paths(p, target_slug, heal_db)
                    heal_db.commit()
        heal_db.close()
    except Exception as heal_err:
        print(f"[STARTUP] Failed to heal project folders: {heal_err}")

    voice_engine.set_event_loop(asyncio.get_running_loop())
    worker_task = asyncio.create_task(start_queue_worker())
    yield
    if worker_task:
        worker_task.cancel()
        try:
            await worker_task
        except asyncio.CancelledError:
            print("Queue worker gracefully shut down.")

app = FastAPI(lifespan=lifespan)

workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "workspace"))
os.makedirs(workspace_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=workspace_dir), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "MoniSekha backend is healthy"}

@app.get("/api/debug-queue")
async def debug_queue():
    global worker_task, task_queue
    exc = None
    if worker_task and worker_task.done() and not worker_task.cancelled():
        try:
            exc = str(worker_task.exception())
        except Exception as e:
            exc = str(e)
            
    stack = []
    if worker_task:
        for f in worker_task.get_stack():
            stack.append(f"{f.f_code.co_filename}:{f.f_lineno} in {f.f_code.co_name}")
            
    items = []
    if task_queue:
        for t in list(task_queue._queue)[:5]:
            items.append({
                "type": t.task_type,
                "scene_id": t.scene_id,
                "project_id": t.project_id,
                "payload": t.payload
            })
            
    return {
        "worker_task_exists": worker_task is not None,
        "worker_task_done": worker_task.done() if worker_task else None,
        "worker_task_cancelled": worker_task.cancelled() if worker_task else None,
        "worker_task_exception": exc,
        "coroutine_stack": stack,
        "queue_size": task_queue.qsize() if task_queue else None,
        "next_tasks": items
    }

@app.get("/api/flow/status")
async def get_flow_status():
    return flow_engine.check_flow_status()


@app.get("/api/settings")
async def get_settings(db: Session = Depends(get_db)):
    setting = db.query(Setting).first()
    active_provider = (setting.active_provider if setting else "gemini").lower()
    active_slot = setting.active_slot if setting else 1
    image_provider = setting.image_provider if setting else "local"

    # Status for all slots
    keys_status = {}
    for prov in ["gemini", "groq"]:
        for s in [1, 2]:
            k_name = f"{prov.upper()}_KEY_{s}"
            val = os.getenv(k_name, "")
            is_set = bool(val and val.strip() and not val.strip().startswith("your_"))
            masked = f"{val[:4]}...{val[-4:]}" if is_set and len(val) > 8 else ("***" if is_set else "")
            keys_status[f"{prov}_{s}"] = {"has_key": is_set, "masked": masked}

    current_slot_key = keys_status.get(f"{active_provider}_{active_slot}", {"has_key": False, "masked": ""})

    return {
        "active_provider": active_provider,
        "active_slot": active_slot,
        "image_provider": image_provider or "local",
        "has_api_key": current_slot_key["has_key"],
        "masked_key": current_slot_key["masked"],
        "keys_status": keys_status,
        "available_image_providers": [
            {
                "id": "agy",
                "name": "Antigravity (AGY)",
                "description": "Native Antigravity Agent API & Image Studio",
                "badge": "Recommended"
            },
            {
                "id": "local",
                "name": "Draw Things",
                "description": "100% offline Apple Silicon GPU synthesis on port 7860",
                "badge": "Offline"
            },
            {
                "id": "cloud",
                "name": "Cloud Direct",
                "description": "Pollinations free cloud synthesis with auto rate-pacing",
                "badge": "Cloud"
            },
            {
                "id": "flow",
                "name": "Google Flow",
                "description": "Cloud Flow MCP server daemon on port 8765",
                "badge": "MCP"
            }
        ]
    }

@app.put("/api/settings")
async def update_settings(payload: SettingUpdate, db: Session = Depends(get_db)):
    setting = db.query(Setting).first()
    if not setting:
        setting = Setting(
            active_provider=payload.active_provider or "gemini",
            active_slot=payload.active_slot or 1,
            image_provider=payload.image_provider or "local"
        )
        db.add(setting)
    else:
        if payload.active_provider is not None:
            setting.active_provider = payload.active_provider
        if payload.active_slot is not None:
            setting.active_slot = payload.active_slot
        if payload.image_provider is not None:
            setting.image_provider = payload.image_provider
    db.commit()

    # Save and persist API key if provided
    if payload.api_key and payload.api_key.strip():
        cleaned_key = payload.api_key.strip()
        if not cleaned_key.startswith("***"):
            target_prov = (setting.active_provider or "gemini").upper()
            target_slot = setting.active_slot or 1
            key_var = f"{target_prov}_KEY_{target_slot}"
            
            # 1. Update runtime environment immediately
            os.environ[key_var] = cleaned_key
            
            # 2. Persist to .env.local
            env_local = os.path.join(ROOT_DIR, ".env.local")
            if not os.path.exists(env_local):
                env_example = os.path.join(ROOT_DIR, ".env.example")
                if os.path.exists(env_example):
                    shutil.copy(env_example, env_local)
                else:
                    with open(env_local, "w", encoding="utf-8") as f:
                        f.write("")
            try:
                dotenv.set_key(env_local, key_var, cleaned_key)
            except Exception as err:
                print(f"[SETTINGS WARNING] Failed to persist key to .env.local: {err}")

    return {"status": "success"}

# Projects CRUD
@app.post("/api/projects", response_model=ProjectOut)
async def create_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    title = payload.title.strip() if payload.title and payload.title.strip() else "Untitled"
    slug = generate_project_slug(title, db)
        
    project = Project(
        title=title,
        slug=slug,
        status="draft"
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    
    # Create workspace directory
    proj_workspace_dir = os.path.join(workspace_dir, slug)
    os.makedirs(proj_workspace_dir, exist_ok=True)
    
    return project

@app.post("/api/projects/{project_id}/duplicate", response_model=ProjectOut)
async def duplicate_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    new_title = f"{project.title} (Copy)"
    slug = generate_project_slug(new_title, db)

    new_project = Project(
        title=new_title,
        slug=slug,
        raw_research=project.raw_research,
        script_narrative=project.script_narrative,
        video_concept=project.video_concept,
        visual_mode=project.visual_mode,
        illustration_style=project.illustration_style,
        global_voice_style=project.global_voice_style,
        voice_profile_tag=project.voice_profile_tag,
        voice_cfg_value=project.voice_cfg_value,
        voice_inference_steps=project.voice_inference_steps,
        audio_format=project.audio_format,
        structured_json_data=project.structured_json_data,
        theme_era=project.theme_era,
        theme_region=getattr(project, "theme_region", "cambodia") or "cambodia",
        theme_mood=project.theme_mood,
        theme_custom=project.theme_custom,
        aspect_ratio=project.aspect_ratio or "16:9",
        character_attire=project.character_attire,
        scene_staging=project.scene_staging or "studio",
        art_style=project.art_style or "stickman",
        status="draft"
    )
    db.add(new_project)
    db.commit()
    db.refresh(new_project)

    if project.scenes:
        for s in project.scenes:
            neg = s.negative_prompt
            scene = Scene(
                project_id=new_project.id,
                scene_number=s.scene_number,
                narration_khmer=s.narration_khmer,
                image_prompt_english=s.image_prompt_english,
                video_prompt=s.video_prompt,
                negative_prompt=neg,
                image_status="idle",
                audio_status="idle",
                user_refinement_prompt=s.user_refinement_prompt,
                character_id=s.character_id,
                character_name=s.character_name,
            )
            db.add(scene)
    elif new_project.structured_json_data:
        try:
            scenes_data = json.loads(new_project.structured_json_data)
            if isinstance(scenes_data, list) and len(scenes_data) > 0:
                for scene_obj in scenes_data:
                    neg = scene_obj.get("negative_prompt") or scene_obj.get("negative_prompt_english")
                    scene = Scene(
                        project_id=new_project.id,
                        scene_number=scene_obj.get("scene_number", 1),
                        narration_khmer=scene_obj.get("narration_khmer"),
                        image_prompt_english=scene_obj.get("image_prompt_english"),
                        video_prompt=scene_obj.get("video_prompt"),
                        negative_prompt=neg,
                        image_status="idle",
                        audio_status="idle"
                    )
                    db.add(scene)
        except json.JSONDecodeError:
            pass

    db.commit()
    db.refresh(new_project)
    sync_project_json(new_project.id, db)

    proj_workspace_dir = os.path.join(workspace_dir, slug)
    os.makedirs(proj_workspace_dir, exist_ok=True)

    return new_project

@app.get("/api/projects", response_model=List[ProjectOutList])
async def get_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.is_pinned.desc(), Project.id.desc()).all()
    return projects

@app.get("/api/projects/summary", response_model=List[ProjectSummary])
async def get_projects_summary(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.is_pinned.desc(), Project.id.desc()).all()
    summaries = []
    for project in projects:
        scene_count = len(project.scenes)
        scenes_with_images = sum(1 for s in project.scenes if s.image_path)
        scenes_with_audio = sum(1 for s in project.scenes if s.audio_path)
        summaries.append(
            ProjectSummary(
                id=project.id,
                title=project.title,
                slug=project.slug,
                is_pinned=project.is_pinned,
                status=project.status,
                scene_count=scene_count,
                scenes_with_images=scenes_with_images,
                scenes_with_audio=scenes_with_audio,
            )
        )
    return summaries

@app.get("/api/projects/{project_id}", response_model=ProjectOut)
async def get_project_details(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Auto-healing filesystem validation
    modified = False
    for scene in project.scenes:
        if scene.image_path:
            full_path = os.path.join(workspace_dir, scene.image_path)
            if not os.path.exists(full_path):
                scene.image_path = None
                scene.image_status = "idle"
                modified = True
                
        if scene.audio_path:
            full_path = os.path.join(workspace_dir, scene.audio_path)
            if not os.path.exists(full_path):
                scene.audio_path = None
                scene.audio_status = "idle"
                modified = True
                
                
    if project.master_audio_path:
        full_path = os.path.join(workspace_dir, project.master_audio_path)
        if not os.path.exists(full_path):
            project.master_audio_path = None
            modified = True

    if modified:
        db.commit()
        db.refresh(project)
        
    # Eagerly loaded implicitly by SQLAlchemy relationship
    project.scenes.sort(key=lambda x: x.scene_number)
    return project

@app.post("/api/projects/{project_id}/reset-voice")
async def reset_voice(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    proj_workspace_dir = os.path.join(workspace_dir, project.slug)
    
    from pathlib import Path
    for seed_path in Path(proj_workspace_dir).glob("voice_profile_*.wav"):
        try:
            seed_path.unlink()
        except OSError:
            pass
            
    project.master_audio_path = None
    project.voice_profile_tag = None

    for ext in ["wav", "mp3"]:
        master_file = os.path.join(proj_workspace_dir, f"master_voiceover.{ext}")
        if os.path.exists(master_file):
            try:
                os.remove(master_file)
            except OSError:
                pass
    
    for scene in project.scenes:
        if scene.audio_path:
            full_path = os.path.join(workspace_dir, scene.audio_path)
            if os.path.exists(full_path):
                try:
                    os.remove(full_path)
                except OSError:
                    pass
        scene.audio_path = None
        scene.audio_status = "idle"
        
    db.commit()
    sync_project_json(project.id, db)
    return {"status": "success", "message": "Voice profile and audio scenes reset"}

@app.put("/api/projects/{project_id}", response_model=ProjectOut)
async def update_project(project_id: int, payload: ProjectUpdate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    update_data = payload.model_dump(exclude_unset=True)

    if "title" in update_data and update_data["title"] is not None:
        new_title = update_data["title"].strip()
        if new_title:
            new_slug = generate_project_slug(new_title, db, current_project_id=project.id, current_slug=project.slug)
            if new_slug != project.slug:
                rename_project_workspace_and_paths(project, new_slug, db)
            project.title = new_title
        del update_data["title"]

    if "slug" in update_data and update_data["slug"] is not None:
        custom_slug = update_data["slug"].strip()
        if custom_slug and custom_slug != project.slug:
            validated_slug = generate_project_slug(custom_slug, db, current_project_id=project.id, current_slug=project.slug)
            rename_project_workspace_and_paths(project, validated_slug, db)
        del update_data["slug"]
    
    if "structured_json_data" in update_data and update_data["structured_json_data"]:
        try:
            scenes_data = json.loads(update_data["structured_json_data"])
            if isinstance(scenes_data, list):
                db.query(Scene).filter(Scene.project_id == project_id).delete()
                for scene_obj in scenes_data:
                    neg = scene_obj.get("negative_prompt") or scene_obj.get("negative_prompt_english")
                    scene = Scene(
                        project_id=project_id,
                        scene_number=scene_obj.get("scene_number", 1),
                        narration_khmer=scene_obj.get("narration_khmer"),
                        image_prompt_english=scene_obj.get("image_prompt_english"),
                        video_prompt=scene_obj.get("video_prompt"),
                        negative_prompt=neg,
                        image_status="idle",
                        audio_status="idle"
                    )
                    db.add(scene)
        except json.JSONDecodeError:
            pass

    voice_changed = any(
        key in update_data and update_data[key] != getattr(project, key)
        for key in ("voice_profile_tag", "voice_cfg_value", "voice_inference_steps")
    )
    if voice_changed:
        for scene in project.scenes:
            if scene.audio_path and scene.audio_status != "processing":
                scene.audio_status = "outdated"

    for key, value in update_data.items():
        setattr(project, key, value)
        
    db.commit()
    db.refresh(project)
    project.scenes.sort(key=lambda x: x.scene_number)
    return project

@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    slug = project.slug
    db.delete(project)
    db.commit()
    
    proj_workspace_dir = os.path.join(workspace_dir, slug)
    if os.path.exists(proj_workspace_dir):
        shutil.rmtree(proj_workspace_dir)
        
    return {"status": "success", "message": "Project and associated scenes deleted"}


def mirror_canonical_scene_image(project_slug: str, scene_number: int, active_rel_path: Optional[str]):
    """
    Maintains a deterministic canonical file workspace/<slug>/scene_XXX.png pointing to the
    currently active variation, so downstream video editing automation tools can load scenes directly.
    """
    proj_dir = os.path.join(workspace_dir, project_slug)
    canonical_file = os.path.join(proj_dir, f"scene_{scene_number:03d}.png")
    if active_rel_path:
        src = os.path.join(workspace_dir, active_rel_path)
        if os.path.exists(src):
            try:
                shutil.copyfile(src, canonical_file)
            except Exception as e:
                print(f"Error mirroring canonical scene image: {e}")
    else:
        if os.path.exists(canonical_file):
            try:
                os.remove(canonical_file)
            except Exception:
                pass


# Scene CRUD
@app.put("/api/scenes/{scene_id}", response_model=SceneOut)
async def update_scene(scene_id: int, payload: SceneUpdate, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
        
    update_data = payload.model_dump(exclude_unset=True)

    if "video_prompt" in update_data and update_data["video_prompt"] != scene.video_prompt:
        if scene.video_status in ("queued", "processing"):
            raise HTTPException(status_code=409, detail="Wait for animation generation to finish before editing its prompt.")
        if scene.video_status == "completed":
            scene.video_status = "idle"
        scene.video_error = None

    # Invalidate audio if narration changed or character changed and audio exists
    if "narration_khmer" in update_data:
        new_text = (update_data["narration_khmer"] or "").strip()
        orig_text = (scene.audio_text or scene.narration_khmer or "").strip()
        if new_text != orig_text:
            if scene.audio_status == "completed" or scene.audio_path:
                scene.audio_status = "outdated"
        elif scene.audio_text and new_text == (scene.audio_text or "").strip() and scene.audio_path:
            # If user restored text back to match audio, restore status to completed
            scene.audio_status = "completed"

    # Resolve character name if character_id changed
    if "character_id" in update_data:
        char_id = update_data["character_id"]
        if char_id != scene.character_id:
            if scene.audio_status == "completed" or scene.audio_path:
                scene.audio_status = "outdated"
        if char_id is not None:
            char = db.query(Character).filter(Character.id == char_id).first()
            scene.character_id = char_id
            scene.character_name = char.name if char else None
        else:
            scene.character_id = None
            scene.character_name = None
        update_data.pop("character_id", None)
        update_data.pop("character_name", None)

    for key, value in update_data.items():
        setattr(scene, key, value)
        
    db.commit()
    db.refresh(scene)
    sync_project_json(scene.project_id, db)
    return scene

# Existing operations for generating and parsing

@app.post("/api/projects/{project_id}/generate-field")
async def generate_project_field(project_id: int, payload: GenerateFieldPayload, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if payload.field_name not in ["script_narrative", "illustration_style", "structured_json_data", "video_concept", "global_voice_style"]:
        raise HTTPException(status_code=400, detail="Invalid field_name")

    from .services.llm_orchestrator import generate_field_content

    context = f"Research:\n{project.raw_research or ''}\n\nVideo Concept:\n{project.video_concept or ''}"

    try:
        generated_text = generate_field_content(db, payload.field_name, context, visual_mode="images")
        
        if payload.field_name == "structured_json_data":
            try:
                # Basic validation that it's json array
                parsed = json.loads(generated_text)
                if not isinstance(parsed, list):
                    generated_text = json.dumps([parsed], indent=2)
                else:
                    generated_text = json.dumps(parsed, indent=2)
            except json.JSONDecodeError:
                pass # Just save the string and let the frontend show error or retry
                
        setattr(project, payload.field_name, generated_text)
        db.commit()
        db.refresh(project)
        return {"status": "success", "field_name": payload.field_name, "generated_text": generated_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/projects/{project_id}/generate-script-from-prompt")
async def generate_script_from_prompt_endpoint(
    project_id: int,
    payload: GenerateScriptFromPromptPayload,
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    prompt_clean = (payload.prompt or "").strip()
    if not prompt_clean:
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    try:
        from .services.llm.orchestrators.script import generate_script_from_user_prompt

        result = generate_script_from_user_prompt(
            db=db,
            prompt=prompt_clean,
            target_length=payload.target_length or "medium",
            domain=payload.domain or "auto",
            tone=payload.tone or "educational",
            language=payload.language or "khmer",
        )

        if payload.apply_to_project:
            project.script_narrative = result["script_narrative"]
            if not project.video_concept:
                project.video_concept = prompt_clean
            db.commit()
            db.refresh(project)

        return {
            "status": "success",
            "script_narrative": result["script_narrative"],
            "detected_domain": result["detected_domain"],
            "scene_count": result["scene_count"],
            "target_length": result["target_length"],
            "project_id": project.id,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Script generation failed: {str(e)}")

@app.post("/api/projects/{project_id}/parse")
async def parse_project_scenes(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    try:
        from .services.llm.orchestrators.structure import build_structured_scenes
        scenes_data = build_structured_scenes(
            db=db,
            raw_research=project.raw_research or "",
            video_concept=project.video_concept or "",
            script_narrative=project.script_narrative or "",
            illustration_style=project.illustration_style or "",
            vocal_style=project.global_voice_style or "",
            visual_mode="images",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    if not scenes_data or any(not (item.get("image_prompt_english") or "").strip() for item in scenes_data):
        raise HTTPException(status_code=422, detail="Every scene needs a starting-image prompt. Please generate again.")
    db.query(Scene).filter(Scene.project_id == project_id).delete()
    
    new_scenes = []
    clean_json_array = []
    for scene_item in scenes_data:
        scene = Scene(
            project_id=project.id,
            scene_number=scene_item.get("scene_number"),
            narration_khmer=scene_item.get("narration_khmer"),
            image_prompt_english=scene_item.get("image_prompt_english"),
            video_prompt=scene_item.get("video_prompt")
        )
        db.add(scene)
        new_scenes.append(scene)
        
        clean_json_array.append({
            "scene_number": scene_item.get("scene_number"),
            "narration_khmer": scene_item.get("narration_khmer"),
            "image_prompt_english": scene_item.get("image_prompt_english"),
            "video_prompt": scene_item.get("video_prompt"),
            "negative_prompt": None
        })
        
    project.structured_json_data = json.dumps(clean_json_array)
    db.commit()
    return {"status": "success", "scenes_created": len(new_scenes)}


class ScriptSegmentPayload(BaseModel):
    long_script: str
    split_mode: Optional[str] = "enter"

@app.post("/api/projects/{project_id}/segment-script")
async def segment_project_script(project_id: int, payload: ScriptSegmentPayload, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    long_script = payload.long_script or ""
    split_mode = payload.split_mode or "enter"
    clean_script = re.sub(r"\(.*?\)", "", long_script)
    
    if split_mode == "enter":
        raw_lines = [l.strip() for l in clean_script.split("\n") if l.strip()]
        chunks = []
        for line in raw_lines:
            trimmed = re.sub(r"[\s\u200B\uFEFF]+$", "", line).strip()
            if not trimmed:
                continue
            if trimmed.endswith("។") or trimmed.endswith("៕"):
                chunks.append(trimmed)
            else:
                chunks.append(f"{trimmed}។")
    else:
        # Split strictly by Khmer full stop ។ or ៕
        raw_chunks = [re.sub(r"\n+", " ", c).strip() for c in re.split(r"[។៕]+", clean_script) if c.strip()]
        chunks = []
        for c in raw_chunks:
            trimmed = re.sub(r"[\s\u200B\uFEFF]+$", "", c).strip()
            if not trimmed:
                continue
            if trimmed.endswith("។") or trimmed.endswith("៕"):
                chunks.append(trimmed)
            else:
                chunks.append(f"{trimmed}។")
    
    scenes = db.query(Scene).filter(Scene.project_id == project_id).order_by(Scene.scene_number).all()
    
    for i, chunk in enumerate(chunks):
        if i < len(scenes):
            if (scenes[i].narration_khmer or "").strip() != chunk.strip():
                scenes[i].narration_khmer = chunk
                if scenes[i].audio_status == "completed" or scenes[i].audio_path:
                    scenes[i].audio_status = "outdated"
        else:
            new_scene = Scene(
                project_id=project.id,
                scene_number=i + 1,
                narration_khmer=chunk,
                image_status="idle",
                audio_status="idle"
            )
            db.add(new_scene)
            
    if len(chunks) < len(scenes):
        for scene_to_delete in scenes[len(chunks):]:
            if scene_to_delete.audio_path:
                full_path = os.path.join(workspace_dir, scene_to_delete.audio_path)
                if os.path.exists(full_path):
                    try:
                        os.remove(full_path)
                    except OSError:
                        pass
            if scene_to_delete.image_path:
                full_path = os.path.join(workspace_dir, scene_to_delete.image_path)
                if os.path.exists(full_path):
                    try:
                        os.remove(full_path)
                    except OSError:
                        pass
            db.delete(scene_to_delete)
            
    db.commit()
    return {"status": "success", "chunks_mapped": len(chunks)}


class SceneImportItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    scene_number: Optional[int] = None
    narration_khmer: Optional[str] = None
    image_prompt_english: Optional[str] = None
    video_prompt: Optional[str] = Field(default=None, max_length=4000)
    negative_prompt: Optional[str] = None
    negative_prompt_english: Optional[str] = None

class AutoGenerateScenesPayload(BaseModel):
    visual_mode: Optional[Literal["images", "video"]] = None
    prompt: str
    mode: Optional[str] = "replace"

@app.post("/api/projects/{project_id}/auto-generate-scenes")
async def auto_generate_project_scenes(project_id: int, payload: AutoGenerateScenesPayload, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not payload.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    from .services.llm.client import generate_text
    system_prompt = (
        "You are an expert storyboard artist and educational animation director. "
        "Read the prompt instructions and return ONLY a valid JSON array of scene objects adhering to the specified format."
    )
    
    visual_mode = "images"
    if visual_mode == "video":
        system_prompt += (
            " This is an animated-video storyboard. Each scene MUST include a nonempty video_prompt in English "
            "for direct text-to-video generation: describe characters, setting, visual style, a clear action over time, "
            "camera movement and final state. Keep scene continuity and exact Khmer narration. "
            "Do not substitute a still-image description for the video_prompt."
        )
    raw_response = generate_text(db, system_prompt, payload.prompt, json_mode=True)
    
    clean = raw_response.strip()
    if clean.startswith("```"):
        lines = clean.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        clean = "\n".join(lines).strip()
        
    try:
        parsed = json.loads(clean)
        if isinstance(parsed, dict):
            for v in parsed.values():
                if isinstance(v, list):
                    parsed = v
                    break
        if not isinstance(parsed, list):
            raise ValueError("Expected a JSON array of scenes")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse scenes JSON from AI: {str(e)}\nRaw Response: {raw_response[:300]}")

    if payload.mode not in ("replace", "append"):
        raise HTTPException(status_code=422, detail="Invalid scene import mode.")
    try:
        validated = [SceneImportItem.model_validate(item).model_dump() for item in parsed]
        if not validated:
            raise ValueError("No scenes returned")
        if any(not (item.get("image_prompt_english") or "").strip() for item in validated):
            raise ValueError("Every scene needs a starting-image prompt. Please generate the storyboard again.")
        parsed = validated
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    if payload.mode == "replace":
        existing_scenes = db.query(Scene).filter(Scene.project_id == project_id).all()
        if any(scene.video_status in ("queued", "processing") for scene in existing_scenes):
            raise HTTPException(status_code=409, detail="Wait for animations to finish before replacing scenes.")
        for s in existing_scenes:
            for kind in ("video", "motion"):
                clip = os.path.join(workspace_dir, project.slug, f"scene_{s.scene_number:03d}_{kind}.mp4")
                if os.path.isfile(clip):
                    os.remove(clip)
            if s.image_path:
                img_f = os.path.join(workspace_dir, s.image_path)
                if os.path.exists(img_f):
                    try:
                        os.remove(img_f)
                    except OSError:
                        pass
            if s.audio_path:
                aud_f = os.path.join(workspace_dir, s.audio_path)
                if os.path.exists(aud_f):
                    try:
                        os.remove(aud_f)
                    except OSError:
                        pass
        db.query(Scene).filter(Scene.project_id == project_id).delete()
        base_scene_number = 1
    else:
        existing_scenes = db.query(Scene).filter(Scene.project_id == project_id).all()
        max_num = max([s.scene_number for s in existing_scenes], default=0)
        base_scene_number = max_num + 1

    clean_json_array = []
    for idx, item in enumerate(parsed):
        scene_num = base_scene_number + idx
        narration = item.get("narration_khmer", "")
        prompt_eng = item.get("image_prompt_english", "")
        video_prompt = item.get("video_prompt")
        neg_prompt = item.get("negative_prompt") or item.get("negative_prompt_english") or "text, watermark, photorealistic, realistic, 3D render, comic book, gradients"

        scene = Scene(
            project_id=project.id,
            scene_number=scene_num,
            narration_khmer=narration,
            image_prompt_english=prompt_eng,
            video_prompt=video_prompt,
            negative_prompt=neg_prompt,
            image_status="idle",
            audio_status="idle"
        )
        db.add(scene)
        clean_json_array.append({
            "scene_number": scene_num,
            "narration_khmer": narration,
            "image_prompt_english": prompt_eng,
            "video_prompt": video_prompt,
            "negative_prompt": neg_prompt
        })

    project.visual_mode = visual_mode
    project.structured_json_data = json.dumps(clean_json_array, indent=2)
    db.commit()
    db.refresh(project)
    sync_project_json(project_id, db)

    return {
        "status": "success",
        "imported_count": len(parsed),
        "total_scenes": db.query(Scene).filter(Scene.project_id == project_id).count()
    }

class ImportScenesPayload(BaseModel):
    scenes: List[SceneImportItem]
    mode: str = "replace"  # "replace" or "append"

@app.post("/api/projects/{project_id}/import-scenes")
async def import_project_scenes(project_id: int, payload: ImportScenesPayload, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if payload.mode == "replace":
        existing_scenes = db.query(Scene).filter(Scene.project_id == project_id).all()
        if any(scene.video_status in ("queued", "processing") for scene in existing_scenes):
            raise HTTPException(status_code=409, detail="Wait for animations to finish before replacing scenes.")
        for s in existing_scenes:
            for kind in ("video", "motion"):
                clip = os.path.join(workspace_dir, project.slug, f"scene_{s.scene_number:03d}_{kind}.mp4")
                if os.path.isfile(clip):
                    os.remove(clip)
            if s.image_path:
                img_f = os.path.join(workspace_dir, s.image_path)
                if os.path.exists(img_f):
                    try:
                        os.remove(img_f)
                    except OSError:
                        pass
            if s.audio_path:
                aud_f = os.path.join(workspace_dir, s.audio_path)
                if os.path.exists(aud_f):
                    try:
                        os.remove(aud_f)
                    except OSError:
                        pass
        db.query(Scene).filter(Scene.project_id == project_id).delete()
        base_scene_number = 1
    elif payload.mode == "append":
        if not payload.scenes:
            raise HTTPException(status_code=400, detail="No scenes provided in payload")
        existing_scenes = db.query(Scene).filter(Scene.project_id == project_id).all()
        max_num = max([s.scene_number for s in existing_scenes], default=0)
        base_scene_number = max_num + 1
    else:
        raise HTTPException(status_code=400, detail=f"Invalid import mode: {payload.mode}")

    for idx, item in enumerate(payload.scenes):
        neg = item.negative_prompt or item.negative_prompt_english
        scene = Scene(
            project_id=project_id,
            scene_number=base_scene_number + idx,
            narration_khmer=item.narration_khmer,
            image_prompt_english=item.image_prompt_english,
            video_prompt=item.video_prompt,
            negative_prompt=neg,
            image_status="idle",
            audio_status="idle"
        )
        db.add(scene)

    db.commit()
    db.refresh(project)
    sync_project_json(project_id, db)
    
    return {
        "status": "success",
        "imported_count": len(payload.scenes),
        "mode": payload.mode,
        "total_scenes": len(project.scenes)
    }


class SplitScenePayload(BaseModel):
    chunks: List[str] = Field(min_length=2, max_length=50)


@app.post("/api/scenes/{scene_id}/split")
async def split_scene(scene_id: int, payload: SplitScenePayload, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    project = db.query(Project).filter(Project.id == scene.project_id).first()
    ordered = db.query(Scene).filter(Scene.project_id == project.id).order_by(Scene.scene_number).all()
    if any(s.audio_status == "processing" or s.image_status == "processing" or s.video_status in ("queued", "processing") for s in ordered):
        raise HTTPException(status_code=409, detail="Wait for project generation to finish before splitting a scene.")
    chunks = [part.strip() for part in payload.chunks]
    compact = lambda text: re.sub(r"[\s\u200b\ufeff]+", "", text or "")
    if any(not part for part in chunks) or compact("".join(chunks)) != compact(scene.narration_khmer):
        raise HTTPException(status_code=422, detail="Split lines must preserve every word and punctuation mark of the original narration.")
    project_dir = os.path.join(workspace_dir, project.slug)
    history = os.path.join(project_dir, "_scene_history", f"split_{scene.id}_{uuid.uuid4().hex}")
    os.makedirs(history, exist_ok=True)
    image = os.path.join(workspace_dir, scene.image_path) if scene.image_path else os.path.join(project_dir, f"scene_{scene.scene_number:03d}.png")
    shared_image = scene.image_path
    if os.path.isfile(image):
        sources = os.path.join(project_dir, "_scene_sources")
        os.makedirs(sources, exist_ok=True)
        snapshot = os.path.join(sources, f"scene_{scene.id}_{uuid.uuid4().hex}.png")
        shutil.copyfile(image, snapshot)
        shared_image = os.path.relpath(snapshot, workspace_dir).replace("\\", "/")
    with open(os.path.join(history, "narration.txt"), "w", encoding="utf-8") as archive:
        archive.write(scene.narration_khmer or "")
    for filename in (f"scene_{scene.scene_number:03d}.{project.audio_format or 'wav'}", f"scene_{scene.scene_number:03d}_video.mp4", f"scene_{scene.scene_number:03d}_motion.mp4", f"master_voiceover.{project.audio_format or 'wav'}", "final_output.mp4"):
        source = os.path.join(project_dir, filename)
        if os.path.isfile(source):
            shutil.move(source, os.path.join(history, filename))
    next_number = max(s.scene_number for s in ordered) + 1
    children = []
    for index, text in enumerate(chunks[1:]):
        # Unassigned files left by an older storyboard cannot become child media.
        for suffix in (f".{project.audio_format or 'wav'}", "_video.mp4", "_motion.mp4"):
            filename = f"scene_{next_number+index:03d}{suffix}"
            stale = os.path.join(project_dir, filename)
            if os.path.isfile(stale):
                shutil.move(stale, os.path.join(history, f"unassigned_{filename}"))
        child = Scene(project_id=project.id, scene_number=next_number+index,
                      narration_khmer=text, image_prompt_english=scene.image_prompt_english,
                      video_prompt=scene.video_prompt, negative_prompt=scene.negative_prompt,
                      image_path=shared_image, image_status="completed" if shared_image else "idle",
                      character_id=scene.character_id, character_name=scene.character_name)
        db.add(child)
        children.append(child)
    scene.narration_khmer = chunks[0]
    scene.image_path = shared_image
    scene.audio_path = None
    scene.audio_text = None
    scene.audio_status = "idle"
    scene.audio_error = None
    scene.video_status = "idle"
    scene.video_error = None
    project.master_audio_path = None
    db.flush()
    sequence = []
    for existing in ordered:
        sequence.append(existing.id)
        if existing.id == scene.id:
            sequence.extend(child.id for child in children)
    db.commit()
    await reorder_project_scenes(project.id, ReorderScenesPayload(scene_ids=sequence), db)
    return {"status": "split", "scene_count": len(chunks), "message": "Generate the shorter voice lines, then animate them in Assembly."}


class ReorderScenesPayload(BaseModel):
    scene_ids: List[int]

@app.put("/api/projects/{project_id}/reorder-scenes", response_model=ProjectOut)
async def reorder_project_scenes(project_id: int, payload: ReorderScenesPayload, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    existing_scenes = db.query(Scene).filter(Scene.project_id == project_id).all()
    if any(scene.video_status in ("queued", "processing") for scene in existing_scenes):
        raise HTTPException(status_code=409, detail="Wait for scene animations to finish before reordering.")
    scene_map = {s.id: s for s in existing_scenes}

    # Validate that IDs belong to project
    for sid in payload.scene_ids:
        if sid not in scene_map:
            raise HTTPException(status_code=400, detail=f"Scene ID {sid} does not belong to project {project_id}")

    # Build the reordered list
    ordered_scenes = [scene_map[sid] for sid in payload.scene_ids]
    # Append any scenes that were not in payload (just in case)
    for s in existing_scenes:
        if s not in ordered_scenes:
            ordered_scenes.append(s)

    slug = project.slug or f"project-{project.id}"
    project_dir = os.path.join(workspace_dir, slug)
    os.makedirs(project_dir, exist_ok=True)
    audio_fmt = project.audio_format or "wav"
    ext = "mp3" if audio_fmt.lower() == "mp3" else "wav"

    # --- Two-Phase File Re-indexing for Audio & Images ---
    # Phase 1: Move existing scene files to temporary unique files to avoid collisions during swapping
    temp_audio_map = {}  # scene_id -> temp_filepath
    temp_img_map = {}    # scene_id -> temp_filepath
    temp_video_map = {}  # (scene_id, video kind) -> temporary clip

    for scene in ordered_scenes:
        old_num = scene.scene_number
        if old_num is None:
            continue
        for kind in ("video", "motion"):
            clip = os.path.join(project_dir, f"scene_{old_num:03d}_{kind}.mp4")
            if os.path.isfile(clip):
                staged = os.path.join(project_dir, f"_tmp_reorder_{uuid.uuid4().hex}_{kind}.mp4")
                shutil.move(clip, staged)
                temp_video_map[(scene.id, kind)] = staged
        # 1. Audio staging
        canonical_aud = os.path.join(project_dir, f"scene_{old_num:03d}.{ext}")
        aud_src = None
        if os.path.exists(canonical_aud):
            aud_src = canonical_aud
        elif scene.audio_path:
            full_audio_path = os.path.join(workspace_dir, scene.audio_path)
            if os.path.exists(full_audio_path):
                aud_src = full_audio_path

        if aud_src and os.path.exists(aud_src):
            tmp_aud_name = f"_tmp_reorder_{uuid.uuid4().hex[:8]}_{scene.id}.{ext}"
            tmp_aud_path = os.path.join(project_dir, tmp_aud_name)
            try:
                shutil.move(aud_src, tmp_aud_path)
                temp_audio_map[scene.id] = tmp_aud_path
            except Exception as e:
                print(f"Error staging audio for scene {scene.id}: {e}")

        # 2. Canonical Image staging
        canonical_img = os.path.join(project_dir, f"scene_{old_num:03d}.png")
        if os.path.exists(canonical_img):
            tmp_img_name = f"_tmp_reorder_{uuid.uuid4().hex[:8]}_{scene.id}.png"
            tmp_img_path = os.path.join(project_dir, tmp_img_name)
            try:
                shutil.move(canonical_img, tmp_img_path)
                temp_img_map[scene.id] = tmp_img_path
            except Exception as e:
                print(f"Error staging canonical image for scene {scene.id}: {e}")

    # Phase 2: Place files into their new sequence numbers (1-indexed)
    timeline_dict = {}
    if project.timeline_data:
        try:
            timeline_dict = json.loads(project.timeline_data)
        except Exception:
            timeline_dict = {}
    old_volumes = timeline_dict.get("scene_volumes", {})
    new_volumes = {}
    old_motions = timeline_dict.get("scene_motions", {})
    new_motions = {}

    for new_idx, scene in enumerate(ordered_scenes):
        new_num = new_idx + 1
        old_num = scene.scene_number
        scene.scene_number = new_num

        # Remap volume
        if old_num is not None and str(old_num) in old_volumes:
            new_volumes[str(new_num)] = old_volumes[str(old_num)]

        if old_num is not None and str(old_num) in old_motions:
            new_motions[str(new_num)] = old_motions[str(old_num)]
        for kind in ("video", "motion"):
            staged = temp_video_map.get((scene.id, kind))
            if staged:
                shutil.move(staged, os.path.join(project_dir, f"scene_{new_num:03d}_{kind}.mp4"))

        # Place Audio
        new_canonical_aud = os.path.join(project_dir, f"scene_{new_num:03d}.{ext}")
        if scene.id in temp_audio_map:
            tmp_aud_path = temp_audio_map[scene.id]
            try:
                shutil.move(tmp_aud_path, new_canonical_aud)
                scene.audio_path = f"{slug}/scene_{new_num:03d}.{ext}"
            except Exception as e:
                print(f"Error moving audio to canonical path for scene {scene.id}: {e}")
        else:
            scene.audio_path = None
            if scene.audio_status == "completed":
                scene.audio_status = "idle"

        # Place Image
        new_canonical_img = os.path.join(project_dir, f"scene_{new_num:03d}.png")
        if scene.image_path:
            old_canonical_rel = f"{slug}/scene_{old_num:03d}.png" if old_num is not None else None
            # If image_path was previously pointing to canonical scene_{old_num}.png
            if old_canonical_rel and scene.image_path == old_canonical_rel and scene.id in temp_img_map:
                tmp_img_path = temp_img_map[scene.id]
                try:
                    shutil.move(tmp_img_path, new_canonical_img)
                    scene.image_path = f"{slug}/scene_{new_num:03d}.png"
                except Exception as e:
                    print(f"Error moving image to canonical path for scene {scene.id}: {e}")
            else:
                # Active image is a variant or external file
                src_img = os.path.join(workspace_dir, scene.image_path)
                if os.path.exists(src_img):
                    try:
                        shutil.copyfile(src_img, new_canonical_img)
                    except Exception as e:
                        print(f"Error copying variant to canonical image: {e}")
                elif scene.id in temp_img_map:
                    # Fallback to previously mirrored image
                    tmp_img_path = temp_img_map[scene.id]
                    try:
                        shutil.move(tmp_img_path, new_canonical_img)
                        scene.image_path = f"{slug}/scene_{new_num:03d}.png"
                    except Exception as e:
                        print(f"Error fallback moving image: {e}")
        elif scene.id in temp_img_map:
            # Had a canonical image without explicit image_path
            tmp_img_path = temp_img_map[scene.id]
            try:
                shutil.move(tmp_img_path, new_canonical_img)
                scene.image_path = f"{slug}/scene_{new_num:03d}.png"
            except Exception as e:
                print(f"Error moving canonical image: {e}")
        else:
            scene.image_path = None
            if os.path.exists(new_canonical_img):
                try:
                    os.remove(new_canonical_img)
                except Exception:
                    pass

    # Clean up any leftover temp files
    for p in list(temp_audio_map.values()) + list(temp_img_map.values()):
        if os.path.exists(p):
            try:
                os.remove(p)
            except Exception:
                pass

    # Save new timeline volumes
    if "scene_volumes" in timeline_dict or new_volumes:
        timeline_dict["scene_volumes"] = new_volumes
    timeline_dict["scene_motions"] = new_motions
    project.timeline_data = json.dumps(timeline_dict)

    db.commit()
    db.refresh(project)

    # Re-compile master voiceover with the new sequence
    try:
        from .services.voice_engine import compile_master_voiceover
        compile_master_voiceover(project.id, db)
    except Exception as e:
        print(f"Error recompiling master voiceover after reorder: {e}")

    # Synchronize structured JSON data
    sync_project_json(project.id, db)
    db.refresh(project)

    project.scenes.sort(key=lambda x: x.scene_number)
    return project


@app.post("/api/scenes/{scene_id}/refine")
def refine_image_prompt_endpoint(scene_id: int, payload: SceneRefine, db: Session = Depends(get_db)):
    # 1. Fetch target scene configuration from database
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Target scene structure not found.")
        
    # 2. Extract corresponding parent project context configurations
    project = db.query(Project).filter(Project.id == scene.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Parent project context not found.")
        
    # Gather database states with safe string fallbacks
    from .services.llm.orchestrators.educational_domain import detect_domain, get_educational_illustration_style
    project_domain = detect_domain(f"{project.title}\n{project.raw_research}\n{project.video_concept}")
    current_positive = scene.image_prompt_english or ""
    current_negative = scene.negative_prompt or ""
    global_style = project.illustration_style or get_educational_illustration_style(project_domain)
    video_concept = project.video_concept or ""
    
    # 3. Call the JSON refinement orchestrator
    from .services.llm.orchestrators.refinement import refine_scene_prompt
    updated_prompts = refine_scene_prompt(
        db=db,
        existing_prompt=current_positive,
        existing_negative_prompt=current_negative,
        user_instruction=payload.user_instruction,
        global_style=global_style,
        video_concept=video_concept
    )
    
    # 4. Save and commit updated strings back to SQLite cache
    scene.user_refinement_prompt = payload.user_instruction
    scene.image_prompt_english = updated_prompts.get("image_prompt_english", current_positive)
    scene.negative_prompt = updated_prompts.get("negative_prompt_english", current_negative)
    
    try:
        db.commit()
        db.refresh(scene)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database state commitment failure: {str(e)}")
        
    sync_project_json(scene.project_id, db)

    # 5. Return structured payload to frontend components
    return {
        "status": "success",
        "scene_id": scene.id,
        "image_prompt_english": scene.image_prompt_english,
        "negative_prompt_english": scene.negative_prompt
    }


@app.post("/api/scenes/{scene_id}/flow-adjust")
async def flow_adjust_scene_endpoint(scene_id: int, payload: FlowAdjustPayload, db: Session = Depends(get_db)):
    # 1. Fetch target scene
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Target scene structure not found.")

    # 2. Extract parent project context
    project = db.query(Project).filter(Project.id == scene.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Parent project context not found.")

    current_positive = scene.image_prompt_english or ""
    current_narration = scene.narration_khmer or ""
    current_negative = scene.negative_prompt or ""
    project_domain = detect_domain(f"{project.title}\n{project.raw_research}\n{project.video_concept}")
    global_style = project.illustration_style or get_educational_illustration_style(project_domain)
    video_concept = project.video_concept or ""
    theme_era = project.theme_era or ""
    theme_region = project.theme_region or "cambodia"
    scene_staging = project.scene_staging or "studio"

    # Always persist user refinement instruction
    scene.user_refinement_prompt = payload.instruction
    change_summary = f"Flow Scene Adjustment: {payload.instruction}"

    # Only mutate the base visual prompt and Khmer script if explicitly requested (e.g. Refine Text Only)
    from .services.flow_engine import find_flow_asset_for_image

    # Resolve target image (0 or 1): base image to modify
    target_image_path = None
    if payload.target_image is not None:
        target_image_path = payload.target_image.strip() if payload.target_image else None
    elif payload.reference_image is not None:
        target_image_path = payload.reference_image.strip() if payload.reference_image else None
    else:
        # Default target fallback to active scene image if nothing specified
        target_image_path = scene.image_path

    resolved_target = None
    target_asset_info = None
    target_info = None
    if target_image_path:
        target_asset_info = find_flow_asset_for_image(target_image_path)
        if os.path.isabs(target_image_path) and os.path.exists(target_image_path):
            resolved_target = target_image_path
        else:
            full_target = os.path.join(workspace_dir, target_image_path)
            resolved_target = full_target if os.path.exists(full_target) else target_image_path
        target_label = target_asset_info.get("display_name") if target_asset_info else os.path.basename(target_image_path)
        target_info = {
            "path": resolved_target,
            "label": f"Target Image ({target_label})",
            "description": "Base frame to modify slightly while preserving scene geometry and characters"
        }

    # Resolve reference guides (0 to N): style, outfit, and prop references
    raw_refs = []
    if payload.reference_images:
        raw_refs.extend(payload.reference_images)
    if scene.reference_images:
        try:
            stored_refs = json.loads(scene.reference_images)
            for r in stored_refs:
                if r and r not in raw_refs:
                    raw_refs.append(r)
        except Exception:
            pass

    # Exclude target from references
    if target_image_path:
        raw_refs = [r for r in raw_refs if r != target_image_path and r != resolved_target]

    resolved_refs = []
    reference_images_info = []
    for idx, ref in enumerate(raw_refs):
        if not ref:
            continue
        abs_r = ref if (os.path.isabs(ref) and os.path.exists(ref)) else os.path.join(workspace_dir, ref)
        candidate_r = abs_r if os.path.exists(abs_r) else ref
        if candidate_r not in resolved_refs:
            resolved_refs.append(candidate_r)
            r_asset = find_flow_asset_for_image(ref)
            r_name = r_asset.get("display_name") if r_asset else os.path.basename(ref)
            reference_images_info.append({
                "path": candidate_r,
                "label": f"Ref #{idx+1} ({r_name})",
                "description": "Visual reference guide for style, outfit, or attributes"
            })

    if payload.refine_prompt_text:
        from .services.llm.orchestrators.refinement import refine_scene_prompt_and_script
        result = refine_scene_prompt_and_script(
            db=db,
            existing_prompt=current_positive,
            existing_narration=current_narration,
            existing_negative_prompt=current_negative,
            user_instruction=payload.instruction,
            global_style=global_style,
            video_concept=video_concept,
            theme_era=theme_era,
            theme_region=theme_region,
            scene_staging=scene_staging,
            target_info=target_info,
            reference_images_info=reference_images_info
        )
        scene.image_prompt_english = result.get("image_prompt_english", current_positive)
        scene.narration_khmer = result.get("narration_khmer", current_narration)
        scene.negative_prompt = result.get("negative_prompt_english", current_negative)
        change_summary = result.get("change_summary", "Refined prompt and narration text.")

    try:
        db.commit()
        db.refresh(scene)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database state commitment failure: {str(e)}")

    sync_project_json(scene.project_id, db)

    # 4. Trigger immediate image generation via Flow MCP / queue
    generating = False
    if payload.generate_image:
        ref_summary = ", ".join([r["label"] for r in reference_images_info]) if reference_images_info else "none"
        if resolved_target:
            t_name = target_asset_info.get("display_name") if target_asset_info else os.path.basename(target_image_path)
            gen_prompt = f"Modify target image '{t_name}': {payload.instruction}. Borrow visual styling from references: {ref_summary}. Base scene: {scene.image_prompt_english}"
        else:
            gen_prompt = f"Create new scene from scratch: {payload.instruction}. Incorporate styling and characters from references: {ref_summary}. Scene context: {scene.image_prompt_english}"

        # Place target image at position 0 so Flow treats it as primary img2img canvas
        flow_refs = ([resolved_target] if resolved_target else []) + [r for r in resolved_refs if r != resolved_target]

        task_payload = {
            "prompt": gen_prompt,
            "instruction": payload.instruction,
            "target_image": resolved_target,
            "style": project.illustration_style,
            "negative_prompt": scene.negative_prompt,
            "aspect_ratio": payload.aspect_ratio or project.aspect_ratio or "16:9",
            "guidance_scale": 7.5,
            "inference_steps": 10,
            "model": payload.model or "nano2",
            "count": payload.count or 1,
            "image_provider": payload.image_provider or "flow",
            "reference_images": flow_refs,
        }

        task = GenerationTask(
            task_type="image",
            project_id=scene.project_id,
            scene_id=scene.id,
            payload=task_payload
        )
        await task_queue.put(task)
        scene.image_status = "processing"
        db.commit()
        generating = True

    return {
        "status": "success",
        "scene_id": scene.id,
        "image_prompt_english": scene.image_prompt_english,
        "narration_khmer": scene.narration_khmer,
        "negative_prompt_english": scene.negative_prompt,
        "target_image": target_image_path,
        "reference_images": [r["path"] for r in reference_images_info],
        "change_summary": change_summary,
        "generating": generating
    }



@app.post("/api/scenes/{scene_id}/generate-image")
async def generate_scene_image(scene_id: int, payload: ImageGeneratePayload, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
        
    if scene.image_status == "processing":
        return {"status": "already_queued"}

    project = db.query(Project).filter(Project.id == scene.project_id).first()
    setting = db.query(Setting).first()

    # Resolve target image and references
    target_img = payload.target_image
    refs = []
    if payload.reference_images:
        refs.extend(payload.reference_images)
    if scene.reference_images:
        try:
            stored_refs = json.loads(scene.reference_images)
            for r in stored_refs:
                if r and r not in refs:
                    refs.append(r)
        except Exception:
            pass

    if target_img and target_img in refs:
        refs.remove(target_img)
    if target_img:
        refs.insert(0, target_img)

    task_payload = {
        "prompt": scene.image_prompt_english,
        "style": project.illustration_style,
        "negative_prompt": scene.negative_prompt,
        "aspect_ratio": payload.aspect_ratio or project.aspect_ratio or "16:9",
        "guidance_scale": payload.guidance_scale or 7.5,
        "inference_steps": payload.inference_steps or 10,
        "model": payload.model or "nano2",
        "count": payload.count or 1,
        "image_provider": payload.image_provider or (setting.image_provider if setting else "local") or "local",
        "target_image": target_img,
        "reference_images": refs,
    }
    
    task = GenerationTask(
        task_type="image",
        project_id=scene.project_id,
        scene_id=scene.id,
        payload=task_payload
    )
    
    await task_queue.put(task)
    
    scene.image_status = "processing"
    db.commit()
    return {"status": "queued"}

@app.post("/api/projects/{project_id}/generate-images")
async def generate_project_images(project_id: int, payload: ImageGeneratePayload, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    scenes = db.query(Scene).filter(Scene.project_id == project_id).order_by(Scene.scene_number.asc()).all()

    queued_count = 0
    for scene in scenes:
        if payload.scene_ids is not None and scene.id not in payload.scene_ids:
            continue

        if payload.skip_existing and scene.image_path:
            continue

        prompt = scene.image_prompt_english or scene.narration_khmer or ""
        if not prompt.strip():
            continue

        if scene.image_status == "processing":
            continue

        refs = []
        if payload.reference_images:
            refs = payload.reference_images
        elif scene.reference_images:
            try:
                refs = json.loads(scene.reference_images)
            except Exception:
                refs = []

        task_payload = {
            "prompt": prompt,
            "style": project.illustration_style,
            "negative_prompt": scene.negative_prompt,
            "aspect_ratio": payload.aspect_ratio or project.aspect_ratio or "16:9",
            "guidance_scale": payload.guidance_scale or 7.5,
            "inference_steps": payload.inference_steps or 10,
            "model": payload.model or "nano2",
            "count": payload.count or 1,
            "image_provider": payload.image_provider,
            "reference_images": refs,
        }

        task = GenerationTask(
            task_type="image",
            project_id=scene.project_id,
            scene_id=scene.id,
            payload=task_payload
        )

        await task_queue.put(task)
        scene.image_status = "processing"
        queued_count += 1

    db.commit()
    return {"status": "queued", "count": queued_count}

@app.post("/api/projects/{project_id}/stop-images")
async def stop_project_images(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    scenes = db.query(Scene).filter(Scene.project_id == project_id).all()
    count = 0
    for scene in scenes:
        if scene.image_status == "processing":
            scene.image_status = "completed" if scene.image_path else "idle"
            count += 1

    db.commit()

    try:
        requests.post("http://127.0.0.1:7860/sdapi/v1/interrupt", timeout=2)
    except Exception as e:
        print(f"Interrupt API unreachable or failed: {e}")

    return {"status": "stopped", "cancelled_count": count}

@app.post("/api/scenes/{scene_id}/upload-image")
async def upload_scene_image(scene_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    project = db.query(Project).filter(Project.id == scene.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".png"
    if ext not in [".png", ".jpg", ".jpeg", ".webp"]:
        ext = ".png"

    ts = int(time.time())
    proj_dir = os.path.join(workspace_dir, project.slug)
    os.makedirs(proj_dir, exist_ok=True)
    filename = f"scene_{scene.scene_number:03d}_upload_{ts}{ext}"
    dest_path = os.path.join(proj_dir, filename)

    with open(dest_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    rel_path = f"{project.slug}/{filename}"

    try:
        current_images = json.loads(scene.images_list) if scene.images_list else []
    except Exception:
        current_images = []

    if rel_path not in current_images:
        current_images.append(rel_path)

    scene.images_list = json.dumps(current_images)
    scene.image_path = rel_path
    scene.image_status = "completed"

    generation = Generation(
        scene_id=scene.id,
        provider="upload",
        prompt="Manual direct file upload",
        output_paths=json.dumps([rel_path]),
        status="completed"
    )
    db.add(generation)
    db.commit()

    mirror_canonical_scene_image(project.slug, scene.scene_number, rel_path)
    sync_project_json(scene.project_id, db)

    return {
        "status": "success",
        "image_path": rel_path,
        "images_list": current_images
    }

@app.put("/api/scenes/{scene_id}/set-active-image")
async def set_active_scene_image(scene_id: int, payload: SetActiveImagePayload, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    project = db.query(Project).filter(Project.id == scene.project_id).first()

    try:
        current_images = json.loads(scene.images_list) if scene.images_list else []
    except Exception:
        current_images = []

    if payload.image_path not in current_images:
        current_images.append(payload.image_path)
        scene.images_list = json.dumps(current_images)

    scene.image_path = payload.image_path
    scene.image_status = "completed"
    db.commit()

    if project:
        mirror_canonical_scene_image(project.slug, scene.scene_number, scene.image_path)
        sync_project_json(scene.project_id, db)

    return {
        "status": "success",
        "image_path": scene.image_path,
        "images_list": current_images
    }

@app.post("/api/scenes/{scene_id}/plan-image")
async def plan_scene_image(scene_id: int, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    project = db.query(Project).filter(Project.id == scene.project_id).first()
    if scene.image_status == "processing" or scene.video_status in ("queued", "processing"):
        raise HTTPException(status_code=409, detail="Wait for scene generation to finish first.")
    from .services.llm.client import generate_text
    response = generate_text(db,
        "Return only a JSON object with image_prompt_english and video_prompt. "
        "Describe one clear starting frame in image_prompt_english (35-55 English words). "
        "In video_prompt describe motion from that frame, with consistent characters, no dialogue and no on-screen text. "
        "Respect the supplied story context and visual style.",
        f"Narration: {scene.narration_khmer or ''}\nExisting motion: {scene.video_prompt or ''}\nStyle: {project.illustration_style or 'Minimalist flat 2D educational illustration'}\nConcept: {project.video_concept or ''}",
        json_mode=True)
    try:
        plan = json.loads(response.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip())
        image_prompt = plan.get("image_prompt_english", "").strip()
        if not image_prompt:
            raise ValueError("Missing image prompt")
    except (ValueError, TypeError, AttributeError) as exc:
        raise HTTPException(status_code=422, detail="The AI did not return a valid image plan. Please try again.") from exc
    scene.image_prompt_english = image_prompt
    if not scene.video_prompt:
        scene.video_prompt = (plan.get("video_prompt") or "").strip()[:4000]
    db.commit()
    sync_project_json(project.id, db)
    return {"status": "planned", "image_prompt_english": image_prompt}


@app.post("/api/scenes/{scene_id}/generate-video", status_code=202)
async def generate_scene_video(scene_id: int, payload: VideoGeneratePayload, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    project = db.query(Project).filter(Project.id == scene.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if scene.video_status in ("queued", "processing"):
        return {"status": scene.video_status, "scene_id": scene.id}
    if project.aspect_ratio not in ("16:9", "9:16"):
        raise HTTPException(status_code=400, detail="Flow animation supports 16:9 and 9:16 projects.")
    prompt = payload.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=422, detail="Enter a motion prompt.")
    # Animation always starts from the selected still and measured narration.
    canonical = os.path.join(workspace_dir, project.slug, f"scene_{scene.scene_number:03d}.png")
    image_path = os.path.join(workspace_dir, scene.image_path) if scene.image_path else canonical
    if not os.path.isfile(image_path):
        raise HTTPException(status_code=400, detail="Generate or upload a scene image first.")
    try:
        duration = ready_voice_duration(scene, project, workspace_dir)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if image_path and os.path.commonpath([os.path.realpath(workspace_dir), os.path.realpath(image_path)]) != os.path.realpath(workspace_dir):
        raise HTTPException(status_code=400, detail="Scene image must be inside the workspace.")
    try:
        animation_timeline = json.loads(project.timeline_data or "{}")
    except (ValueError, TypeError):
        animation_timeline = {}
    if not isinstance(animation_timeline, dict):
        animation_timeline = {}
    animation_timeline["animation_mode"] = "ai_video"
    project.timeline_data = json.dumps(animation_timeline)
    scene.video_status = "queued"
    scene.video_error = None
    scene.video_prompt = prompt
    scene.video_model = payload.model
    db.commit()
    await task_queue.put(GenerationTask(
        task_type="video", project_id=project.id, scene_id=scene.id,
        payload={"prompt": prompt, "model": payload.model, "image_path": image_path, "duration": duration},
    ))
    return {"status": "queued", "scene_id": scene.id, "duration": duration}


@app.post("/api/scenes/{scene_id}/generate-motion")
async def generate_scene_motion(scene_id: int, payload: MotionGeneratePayload, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    project = db.query(Project).filter(Project.id == scene.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if scene.video_status in ("queued", "processing"):
        raise HTTPException(status_code=409, detail="Wait for this scene animation to finish first.")

    proj_dir = os.path.join(workspace_dir, project.slug)
    canonical_img = os.path.join(proj_dir, f"scene_{scene.scene_number:03d}.png")
    if not os.path.exists(canonical_img) and scene.image_path:
        canonical_img = os.path.join(workspace_dir, scene.image_path)
    
    if not os.path.exists(canonical_img):
        raise HTTPException(status_code=400, detail="Scene does not have an image to animate")

    try:
        dur = ready_voice_duration(scene, project, workspace_dir)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    motion_type = payload.motion_type or "zoom_in"
    if motion_type == "auto":
        cycle = ["zoom_in", "pan_right", "zoom_out", "pan_left"]
        motion_type = cycle[(scene.scene_number - 1) % len(cycle)]

    out_clip = os.path.join(proj_dir, f"scene_{scene.scene_number:03d}_motion.mp4")
    try:
        scene_animator.render_camera_motion_clip(
            image_path=canonical_img,
            output_path=out_clip,
            duration=dur,
            motion_type=motion_type,
            aspect_ratio=project.aspect_ratio or "16:9"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Motion generation failed: {str(e)}")

    old_ai_clip = os.path.join(proj_dir, f"scene_{scene.scene_number:03d}_video.mp4")
    if os.path.isfile(old_ai_clip):
        history = os.path.join(proj_dir, "_scene_history")
        os.makedirs(history, exist_ok=True)
        os.replace(old_ai_clip, os.path.join(history, f"scene_{scene.id}_{uuid.uuid4().hex}_video.mp4"))
    scene.video_status = "completed"
    scene.video_error = None
    db.commit()
    rel_video = f"{project.slug}/scene_{scene.scene_number:03d}_motion.mp4"
    return {
        "status": "completed",
        "video_path": rel_video,
        "motion_type": motion_type,
        "duration": dur
    }

@app.post("/api/scenes/{scene_id}/upload-video")
async def upload_scene_video(scene_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    if scene.video_status in ("queued", "processing"):
        raise HTTPException(status_code=409, detail="Wait for this scene animation to finish.")
    project = db.query(Project).filter(Project.id == scene.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    proj_dir = os.path.join(workspace_dir, project.slug)
    os.makedirs(proj_dir, exist_ok=True)
    dest_path = os.path.join(proj_dir, f"scene_{scene.scene_number:03d}_video.mp4")

    with open(dest_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    scene.video_status = "completed"
    scene.video_error = None
    db.commit()

    rel_video = f"{project.slug}/scene_{scene.scene_number:03d}_video.mp4"
    return {
        "status": "completed",
        "video_path": rel_video
    }

@app.delete("/api/scenes/{scene_id}/animation-video")
async def delete_scene_animation_video(scene_id: int, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    if scene.video_status in ("queued", "processing"):
        raise HTTPException(status_code=409, detail="Wait for this scene animation to finish.")
    project = db.query(Project).filter(Project.id == scene.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    proj_dir = os.path.join(workspace_dir, project.slug)
    ai_video = os.path.join(proj_dir, f"scene_{scene.scene_number:03d}_video.mp4")
    motion_video = os.path.join(proj_dir, f"scene_{scene.scene_number:03d}_motion.mp4")

    removed = []
    if os.path.exists(ai_video):
        os.remove(ai_video)
        removed.append("ai_video")
    if os.path.exists(motion_video):
        os.remove(motion_video)
        removed.append("motion_video")

    scene.video_status = "idle"
    scene.video_error = None
    db.commit()

    return {
        "status": "success",
        "removed": removed
    }

@app.delete("/api/scenes/{scene_id}/image-variant")
async def delete_scene_image_variant(scene_id: int, image_path: str, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    project = db.query(Project).filter(Project.id == scene.project_id).first()

    full_path = os.path.join(workspace_dir, image_path)
    if os.path.exists(full_path):
        try:
            os.remove(full_path)
        except OSError as e:
            print(f"Error removing variant file {full_path}: {e}")

    try:
        current_images = json.loads(scene.images_list) if scene.images_list else []
    except Exception:
        current_images = []

    if image_path in current_images:
        current_images.remove(image_path)
    scene.images_list = json.dumps(current_images)

    if scene.image_path == image_path:
        scene.image_path = current_images[0] if len(current_images) > 0 else None
        if not scene.image_path:
            scene.image_status = "idle"

    db.commit()

    if project:
        mirror_canonical_scene_image(project.slug, scene.scene_number, scene.image_path)
        sync_project_json(scene.project_id, db)

    return {
        "status": "success",
        "image_path": scene.image_path,
        "images_list": current_images
    }

@app.post("/api/scenes/{scene_id}/generate-motion")
async def generate_scene_motion(scene_id: int, payload: MotionGeneratePayload, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    project = db.query(Project).filter(Project.id == scene.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if scene.video_status in ("queued", "processing"):
        raise HTTPException(status_code=409, detail="Wait for this scene animation to finish first.")

    proj_dir = os.path.join(workspace_dir, project.slug)
    canonical_img = os.path.join(proj_dir, f"scene_{scene.scene_number:03d}.png")
    if not os.path.exists(canonical_img) and scene.image_path:
        canonical_img = os.path.join(workspace_dir, scene.image_path)
    
    if not os.path.exists(canonical_img):
        raise HTTPException(status_code=400, detail="Scene does not have an image to animate")

    try:
        dur = ready_voice_duration(scene, project, workspace_dir)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    motion_type = payload.motion_type or "zoom_in"
    if motion_type == "auto":
        cycle = ["zoom_in", "pan_right", "zoom_out", "pan_left"]
        motion_type = cycle[(scene.scene_number - 1) % len(cycle)]

    out_clip = os.path.join(proj_dir, f"scene_{scene.scene_number:03d}_motion.mp4")
    try:
        scene_animator.render_camera_motion_clip(
            image_path=canonical_img,
            output_path=out_clip,
            duration=dur,
            motion_type=motion_type,
            aspect_ratio=project.aspect_ratio or "16:9"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Motion generation failed: {str(e)}")

    old_ai_clip = os.path.join(proj_dir, f"scene_{scene.scene_number:03d}_video.mp4")
    if os.path.isfile(old_ai_clip):
        history = os.path.join(proj_dir, "_scene_history")
        os.makedirs(history, exist_ok=True)
        os.replace(old_ai_clip, os.path.join(history, f"scene_{scene.id}_{uuid.uuid4().hex}_video.mp4"))
    scene.video_status = "completed"
    scene.video_error = None
    db.commit()
    rel_video = f"{project.slug}/scene_{scene.scene_number:03d}_motion.mp4"
    return {
        "status": "completed",
        "video_path": rel_video,
        "motion_type": motion_type,
        "duration": dur
    }

@app.post("/api/scenes/{scene_id}/upload-video")
async def upload_scene_video(scene_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    if scene.video_status in ("queued", "processing"):
        raise HTTPException(status_code=409, detail="Wait for this scene animation to finish.")
    project = db.query(Project).filter(Project.id == scene.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    proj_dir = os.path.join(workspace_dir, project.slug)
    os.makedirs(proj_dir, exist_ok=True)
    dest_path = os.path.join(proj_dir, f"scene_{scene.scene_number:03d}_video.mp4")

    with open(dest_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    scene.video_status = "completed"
    scene.video_error = None
    db.commit()

    rel_video = f"{project.slug}/scene_{scene.scene_number:03d}_video.mp4"
    return {
        "status": "completed",
        "video_path": rel_video
    }

@app.delete("/api/scenes/{scene_id}/animation-video")
async def delete_scene_animation_video(scene_id: int, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    if scene.video_status in ("queued", "processing"):
        raise HTTPException(status_code=409, detail="Wait for this scene animation to finish.")
    project = db.query(Project).filter(Project.id == scene.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    proj_dir = os.path.join(workspace_dir, project.slug)
    ai_video = os.path.join(proj_dir, f"scene_{scene.scene_number:03d}_video.mp4")
    motion_video = os.path.join(proj_dir, f"scene_{scene.scene_number:03d}_motion.mp4")

    removed = []
    if os.path.exists(ai_video):
        os.remove(ai_video)
        removed.append("ai_video")
    if os.path.exists(motion_video):
        os.remove(motion_video)
        removed.append("motion_video")

    scene.video_status = "idle"
    scene.video_error = None
    db.commit()

    return {
        "status": "success",
        "removed": removed
    }

@app.post("/api/scenes/{scene_id}/reference-image")
async def add_scene_reference_image(
    scene_id: int,
    file: Optional[UploadFile] = File(None),
    reference_path: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    project = db.query(Project).filter(Project.id == scene.project_id).first()

    try:
        current_refs = json.loads(scene.reference_images) if scene.reference_images else []
    except Exception:
        current_refs = []

    if file:
        ts = int(time.time())
        ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".png"
        proj_dir = os.path.join(workspace_dir, project.slug)
        os.makedirs(proj_dir, exist_ok=True)
        filename = f"scene_{scene.scene_number:03d}_ref_{ts}{ext}"
        dest_path = os.path.join(proj_dir, filename)
        with open(dest_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        rel_path = f"{project.slug}/{filename}"
        if rel_path not in current_refs:
            current_refs.append(rel_path)
    elif reference_path:
        if reference_path not in current_refs:
            current_refs.append(reference_path)
    else:
        raise HTTPException(status_code=400, detail="Must provide either file or reference_path")

    scene.reference_images = json.dumps(current_refs)
    db.commit()
    return {"status": "success", "reference_images": current_refs}

@app.delete("/api/scenes/{scene_id}/reference-image")
async def remove_scene_reference_image(scene_id: int, reference: str, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    try:
        current_refs = json.loads(scene.reference_images) if scene.reference_images else []
    except Exception:
        current_refs = []

    if reference in current_refs:
        current_refs.remove(reference)

    scene.reference_images = json.dumps(current_refs)
    db.commit()
    return {"status": "success", "reference_images": current_refs}

@app.post("/api/scenes/{scene_id}/stop")
async def stop_scene_generation(scene_id: int, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
        
    scene.image_status = "completed" if scene.image_path else "idle"
    db.commit()
    
    try:
        requests.post("http://127.0.0.1:7860/sdapi/v1/interrupt", timeout=2)
    except Exception as e:
        print(f"Interrupt API unreachable or failed: {e}")
        
    return {"status": "stopped"}

@app.delete("/api/scenes/{scene_id}/image")
async def delete_scene_image(scene_id: int, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
        
    if scene.image_path:
        full_path = os.path.join(workspace_dir, scene.image_path)
        if os.path.exists(full_path):
            try:
                os.remove(full_path)
            except OSError as e:
                print(f"Error removing file {full_path}: {e}")
            
    scene.image_path = None
    scene.images_list = "[]"
    scene.image_status = "idle"
    db.commit()
    
    return {"status": "success"}

@app.delete("/api/scenes/{scene_id}/audio")
async def delete_scene_audio(scene_id: int, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
        
    project = db.query(Project).filter(Project.id == scene.project_id).first()
    
    if scene.audio_path:
        full_path = os.path.join(workspace_dir, scene.audio_path)
        if os.path.exists(full_path):
            try:
                os.remove(full_path)
            except OSError as e:
                print(f"Error removing audio file {full_path}: {e}")
            
    scene.audio_path = None
    scene.audio_status = "idle"
    
    # Also invalidate master voiceover since a scene was removed
    if project and project.master_audio_path:
        full_master = os.path.join(workspace_dir, project.master_audio_path)
        if os.path.exists(full_master):
            try:
                os.remove(full_master)
            except OSError:
                pass
        project.master_audio_path = None
        
    db.commit()
    if project:
        sync_project_json(project.id, db)
    
    return {"status": "success"}

@app.post("/api/scenes/{scene_id}/generate-audio")
async def generate_scene_audio_single(scene_id: int, character_id: Optional[int] = None, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
        
    project = db.query(Project).filter(Project.id == scene.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not scene.narration_khmer:
        raise HTTPException(status_code=400, detail="Scene has no narration text.")
        
    if scene.audio_status == "processing":
        return {"status": "already_processing"}
        
    scene.audio_status = "processing"
    scene.audio_error = None
    
    target_char_id = character_id if character_id is not None else scene.character_id
    task_payload = {
        "text": scene.narration_khmer,
        "cfg_value": project.voice_cfg_value,
        "inference_steps": project.voice_inference_steps,
        "profile_tag": project.voice_profile_tag,
        "voice_provider": project.voice_provider or "voxcpm2",
        "gemini_voice_name": project.gemini_voice_name or "Puck",
        "gemini_voice_style": project.gemini_voice_style or "ted_ed",
    }
    if target_char_id is not None:
        task_payload["character_id"] = target_char_id
        
    task = GenerationTask(
        task_type="audio_single" if target_char_id else "audio",
        project_id=project.id,
        scene_id=scene.id,
        payload=task_payload
    )
    await task_queue.put(task)
    
    db.commit()
    
    return {"status": "queued"}

# Global Character Routing

@app.get("/api/characters", response_model=List[CharacterOut])
async def get_characters(db: Session = Depends(get_db)):
    characters = db.query(Character).order_by(Character.name).all()
    return characters

@app.post("/api/characters/preview")
async def create_character_preview(payload: PreviewPayload):
    from .services.voice_engine import generate_character_preview
    path = generate_character_preview(payload.personality_tag, payload.reference_text, payload.cfg_value, payload.inference_steps)
    return {"status": "success", "audio_path": path}

@app.post("/api/characters/{character_id}/audition")
async def audition_character(character_id: int, payload: VoiceSynthesisSettings, db: Session = Depends(get_db)):
    character = db.query(Character).filter(Character.id == character_id).first()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    if character.audio_path:
        if not os.path.isfile(os.path.join(workspace_dir, character.audio_path)):
            raise HTTPException(status_code=404, detail="Voice reference audio is missing. Please recreate this voice profile.")
        return {"status": "success", "audio_path": character.audio_path}

    path = voice_engine.ensure_character_reference(
        character.id, character.personality_tag, character.reference_text,
        payload.cfg_value, payload.inference_steps,
    )
    character.audio_path = path
    db.commit()
    return {"status": "success", "audio_path": path}


@app.delete("/api/characters/preview")
async def delete_character_preview():
    temp_preview_path = os.path.join(SHARED_CHARACTERS_DIR, "temp_preview.wav")
    if os.path.exists(temp_preview_path):
        os.remove(temp_preview_path)
    return {"status": "success", "message": "Preview deleted"}

@app.post("/api/characters/preview-clone")
async def create_clone_preview(
    reference_text: str = Form(...),
    text_to_speak: str = Form("កាលពី ១ម៉ឺនឆ្នាំមុន មនុស្សសម័យបុរេប្រវត្តិ បានរកឃើញអាថ៌កំបាំងមួយយ៉ាងអស្ចារ្យ។"),
    audio_file: UploadFile = File(...),
    cfg_value: float = Form(2.0, ge=1.0, le=5.0),
    inference_steps: int = Form(15, ge=4, le=50),
):
    from .services.voice_engine import generate_clone_preview
    from .database import CUSTOM_VOICES_DIR
    
    print(f"DEBUG: audio_file.filename = {audio_file.filename}, audio_file.size = {getattr(audio_file, 'size', 'unknown')}")
    
    temp_upload_path = os.path.join(CUSTOM_VOICES_DIR, "temp_clone_upload.wav")
    await audio_file.seek(0)
    content = await audio_file.read()
    
    print(f"DEBUG: len(content) = {len(content)}")
    
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded audio file is empty (0 bytes). Please select a valid audio file.")
    
    with open(temp_upload_path, "wb") as buffer:
        buffer.write(content)
        
    path = generate_clone_preview(temp_upload_path, reference_text, text_to_speak, cfg_value, inference_steps)
    return {"status": "success", "audio_path": path}

@app.delete("/api/characters/preview-clone")
async def delete_clone_preview():
    from .database import CUSTOM_VOICES_DIR
    temp_preview_path = os.path.join(CUSTOM_VOICES_DIR, "temp_clone_preview.wav")
    temp_upload_path = os.path.join(CUSTOM_VOICES_DIR, "temp_clone_upload.wav")
    if os.path.exists(temp_preview_path):
        os.remove(temp_preview_path)
    if os.path.exists(temp_upload_path):
        os.remove(temp_upload_path)
    return {"status": "success", "message": "Clone preview deleted"}

@app.post("/api/characters", response_model=CharacterOut)
async def create_character(
    name: str = Form(...),
    gender: str = Form(...),
    personality_tag: str = Form(...),
    reference_text: str = Form(...),
    audio_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    slug_name = re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')
    
    if audio_file:
        from .database import CUSTOM_VOICES_DIR
        file_extension = os.path.splitext(audio_file.filename)[1] or '.wav'
        filename = f"{slug_name}{file_extension}"
        save_path = os.path.join(CUSTOM_VOICES_DIR, filename)
        
        await audio_file.seek(0)
        content = await audio_file.read()
        
        if not content:
            raise HTTPException(status_code=400, detail="The uploaded audio file is empty (0 bytes). Please select a valid audio file.")
            
        with open(save_path, "wb") as buffer:
            buffer.write(content)
            
        rel_audio_path = os.path.join("custom_voices", filename).replace("\\", "/")
    else:
        temp_preview_path = os.path.join(SHARED_CHARACTERS_DIR, "temp_preview.wav")
        if not os.path.exists(temp_preview_path):
            raise HTTPException(status_code=400, detail="No audio file uploaded and no preview found")
            
        filename = f"{slug_name}.wav"
        save_path = os.path.join(SHARED_CHARACTERS_DIR, filename)
        
        shutil.move(temp_preview_path, save_path)
        rel_audio_path = os.path.join("shared_characters", filename).replace("\\", "/")
    
    character = Character(
        name=name,
        gender=gender,
        personality_tag=personality_tag,
        reference_text=reference_text,
        audio_path=rel_audio_path
    )
    db.add(character)
    db.commit()
    db.refresh(character)
    
    return character

@app.delete("/api/characters/{character_id}")
async def delete_character(character_id: int, db: Session = Depends(get_db)):
    character = db.query(Character).filter(Character.id == character_id).first()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
        
    if character.audio_path:
        full_path = os.path.join(workspace_dir, character.audio_path)
        if os.path.exists(full_path):
            try:
                os.remove(full_path)
            except OSError as e:
                print(f"Error removing character file {full_path}: {e}")
                
    db.delete(character)
    db.commit()
    return {"status": "success", "message": "Character deleted"}

@app.post("/api/projects/{project_id}/assign-character")
async def assign_project_character(project_id: int, character_id: Optional[int] = None, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    char_name = None
    if character_id is not None:
        char = db.query(Character).filter(Character.id == character_id).first()
        if not char:
            raise HTTPException(status_code=404, detail="Character not found")
        char_name = char.name

    for scene in project.scenes:
        if scene.character_id != character_id:
            if scene.audio_status == "completed" or scene.audio_path:
                scene.audio_status = "outdated"
        scene.character_id = character_id
        scene.character_name = char_name

    db.commit()
    sync_project_json(project.id, db)
    return {"status": "success", "character_id": character_id, "character_name": char_name}

# Gemini 3.8 Flash TTS Voice & Style Endpoints
@app.get("/api/voice/gemini-voices")
async def get_gemini_voices():
    from .services.gemini_tts import GEMINI_VOICES, GEMINI_STYLES
    return {
        "voices": GEMINI_VOICES,
        "styles": GEMINI_STYLES
    }

@app.post("/api/voice/gemini-preview")
async def create_gemini_voice_preview(payload: GeminiVoicePreviewPayload, db: Session = Depends(get_db)):
    from .services.gemini_tts import generate_gemini_preview
    try:
        path = generate_gemini_preview(
            voice_name=payload.voice_name or "Puck",
            style_direction=payload.style_direction or "ted_ed",
            sample_text=payload.sample_text,
            db_session=db
        )
        return {"status": "success", "audio_path": path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini TTS Preview failed: {str(e)}")

# Tab 3 & 4 routes
@app.post("/api/projects/{project_id}/generate-voice")
async def generate_project_voice(project_id: int, character_id: Optional[int] = None, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    scenes = db.query(Scene).filter(Scene.project_id == project_id).all()
    
    queued_count = 0
    for scene in scenes:
        if scene.narration_khmer and scene.audio_status != "processing":
            payload = {
                "text": scene.narration_khmer,
                "cfg_value": project.voice_cfg_value,
                "inference_steps": project.voice_inference_steps,
                "profile_tag": project.voice_profile_tag,
                "voice_provider": project.voice_provider or "voxcpm2",
                "gemini_voice_name": project.gemini_voice_name or "Puck",
                "gemini_voice_style": project.gemini_voice_style or "ted_ed",
            }
            target_char_id = character_id or scene.character_id
            if target_char_id:
                payload["character_id"] = target_char_id
                
            task = GenerationTask(
                task_type="audio_single" if target_char_id else "audio",
                project_id=project.id,
                scene_id=scene.id,
                payload=payload
            )
            await task_queue.put(task)
            scene.audio_status = "processing"
            scene.audio_error = None
            queued_count += 1
            
    db.commit()
    return {"status": "queued", "count": queued_count}

@app.post("/api/projects/{project_id}/stop-voice")
async def stop_project_voice(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    scenes = db.query(Scene).filter(Scene.project_id == project_id).all()
    count = 0
    for scene in scenes:
        if scene.audio_status == "processing":
            scene.audio_status = "idle"
            count += 1
            
    db.commit()
    return {"status": "stopped", "cancelled_count": count}

@app.post("/api/model/load")
async def load_voice_model():
    success = await asyncio.to_thread(voice_engine.load_model)
    return {"status": "success" if success else "failed"}

@app.post("/api/model/unload")
async def unload_voice_model():
    success = await asyncio.to_thread(voice_engine.unload_model)
    return {"status": "success" if success else "failed"}

@app.get("/api/model/status")
async def get_model_status():
    progress = voice_engine.get_model_download_progress() if voice_engine._MODEL_STATE == "loading" else None
    return {
        "state": voice_engine._MODEL_STATE,
        "download_progress": progress
    }

# ----------------------------------------------------
# Tab 4: Assembly & Video Synthesis Endpoints
# ----------------------------------------------------

@app.get("/api/projects/{project_id}/assembly-status")
async def get_assembly_status(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    status_data = render_engine.get_project_coupling_status(project, db)
    return status_data

class SubtitlePreviewRequest(BaseModel):
    text: str = Field(max_length=4000)
    aspect_ratio: Literal["16:9", "9:16", "1:1", "4:3", "2:3"] = "16:9"
    mode: Literal["kinetic", "classic", "off"] = "kinetic"
    size: Literal["sm", "md", "lg"] = "md"
    position: Literal["bottom", "center", "top"] = "bottom"
    style: dict = Field(default_factory=dict)


@app.post("/api/subtitles/preview")
def preview_subtitles(payload: SubtitlePreviewRequest):
    from .services.subtitle_preview import render_preview
    from .services.subtitle_style import normalize_style
    try:
        style = normalize_style(payload.style, mode=payload.mode, size=payload.size)
        width, height = render_engine.ASPECT_RATIO_RESOLUTIONS[payload.aspect_ratio]
        return render_preview(payload.text, width, height,
                              json.dumps(dict(mode=payload.mode, size=payload.size,
                                              position=payload.position, style=style), sort_keys=True),
                              render_engine.get_best_khmer_font())
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail="Could not render subtitle preview. Check FFmpeg/libass installation.") from error


@app.put("/api/projects/{project_id}/timeline")
async def save_project_timeline(project_id: int, payload: dict, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.timeline_data = json.dumps(payload)
    db.commit()
    return {"status": "saved", "timeline_data": payload}

@app.post("/api/projects/{project_id}/upload-bgm")
async def upload_project_bgm(project_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    slug = project.slug or f"project-{project.id}"
    bgm_dir = os.path.join(render_engine.WORKSPACE_DIR, slug, "bgm")
    os.makedirs(bgm_dir, exist_ok=True)

    # Sanitize filename
    safe_name = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', file.filename)
    target_path = os.path.join(bgm_dir, safe_name)

    with open(target_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    dur = render_engine.get_audio_duration(target_path)
    file_info = {
        "filename": safe_name,
        "relative_path": f"{slug}/bgm/{safe_name}",
        "duration": round(dur, 2),
        "size_bytes": os.path.getsize(target_path)
    }

    return {"status": "uploaded", "file": file_info}

class GenerateBgmPayload(BaseModel):
    prompt: str = Field(min_length=3, max_length=300)
    duration: float = Field(default=30.0, ge=5.0, le=300.0)


@app.post("/api/projects/{project_id}/generate-bgm")
async def generate_project_bgm(project_id: int, payload: GenerateBgmPayload, db: Session = Depends(get_db)):
    from .services import music_engine
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    slug = project.slug or f"project-{project.id}"
    bgm_dir = os.path.join(render_engine.WORKSPACE_DIR, slug, "bgm")
    safe_stem = re.sub(r"[^a-zA-Z0-9]+", "_", payload.prompt.strip())[:30].strip("_").lower() or "music"
    filename = f"generated_{safe_stem}_{int(time.time())}.wav"
    target_path = os.path.join(bgm_dir, filename)

    # Free the voice model first: both are large and share the same memory.
    await asyncio.to_thread(voice_engine.unload_model)
    try:
        await asyncio.to_thread(music_engine.generate_music, payload.prompt, payload.duration, target_path)
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Music generation failed: {error}") from error

    return {"status": "generated", "file": {
        "filename": filename,
        "relative_path": f"{slug}/bgm/{filename}",
        "duration": round(render_engine.get_audio_duration(target_path), 2),
        "size_bytes": os.path.getsize(target_path),
    }}


@app.delete("/api/projects/{project_id}/bgm/{filename}")
async def delete_project_bgm(project_id: int, filename: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    slug = project.slug or f"project-{project.id}"
    target_path = os.path.join(render_engine.WORKSPACE_DIR, slug, "bgm", filename)
    if os.path.exists(target_path):
        try:
            os.remove(target_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")

    return {"status": "deleted", "filename": filename}

@app.post("/api/projects/{project_id}/render-video")
async def trigger_video_render(project_id: int, payload: Optional[dict] = None, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if payload:
        data_to_save = payload.get("timeline_data") if (isinstance(payload, dict) and "timeline_data" in payload) else payload
        if isinstance(data_to_save, dict):
            project.timeline_data = json.dumps(data_to_save)
            db.commit()
            db.refresh(project)
    
    # Check if already rendering
    job = render_engine.RENDER_JOBS.get(project_id)
    if job and job.get("status") == "rendering":
        return {"status": "already_rendering", "job": job}

    async def _async_render_worker():
        from .database import SessionLocal
        bg_db = SessionLocal()
        try:
            await render_engine.render_project_video(project_id, bg_db)
        except Exception as err:
            print(f"[RENDER TASK EXCEPTION] {err}")
        finally:
            bg_db.close()

    asyncio.create_task(_async_render_worker())
    return {"status": "started", "message": "Video rendering started in background"}

@app.get("/api/projects/{project_id}/render-status")
async def get_video_render_status(project_id: int):
    job = render_engine.RENDER_JOBS.get(project_id, {
        "status": "idle",
        "progress": 0,
        "output_path": None,
        "error": None
    })
    return job

@app.delete("/api/projects/{project_id}/render")
async def delete_project_render(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    slug = project.slug or f"project-{project.id}"
    video_path = os.path.join(render_engine.WORKSPACE_DIR, slug, "final_output.mp4")
    if os.path.exists(video_path):
        try:
            os.remove(video_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete video: {str(e)}")
            
    render_engine.RENDER_JOBS[project_id] = {
        "status": "idle",
        "progress": 0,
        "output_path": None,
        "error": None
    }
    return {"status": "deleted"}

@app.get("/api/projects/{project_id}/subtitles")
async def get_project_subtitles(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    slug = project.slug or f"project-{project.id}"
    srt_path = os.path.join(render_engine.WORKSPACE_DIR, slug, "subtitles.srt")
    
    if os.path.exists(srt_path):
        with open(srt_path, "r", encoding="utf-8") as f:
            content = f.read()
        return PlainTextResponse(content, media_type="text/plain; charset=utf-8")
        
    # Generate on the fly from scenes if srt file does not exist yet
    coupling = render_engine.get_project_coupling_status(project, db)
    coupled_items = [
        {
            "scene_number": s["scene_number"],
            "duration": s["duration"],
            "narration_khmer": s.get("narration_khmer", "")
        }
        for s in coupling.get("scenes", [])
        if s.get("duration", 0) > 0
    ]
    content = render_engine.generate_srt(coupled_items)
    return PlainTextResponse(content, media_type="text/plain; charset=utf-8")

@app.get("/api/projects/{project_id}/lesson-handout")
async def get_project_lesson_handout(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    from .services.llm.orchestrators.educational_domain import detect_domain
    domain = detect_domain(f"{project.title}\n{project.raw_research}\n{project.video_concept}")
    
    domain_label = "ការអប់រំឱសថសាស្ត្រ (Pharmacy Education)" if domain == "pharmacy" else (
        "គរុកោសល្យ និងវិធីសាស្ត្របង្រៀន (Teacher Education)" if domain == "teacher_education" else "ការអប់រំទូទៅ (General Education)"
    )
    
    scenes = sorted(project.scenes, key=lambda s: s.scene_number)
    
    doc = [
        f"# 📚 សេចក្តីសង្ខេបមេរៀន / Lesson Study Guide: {project.title or 'មេរៀន'}",
        f"**កម្រិត / ជំនាញ**: {domain_label}",
        f"**ចំនួនឈុត**: {len(scenes)} ឈុត (Scenes)\n",
        "---",
        "## 🎯 គោលបំណងមេរៀន / Learning Objectives",
        f"{project.video_concept or 'ស្វែងយល់ពីគោលគំនិតស្នូល និងការអនុវត្តជាក់ស្តែងក្នុងវិជ្ជាជីវៈ។'}\n",
        "---",
        "## 📜 កម្រងខ្លឹមសារឈុតនីមួយៗ / Scene-by-Scene Script",
    ]
    
    for s in scenes:
        doc.append(f"### ឈុតទី {s.scene_number}")
        if s.narration_khmer:
            doc.append(f"**ការអត្ថាធិប្បាយ (Khmer Narration)**:\n> {s.narration_khmer}\n")
        if s.image_prompt_english:
            doc.append(f"**Visual Concept**: *{s.image_prompt_english}*\n")
            
    doc.extend([
        "---",
        "## 💡 សំណួរពិភាក្សា និងការអនុវត្ត / Review & Discussion Questions",
        "1. តើចំណុចសំខាន់អ្វីខ្លះដែលត្រូវចងចាំបន្ទាប់ពីទស្សនាវីដេអូនេះ?",
        "2. របៀបដែលអ្នកអាចយកចំណេះដឹងនេះទៅអនុវត្តផ្ទាល់ក្នុងវិជ្ជាជីវៈរបស់អ្នក?",
        "\n*ឯកសារជំនួយស្មារតីបង្កើតឡើងដោយស្វ័យប្រវត្តិតាមរយៈ MoniSekha Video Studio*"
    ])
    
    markdown_content = "\n".join(doc)
    return PlainTextResponse(markdown_content, media_type="text/markdown; charset=utf-8")

