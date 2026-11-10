import os
import json
from sqlalchemy import create_engine, Float, Boolean, Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "workspace", "studio.db"))
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False, "timeout": 30}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

SHARED_CHARACTERS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "workspace", "shared_characters"))
os.makedirs(SHARED_CHARACTERS_DIR, exist_ok=True)

CUSTOM_VOICES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "workspace", "custom_voices"))
os.makedirs(CUSTOM_VOICES_DIR, exist_ok=True)

class Character(Base):
    __tablename__ = "characters"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    gender = Column(String)
    personality_tag = Column(String)
    audio_path = Column(String)
    reference_text = Column(String)

class VoicePresetInstallation(Base):
    """Records installed presets independently of editable/deletable characters."""
    __tablename__ = "voice_preset_installations"

    preset_key = Column(String, primary_key=True)


class Setting(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    active_provider = Column(String, default="gemini")
    active_slot = Column(Integer, default=1)
    image_provider = Column(String, default="local")  # "local", "flow", "cloud", "agy"
    voice_provider = Column(String, default="voxcpm2")  # "voxcpm2" or "gemini"

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    slug = Column(String, unique=True, index=True)
    raw_research = Column(Text, nullable=True)
    script_narrative = Column(Text, nullable=True)
    video_concept = Column(Text, nullable=True)
    visual_mode = Column(String, default="images", nullable=False)
    illustration_style = Column(Text, nullable=True)
    global_voice_style = Column(Text, nullable=True)
    structured_json_data = Column(Text, nullable=True)
    status = Column(String, default="draft")  # "draft", "generating", "completed"
    is_pinned = Column(Boolean, default=False, nullable=False)
    master_audio_path = Column(String, nullable=True)
    voice_profile_tag = Column(String, nullable=True)
    voice_provider = Column(String, default="voxcpm2")  # "voxcpm2" or "gemini"
    gemini_voice_name = Column(String, default="Puck")   # "Puck", "Charon", "Kore", etc.
    gemini_voice_style = Column(Text, default="ted_ed")  # "ted_ed", "documentary", etc.
    audio_format = Column(String, default="wav")
    voice_cfg_value = Column(Float, default=2.0, nullable=False)
    voice_inference_steps = Column(Integer, default=15, nullable=False)
    theme_era = Column(String, nullable=True)
    theme_mood = Column(String, nullable=True)
    theme_custom = Column(Text, nullable=True)
    aspect_ratio = Column(String, default="16:9")
    character_attire = Column(Text, nullable=True)
    theme_region = Column(String, default="cambodia", nullable=True)
    scene_staging = Column(String, default="studio")
    art_style = Column(String, default="stickman")
    flow_project_id = Column(String, nullable=True)
    timeline_data = Column(Text, nullable=True)

    scenes = relationship("Scene", back_populates="project", cascade="all, delete-orphan")


class Scene(Base):
    __tablename__ = "scenes"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    scene_number = Column(Integer)
    narration_khmer = Column(Text, nullable=True)
    image_prompt_english = Column(Text, nullable=True)
    negative_prompt = Column(Text, nullable=True)
    user_refinement_prompt = Column(Text, nullable=True)
    audio_path = Column(String, nullable=True)
    audio_text = Column(Text, nullable=True)
    image_path = Column(String, nullable=True)
    images_list = Column(Text, default="[]")  # JSON string of relative paths
    reference_images = Column(Text, default="[]")  # JSON string of reference paths or Flow media UUIDs
    audio_error = Column(Text, nullable=True)
    audio_status = Column(String, default="idle")  # "idle", "processing", "completed", "failed"
    video_status = Column(String, default="idle", nullable=False)
    video_error = Column(Text, nullable=True)
    video_prompt = Column(Text, nullable=True)
    video_model = Column(String, nullable=True)
    image_status = Column(String, default="idle")
    character_id = Column(Integer, ForeignKey("characters.id"), nullable=True)
    character_name = Column(String, nullable=True)

    @property
    def audio_duration(self):
        if not self.audio_path:
            return 0.0
        import soundfile as sf
        path = os.path.join(os.path.dirname(DB_PATH), self.audio_path)
        try:
            return float(sf.info(path).duration)
        except (RuntimeError, OSError):
            return 0.0

    project = relationship("Project", back_populates="scenes")
    character = relationship("Character")
    generations = relationship("Generation", back_populates="scene", cascade="all, delete-orphan")


class Generation(Base):
    __tablename__ = "generations"

    id = Column(Integer, primary_key=True, index=True)
    scene_id = Column(Integer, ForeignKey("scenes.id"), nullable=False)
    provider = Column(String, default="flow")  # "local", "flow", "upload"
    model = Column(String, nullable=True)  # e.g. "nano2", "nano-pro", "draw_things"
    aspect_ratio = Column(String, default="16:9")
    count = Column(Integer, default=1)
    prompt = Column(Text, nullable=True)
    refinement_instruction = Column(Text, nullable=True)
    reference_media_ids = Column(Text, default="[]")  # JSON list
    output_paths = Column(Text, default="[]")  # JSON list of relative paths
    flow_media_ids = Column(Text, default="[]")  # JSON list of Flow UUIDs
    status = Column(String, default="completed")  # "pending", "completed", "failed"

    scene = relationship("Scene", back_populates="generations")


# Create tables automatically on import
Base.metadata.create_all(bind=engine)

from sqlalchemy import text

# Automatic migration fallback
with engine.begin() as conn:
    existing = {row[1] for row in conn.execute(text("PRAGMA table_info(projects)"))}
    if "visual_mode" not in existing:
        conn.execute(text("ALTER TABLE projects ADD COLUMN visual_mode VARCHAR NOT NULL DEFAULT 'images'"))

for column, definition in (
    ("audio_error", "TEXT"),
    ("video_status", "VARCHAR NOT NULL DEFAULT 'idle'"),
    ("video_error", "TEXT"),
    ("video_prompt", "TEXT"),
    ("video_model", "VARCHAR"),
):
    with engine.begin() as conn:
        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(scenes)"))}
        if column not in existing:
            conn.execute(text(f"ALTER TABLE scenes ADD COLUMN {column} {definition}"))

for column, definition in (
    ("voice_cfg_value", "FLOAT NOT NULL DEFAULT 2.0"),
    ("voice_inference_steps", "INTEGER NOT NULL DEFAULT 15"),
    ("voice_provider", "VARCHAR DEFAULT 'voxcpm2'"),
    ("gemini_voice_name", "VARCHAR DEFAULT 'Puck'"),
    ("gemini_voice_style", "TEXT DEFAULT 'ted_ed'"),
):
    with engine.begin() as conn:
        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(projects)"))}
        if column not in existing:
            conn.execute(text(f"ALTER TABLE projects ADD COLUMN {column} {definition}"))

with engine.begin() as conn:
    existing_settings = {row[1] for row in conn.execute(text("PRAGMA table_info(settings)"))}
    if "voice_provider" not in existing_settings:
        conn.execute(text("ALTER TABLE settings ADD COLUMN voice_provider VARCHAR DEFAULT 'voxcpm2'"))

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE projects ADD COLUMN master_audio_path VARCHAR;"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE projects ADD COLUMN voice_profile_tag VARCHAR;"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE projects ADD COLUMN audio_format VARCHAR DEFAULT 'wav';"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE projects ADD COLUMN theme_era VARCHAR;"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE projects ADD COLUMN theme_mood VARCHAR;"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE projects ADD COLUMN theme_custom TEXT;"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE projects ADD COLUMN aspect_ratio VARCHAR DEFAULT '16:9';"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE projects ADD COLUMN character_attire TEXT;"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE projects ADD COLUMN scene_staging VARCHAR DEFAULT 'studio';"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE projects ADD COLUMN art_style VARCHAR DEFAULT 'stickman';"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE projects ADD COLUMN theme_region VARCHAR DEFAULT 'cambodia';"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE settings ADD COLUMN active_provider VARCHAR;"))
        conn.execute(text("ALTER TABLE settings ADD COLUMN active_slot INTEGER;"))
