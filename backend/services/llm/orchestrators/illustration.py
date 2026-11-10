from sqlalchemy.orm import Session
from backend.services.llm.client import generate_text
from backend.services.llm.orchestrators.educational_domain import detect_domain, get_educational_illustration_style

def generate_illustration_style(db: Session, raw_research: str, video_concept: str, script_narrative: str) -> str:
    combined_context = f"{raw_research}\n\n{video_concept}\n\n{script_narrative}"
    domain = detect_domain(combined_context)
    system_prompt = (
        "You are a lead visual art director for an educational explainer video series. "
        "Based on the provided research, video concept, and script narrative, "
        "output a precise stylistic directive tailored for an educational image generation pipeline.\n"
        f"{get_educational_illustration_style(domain)}"
    )
    user_content = (
        f"Raw Research:\n{raw_research}\n\n"
        f"Video Concept:\n{video_concept}\n\n"
        f"Script Narrative:\n{script_narrative}"
    )
    return generate_text(db, system_prompt, user_content)
