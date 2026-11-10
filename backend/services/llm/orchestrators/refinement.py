import json
import logging
from sqlalchemy.orm import Session
from backend.services.llm.client import generate_text
from backend.services.llm.orchestrators.educational_domain import detect_domain, get_educational_illustration_style

logger = logging.getLogger(__name__)

def refine_scene_prompt(
    db: Session, 
    existing_prompt: str, 
    existing_negative_prompt: str, 
    user_instruction: str, 
    global_style: str, 
    video_concept: str
) -> dict:
    """
    Takes the current positive and negative prompts of a scene, applies user instructions 
    and global style constraints, and returns a refined JSON containing both updated fields.
    """
    combined_ctx = f"{video_concept}\n{global_style}"
    domain = detect_domain(combined_ctx)
    domain_style = get_educational_illustration_style(domain)
    
    system_prompt = (
        "You are an expert prompt engineer specialized in educational image synthesis (Stable Diffusion/Flux/Google Flow).\n"
        "Your task is to modify an existing image generation prompt and its negative constraints "
        "based on specific user instructions, while strictly maintaining the overarching project aesthetic.\n\n"
        
        f"{domain_style}\n\n"
        
        "CRITICAL STYLE CONSTRAINT:\n"
        "- Follow the Global Illustration Style Guide provided in the user context.\n"
        "- STRICTLY NO text, NO words, NO letters, NO labels on images.\n"
        "- Keep prompts concise, punchy, and natural (under 55 words).\n"
        "- Preserve the visual archetype of the shot and metaphor alignment with script.\n"
        "- Avoid messy photorealism. Only use gradients/shading/texture if the Global Style Guide calls for them.\n\n"
        
        "OUTPUT RULE:\n"
        "You must output a strictly valid JSON object matching this schema exactly. "
        "Do not include any conversational text, explanations, or markdown blocks.\n"
        "{\n"
        "  \"image_prompt_english\": \"The fully rewritten and enhanced positive prompt string incorporating the user modifications.\",\n"
        "  \"negative_prompt_english\": \"The updated or preserved negative constraints string.\"\n"
        "}"
    )
    
    user_content = (
        f"--- GLOBAL CONTEXT ---\n"
        f"Video Concept: {video_concept}\n"
        f"Global Illustration Style Guide: {global_style}\n\n"
        f"--- CURRENT STATE ---\n"
        f"Current Positive Prompt: {existing_prompt}\n"
        f"Current Negative Prompt: {existing_negative_prompt}\n\n"
        f"--- USER MODIFICATION REQUEST ---\n"
        f"Instruction: {user_instruction}\n\n"
        f"Apply the modification request intelligently. Ensure the positive prompt remains descriptive "
        "for the image generator, and verify that the negative prompt protects against unwanted artifacts."
    )
    
    # Execute text generation using our unified, dynamic client driver in JSON mode
    raw_response = generate_text(db, system_prompt, user_content, json_mode=True)
    
    try:
        refined_data = json.loads(raw_response)
        # Ensure keys exist with default fallbacks if the LLM misses a property
        return {
            "image_prompt_english": refined_data.get("image_prompt_english", existing_prompt).strip(),
            "negative_prompt_english": refined_data.get("negative_prompt_english", existing_negative_prompt).strip()
        }
    except Exception as e:
        logger.error(f"Failed to parse prompt refinement JSON payload. Raw response: {raw_response}. Error: {e}")
        # Safe fallback: return original state if parsing encounters an edge-case failure
        return {
            "image_prompt_english": existing_prompt,
            "negative_prompt_english": existing_negative_prompt
        }


