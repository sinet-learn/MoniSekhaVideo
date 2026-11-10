import os
from fastapi import HTTPException
from sqlalchemy.orm import Session
from ..database import Setting
import google.generativeai as genai

from .llm.orchestrators.educational_domain import (
    detect_domain,
    get_educational_script_prompt,
    get_educational_illustration_style,
    get_educational_structure_prompt,
    get_educational_vocal_prompt,
)

def generate_field_content(db: Session, field_name: str, context: str, visual_mode: str = "images") -> str:
    # 1. Fetch settings from DB
    setting = db.query(Setting).first()
    
    if setting:
        provider = setting.active_provider or "gemini"
        slot = setting.active_slot or 1
    else:
        provider = "gemini"
        slot = 1
        
    # 2. Resolve Environment
    if provider == "gemini":
        env_var = f"GEMINI_KEY_{slot}"
        api_key = os.getenv(env_var)
        if not api_key:
            raise HTTPException(status_code=500, detail=f"LLM Configuration Error: '{env_var}' is not populated in your environment. Please define {env_var} in your .env or .env.local file.")
            
        genai.configure(api_key=api_key)
        
        system_prompt = get_system_prompt_for_field(field_name, context=context, visual_mode=visual_mode)
        
        try:
            model = genai.GenerativeModel('gemini-2.5-flash')
            prompt = f"{system_prompt}\n\nContext:\n{context}"
            response = model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Gemini API Error: {str(e)}")
            
    elif provider == "groq":
        env_var = f"GROQ_KEY_{slot}"
        api_key = os.getenv(env_var)
        if not api_key:
            raise HTTPException(status_code=500, detail=f"LLM Configuration Error: '{env_var}' is not populated in your environment. Please define {env_var} in your .env or .env.local file.")
            
        try:
            from groq import Groq
            client = Groq(api_key=api_key)
            system_prompt = get_system_prompt_for_field(field_name, context=context, visual_mode=visual_mode)
            
            completion = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Context:\n{context}"}
                ]
            )
            return completion.choices[0].message.content.strip()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Groq API Error: {str(e)}")
            
    else:
        raise HTTPException(status_code=500, detail=f"Unknown LLM Provider: {provider}")

def get_system_prompt_for_field(field_name: str, context: str = "", visual_mode: str = "images") -> str:
    domain = detect_domain(context)
    
    if field_name == "script_narrative":
        return get_educational_script_prompt(domain)
    elif field_name == "illustration_style":
        return get_educational_illustration_style(domain)
    elif field_name == "structured_json_data":
        return get_educational_structure_prompt(domain, visual_mode=visual_mode)
    elif field_name == "global_voice_style":
        return get_educational_vocal_prompt(domain)
    elif field_name == "video_concept":
        if domain == "pharmacy":
            return (
                "You are an expert clinical education video director. Generate a clear instructional video concept direction "
                "for a pharmacy/pharmacology topic. Outline the clinical learning objectives, key patient scenario or drug mechanism, "
                "and visual approach. Keep explanations structured, evidence-based, and student-focused."
            )
        elif domain == "teacher_education":
            return (
                "You are an expert teacher education director. Generate a clear pedagogical video concept direction "
                "for a teacher training topic. Outline the target teaching competency, classroom challenge, proposed active learning technique, "
                "and visual classroom setup. Keep the tone practical, empowering, and instructional."
            )
        else:
            return "You are a creative educational video director. Generate an engaging, structured video concept direction based on the provided context."
    else:
        return f"Generate educational content for {field_name} based on the context. {get_educational_illustration_style(domain)}"