except Exception:
    pass


try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE scenes ADD COLUMN character_id INTEGER REFERENCES characters(id);"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE scenes ADD COLUMN character_name VARCHAR;"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE settings ADD COLUMN image_provider VARCHAR DEFAULT 'local';"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE projects ADD COLUMN flow_project_id VARCHAR;"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE scenes ADD COLUMN images_list TEXT DEFAULT '[]';"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE scenes ADD COLUMN reference_images TEXT DEFAULT '[]';"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE projects ADD COLUMN timeline_data TEXT;"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE projects ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT 0;"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE scenes ADD COLUMN audio_text TEXT;"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("UPDATE scenes SET audio_text = narration_khmer WHERE audio_path IS NOT NULL AND (audio_text IS NULL OR audio_text = '');"))
except Exception:
    pass


def seed_default_educational_characters():
    db = SessionLocal()
    try:
        count = db.query(Character).count()
        if count == 0:
            defaults = [
                Character(
                    name="ឱសថការីវិជ្ជាជីវៈ (Clinical Pharmacist)",
                    gender="Male",
                    personality_tag="(Male, Adult, Professional clinical tone, Slow speed)",
                    reference_text="សូមស្វាគមន៍មកកាន់មេរៀនឱសថសាស្ត្រ។ ការប្រើប្រាស់ថ្នាំឱ្យបានត្រឹមត្រូវគឺមានសារៈសំខាន់បំផុតសម្រាប់សុខភាពអ្នកជំងឺ។"
                ),
                Character(
                    name="អ្នកគ្រូគរុកោសល្យ (Teacher Trainer)",
                    gender="Female",
                    personality_tag="(Female, Adult, Warm encouraging teacher tone, Normal speed)",
                    reference_text="សួស្តីលោកគ្រូអ្នកគ្រូទាំងអស់គ្នា! ថ្ងៃនេះយើងនឹងសិក្សាអំពីវិធីសាស្ត្របង្រៀនសកម្ម ដើម្បីបង្កើនការចូលរួមរបស់សិស្សក្នុងថ្នាក់។"
                ),
                Character(
                    name="អ្នកជំងឺ / សិស្ស (Patient / Student)",
                    gender="Female",
                    personality_tag="(Female, Youth, Conversational curious tone, Normal speed)",
                    reference_text="ជម្រាបសួរលោកគ្រូពេទ្យ តើថ្នាំមួយមុខនេះត្រូវលេបមុន ឬក្រោយបាយដែរ?"
                ),
            ]
            db.add_all(defaults)
            db.commit()
    except Exception as e:
        print(f"[SEED NOTICE] Could not seed characters: {e}")
        db.rollback()
    finally:
        db.close()