def refine_scene_prompt_and_script(
    db: Session,
    existing_prompt: str,
    existing_narration: str,
    existing_negative_prompt: str,
    user_instruction: str,
    global_style: str = "",
    video_concept: str = "",
    theme_era: str = "",
    theme_region: str = "cambodia",
    scene_staging: str = "studio",
    target_info: dict = None,
    reference_images_info: list = None
) -> dict:
    """
    Intelligent Scene Copilot: takes the current scene's image prompt, Khmer voiceover narration,
    and negative constraints, applies user adjustment instructions, and updates both the visual
    prompt and Khmer script while strictly adhering to the Global Style Guide.
    Supports distinguishing between:
    - Target Image: The base composition/subject to keep and modify slightly.
    - Reference Images: Auxiliary guides to borrow style, outfits, characters, or props from.
    - No Target: Generating a completely new scene from scratch guided by references.
    """
    combined_ctx = f"{video_concept}\n{global_style}"
    domain = detect_domain(combined_ctx)
    domain_style = get_educational_illustration_style(domain)

    system_prompt = (
        "You are an expert Creative Director & Prompt Engineer for educational explainer video animations.\n"
        "Your role is to iteratively refine a video scene's visual prompt and its corresponding Khmer voiceover script "
        "based on natural language user feedback.\n\n"
        
        f"{domain_style}\n\n"
        
        "CRITICAL VISUAL STYLE GUIDELINES:\n"
        "- Follow the visual aesthetic set in the Global Style Guide (e.g. clean 2D medical/pharmacy vectors, inviting classroom setups, or flat vector explainer art).\n"
        "- STRICTLY NO text, NO words, NO letters, NO labels, NO watermarks on the image.\n"
        "- Keep prompts concrete and physical (under 55 words).\n"
        "- NO gradients, NO 3D render clutter, NO messy photorealism.\n\n"

        "TARGET IMAGE VS. REFERENCE GUIDES SEMANTICS:\n"
        "1. TARGET IMAGE (if specified): This is the base image whose composition, characters, and staging MUST BE PRESERVED. "
        "The user's instruction should modify this target image slightly (e.g. changing shirt color, adding a prop, adjusting expression) "
        "while keeping the overall scene geometry, camera angle, and background intact.\n"
        "2. REFERENCE IMAGES (if specified): These are auxiliary reference materials (e.g. style guides, outfit references, character designs). "
        "The user borrows attributes from these references (e.g. 'outfit from Ref #1') to apply onto the Target Image or new scene.\n"
        "3. NO TARGET SPECIFIED: If Target Image is 'None / Not set', the user wants to generate a COMPLETELY NEW IMAGE from scratch. "
        "Do NOT force preservation of the old scene layout; construct a fresh visual prompt fulfilling the user instruction, "
        "using any Reference Images purely for character identity, outfit, or art style.\n"
        "4. In the user instruction, terms like '@Target', 'the target', or 'this girl' refer to the Target Image. "
        "Terms like '@Ref 1', 'Ref #1', 'this reference', or scene numbers refer to the Reference Images.\n\n"

        "BROAD FRAMING & COMPOSITION DIRECTIVE:\n"
        "- Prioritize broad panoramic views, wide-angle establishing shots, high-angle aerial bird's-eye views, or educational 2D visual diagrams.\n"
        "- NEVER frame scenes as isolated single-object macro close-ups (e.g. avoid isolated bread baskets or solitary wax scrolls). Props must be shown in the hands of active stickmen or within an environmental setting.\n\n"

        "CULTURAL & REGIONAL AUTHENTICITY:\n"
        "- Strictly adhere to the specified region. When Region is Cambodia (Khmer), depict authentic Khmer architecture (Angkor sandstone temple prasats, wooden stilt houses, barays, sugar palm trees), attire (krama scarves, sampots/chong kbens), and daily life.\n"
        "- Explicitly avoid Western European medieval knights, castles, or wax-seal scrolls when Cambodia is selected.\n\n"
        
        "SCRIPT & NARRATION GUIDELINES (KHMER):\n"
        "- If the user's adjustment modifies what happens in the scene or asks to change the voiceover, adjust the Khmer narration accordingly.\n"
        "- Keep the Khmer voiceover concise, cinematic, natural, and rhythmically paced for narration.\n"
        "- Ensure the Khmer sentence terminates with '។'.\n"
        "- If the user's instruction only affects visual framing/camera/colors, preserve the existing Khmer voiceover intact.\n\n"
        
        "OUTPUT SCHEMA (STRICT JSON):\n"
        "You must output ONLY a valid JSON object matching this schema exactly with no markdown blocks or surrounding text:\n"
        "{\n"
        "  \"image_prompt_english\": \"Refined positive English prompt for Google Flow / SD\",\n"
        "  \"narration_khmer\": \"Refined or preserved Khmer voiceover sentence ending with ។\",\n"
        "  \"negative_prompt_english\": \"Updated or preserved negative constraints\",\n"
        "  \"change_summary\": \"A short, friendly 1-2 sentence English explanation of what was adjusted\"\n"
        "}"
    )

    # Build multimodal role descriptions
    target_desc = "None (Generating a completely new scene from scratch - do not lock to prior layout)"
    if target_info and target_info.get("label"):
        target_desc = f"{target_info.get('label')} - {target_info.get('description', 'Base frame to preserve and modify')}"

    refs_desc = "None"
    if reference_images_info and len(reference_images_info) > 0:
        ref_lines = []
        for r in reference_images_info:
            r_label = r.get("label", "Reference")
            r_desc = r.get("description", "Style / Attribute guide")
            ref_lines.append(f"- {r_label}: {r_desc}")
        refs_desc = "\n".join(ref_lines)

    user_content = (
        f"--- CONTEXT ---\n"
        f"Video Concept: {video_concept or 'Educational Explainer'}\n"
        f"Era: {theme_era or 'Modern'}\n"
        f"Region / Country: {theme_region or 'Cambodia'}\n"
        f"Staging Mode: {scene_staging}\n"
        f"Global Style Guide: {global_style or '2D flat vector illustration, clean black outlines, solid color fills, seamless pure white background'}\n\n"
        f"--- CURRENT SCENE STATE ---\n"
        f"Current Visual Prompt (English): {existing_prompt or '(none)'}\n"
        f"Current Voiceover (Khmer): {existing_narration or '(none)'}\n"
        f"Current Exclusions (Negative): {existing_negative_prompt or '(none)'}\n\n"
        f"--- IMAGE ROLES ---\n"
        f"🎯 Target Image (Base to Modify): {target_desc}\n"
        f"📎 Reference Guides (Borrow Style/Outfit/Props): \n{refs_desc}\n\n"
        f"--- USER ADJUSTMENT REQUEST ---\n"
        f"Instruction: {user_instruction}\n\n"
        f"Apply the modification request intelligently based on whether a Target Image exists (modify target while borrowing from references) "
        f"or if Target is None (generate a completely new scene guided by references)."
    )

    raw_response = generate_text(db, system_prompt, user_content, json_mode=True)

    try:
        refined_data = json.loads(raw_response)
        khmer_out = refined_data.get("narration_khmer", existing_narration or "").strip()
        if khmer_out and not khmer_out.endswith("។"):
            khmer_out += "។"

        return {
            "image_prompt_english": refined_data.get("image_prompt_english", existing_prompt).strip(),
            "narration_khmer": khmer_out,
            "negative_prompt_english": refined_data.get("negative_prompt_english", existing_negative_prompt).strip(),
            "change_summary": refined_data.get("change_summary", "Refined scene prompt and script according to your instructions.").strip()
        }
    except Exception as e:
        logger.error(f"Failed to parse flow adjust JSON. Raw response: {raw_response}. Error: {e}")
        return {
            "image_prompt_english": existing_prompt,
            "narration_khmer": existing_narration,
            "negative_prompt_english": existing_negative_prompt,
            "change_summary": "Applied instruction to scene."
        }