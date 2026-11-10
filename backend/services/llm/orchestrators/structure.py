import json
from fastapi import HTTPException
from sqlalchemy.orm import Session
from backend.services.llm.client import generate_text
from backend.services.llm.orchestrators.educational_domain import detect_domain, get_educational_structure_prompt

def build_structured_scenes(db: Session, raw_research: str, video_concept: str, script_narrative: str, illustration_style: str, vocal_style: str, visual_mode: str = "images") -> list:
    combined_context = f"{raw_research}\n\n{video_concept}\n\n{script_narrative}"
    domain = detect_domain(combined_context)
    system_prompt = get_educational_structure_prompt(domain, visual_mode=visual_mode)
    user_content = (
        f"Raw Research:\n{raw_research}\n\n"
        f"Video Concept:\n{video_concept}\n\n"
        f"Script Narrative:\n{script_narrative}\n\n"
        f"Illustration Style:\n{illustration_style}\n\n"
        f"Vocal Style:\n{vocal_style}"
    )
    
    raw_response = generate_text(db, system_prompt, user_content, json_mode=True)
    
    try:
        parsed_data = json.loads(raw_response)
        
        if not isinstance(parsed_data, list):
            # Fallback handling if the model returns a dictionary wrapping the list
            if isinstance(parsed_data, dict):
                for key, value in parsed_data.items():
                    if isinstance(value, list):
                        parsed_data = value
                        break
            
            if not isinstance(parsed_data, list):
                raise ValueError("Parsed JSON is not a list array as expected.")
                
        return parsed_data
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse structured scenes JSON: {str(e)}\nRaw Response: {raw_response}")
    except ValueError as e:
        raise HTTPException(status_code=500, detail=f"Structured scenes schema error: {str(e)}")