def seed_fictional_voice_presets():
    from .voice_presets import iter_voice_presets

    db = SessionLocal()
    try:
        installed = {row.preset_key for row in db.query(VoicePresetInstallation).all()}
        existing_names = {row.name for row in db.query(Character).all()}
        for key, fields in iter_voice_presets():
            if key in installed:
                continue
            if fields["name"] not in existing_names:
                db.add(Character(**fields))
            db.add(VoicePresetInstallation(preset_key=key))
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


try:
    seed_default_educational_characters()
except Exception:
    pass

try:
    seed_fictional_voice_presets()
except Exception as exc:
    print(f"[SEED NOTICE] Could not install fictional voice presets: {exc}")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def sync_project_json(project_id: int, db):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return
    scenes = db.query(Scene).filter(Scene.project_id == project.id).order_by(Scene.scene_number).all()
    clean_json_array = []
    for s in scenes:
        clean_json_array.append({
            "scene_number": s.scene_number,
            "narration_khmer": s.narration_khmer,
            "image_prompt_english": s.image_prompt_english,
            "video_prompt": s.video_prompt,
            "negative_prompt": s.negative_prompt,
            "image_path": s.image_path,
            "audio_path": s.audio_path,
            "character_id": s.character_id,
            "character_name": s.character_name
        })
    project.structured_json_data = json.dumps(clean_json_array, indent=2)
    db.commit()
