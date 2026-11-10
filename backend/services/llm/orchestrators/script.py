import re
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from backend.services.llm.client import generate_text
from backend.services.llm.orchestrators.educational_domain import (
    detect_domain,
    get_educational_script_prompt,
)


def clean_script_lines(raw_text: str, language: str = "khmer") -> str:
    """
    Cleans raw LLM response into clean, line-delimited spoken script.
    - Strips markdown formatting (bold, italic, headers, blockquotes).
    - Removes 'Scene 1:', 'Speaker:', 'Narrator:', 'អ្នកនិទាន:', 'ឃ្លាទី១:' prefixes.
    - Removes parenthetical audio/acting notes e.g. (សើច), (pause), [Music].
    - Ensures each non-empty line ends with Khmer delimiter '។' (for Khmer) or '.' (for English).
    - Removes empty lines.
    """
    cleaned_lines = []
    for raw_line in raw_text.split("\n"):
        line = raw_line.strip()
        if not line:
            continue
        # Remove markdown headers and bullets (e.g. #, ##, *, -, 1., etc.)
        line = re.sub(r"^[#*>\-\d\.]+\s*", "", line).strip()
        # Remove prefixes like "Scene 1:", "Narrator:", "អ្នកអត្ថាធិប្បាយ:", "អ្នកនិទាន:", "ឃ្លាទី១:", "Scene:"
        line = re.sub(
            r"^(?:scene\s*\d+|narrator|speaker|voiceover|អ្នកនិទាន|អ្នកអត្ថាធិប្បាយ|ឃ្លាទី\s*\d+|ឈុតទី\s*\d+)\s*[:：\-–]\s*",
            "",
            line,
            flags=re.IGNORECASE,
        ).strip()
        # Remove parenthetical / bracketed stage directions e.g. (pause), [sound of bell], (ញញឹម)
        line = re.sub(r"[\(\[\{][^\)\]\}]*[\)\]\}]", "", line).strip()
        # Remove leading/trailing quotes or brackets
        line = line.strip("\"'«»“”")
        if not line:
            continue

        if language in ("khmer", "bilingual"):
            # Ensure line ends with ។ if it doesn't already have one or end with ? or !
            if not line.endswith("។") and not line.endswith("?") and not line.endswith("!"):
                if line.endswith("."):
                    line = line[:-1] + "។"
                else:
                    line = line + "។"
        else:
            if not line.endswith(".") and not line.endswith("?") and not line.endswith("!"):
                line = line + "."

        cleaned_lines.append(line)

    return "\n".join(cleaned_lines)


def generate_narrative_script(db: Session, raw_research: str, video_concept: str) -> str:
    combined_context = f"{raw_research}\n\n{video_concept}"
    domain = detect_domain(combined_context)
    system_prompt = get_educational_script_prompt(domain)
    user_content = (
        f"Raw Research:\n{raw_research}\n\n"
        f"Video Concept:\n{video_concept}"
    )
    raw_response = generate_text(db, system_prompt, user_content)
    return clean_script_lines(raw_response, language="khmer")


def generate_script_from_user_prompt(
    db: Session,
    prompt: str,
    target_length: str = "medium",  # "short", "medium", "detailed"
    domain: str = "auto",           # "auto", "pharmacy", "teacher_education", "general"
    tone: str = "educational",      # "educational", "storytelling", "conversational"
    language: str = "khmer",        # "khmer", "english", "bilingual"
) -> Dict[str, Any]:
    """
    Transforms a user idea, topic, or raw prompt into a complete line-delimited
    educational narrative script ready for scene breakdown and voiceover synthesis.
    """
    # 1. Resolve domain
    resolved_domain = domain if domain in ("pharmacy", "teacher_education", "general") else detect_domain(prompt)

    # 2. Line budget based on length
    if target_length == "short":
        target_lines_desc = "4 to 6 lines total (approx 30 to 45 seconds total spoken duration). Concise, punchy micro-lesson."
        line_count_guide = "Generate exactly 5 to 6 concise sentences."
    elif target_length == "detailed":
        target_lines_desc = "14 to 18 lines total (approx 2.5 to 3.5 minutes total spoken duration). In-depth step-by-step breakdown."
        line_count_guide = "Generate 14 to 18 clear, distinct sentences."
    else:  # medium
        target_lines_desc = "8 to 12 lines total (approx 1 to 2 minutes total spoken duration). Standard educational explainer pacing."
        line_count_guide = "Generate 8 to 12 balanced, sequential sentences."

    # 3. Tone instructions
    tone_instructions = {
        "educational": "Tone: Clear, instructional, authoritative yet encouraging. Explain concepts progressively.",
        "storytelling": "Tone: Engaging storytelling. Open with a relatable real-world dilemma or character scenario before explaining the solution.",
        "conversational": "Tone: Warm, conversational, and direct counseling style, speaking directly to the viewer (អ្នក/បងប្អូន).",
    }.get(tone, "Tone: Clear and educational.")

    # 4. Domain instructions
    domain_specific = ""
    if resolved_domain == "pharmacy":
        domain_specific = (
            "\nCRITICAL PHARMACY & HEALTHCARE INSTRUCTIONS:\n"
            "- Scientific Latin/English drug names, active molecules, biological receptors, and dosages MUST stay in English/Latin characters "
            "(e.g., Paracetamol 500mg, Amoxicillin, Ibuprofen, NSAIDs, BID, PO, 10mg/kg).\n"
            "- NEVER phonetically transliterate English drug names into awkward Khmer characters (write 'Paracetamol', NOT 'ប៉ារ៉ាសេតាម៉ុល'; write 'Amoxicillin', NOT 'អាម៉ុកស៊ីស៊ីលីន').\n"
            "- Everyday explanations, patient counseling, dosage timing (before/after food), precautions, and symptoms MUST be in natural, fluent spoken Khmer.\n"
            "- Include: 1) Clinical hook/question, 2) Mechanism or core rule, 3) Safe usage & dosage tip, 4) Critical red-flag precaution, 5) Professional counseling takeaway.\n"
        )
    elif resolved_domain == "teacher_education":
        domain_specific = (
            "\nCRITICAL TEACHER EDUCATION & PEDAGOGY INSTRUCTIONS:\n"
            "- Use official Cambodian Ministry of Education (MoEYS) standard pedagogical terms "
            "(e.g., វិធីសាស្ត្របង្រៀនសកម្ម, កិច្ចតែងការបង្រៀន, ការវាយតម្លៃស្ថាបនា, ការគ្រប់គ្រងថ្នាក់រៀន).\n"
            "- For international pedagogical frameworks, provide the English name in parentheses on first mention (e.g., វិធីសាស្ត្របង្រៀនសកម្ម (Active Learning)).\n"
            "- Include: 1) Pedagogical hook, 2) Concrete classroom step (Teacher action -> Student activity), 3) Engagement & formative check, 4) Practical classroom takeaway.\n"
        )
    else:
        domain_specific = (
            "\nGENERAL EDUCATIONAL EXPLAINER INSTRUCTIONS:\n"
            "- Progress logically: Hook / Real-world problem -> Core concept explanation -> Practical application / analogy -> Key takeaway.\n"
        )

    # 5. Build system prompt
    system_prompt = (
        "You are an expert instructional designer and educational scriptwriter specializing in "
        "high-engagement educational video lessons.\n\n"
        f"TARGET LANGUAGE: {language.upper()} (spoken natural Khmer phrasing).\n"
        f"PACING & LENGTH: {target_lines_desc}\n"
        f"{line_count_guide}\n"
        f"{tone_instructions}\n"
        f"{domain_specific}\n\n"
        "STRICT OUTPUT FORMAT RULES (NON-NEGOTIABLE):\n"
        "1. Every single sentence/visual beat MUST be on its own separate line (press Enter after each sentence).\n"
        "2. If language is Khmer or bilingual, every single sentence MUST end with the Khmer full-stop delimiter (។).\n"
        "3. Zero markdown headings (#), zero bold (**), zero bullet points (* or -), zero numbered lists (1., 2.).\n"
        "4. Zero scene prefixes (do NOT write 'Scene 1:', 'ឈុតទី១:', 'Narrator:').\n"
        "5. Zero parentheticals, stage directions, or audio cues (do NOT write '(សើច)', '[Music]', '(Pause)').\n"
        "6. Return ONLY the spoken narration lines, nothing else (no greetings, no 'Here is your script:').\n"
    )

    user_content = (
        f"USER TOPIC / PROMPT:\n"
        f"\"\"\"{prompt}\"\"\"\n\n"
        f"Please write the complete spoken narrative script now, following the exact line-by-line format above."
    )

    raw_response = generate_text(db, system_prompt, user_content)
    clean_script = clean_script_lines(raw_response, language=language)

    lines = [l for l in clean_script.split("\n") if l.strip()]

    return {
        "script_narrative": clean_script,
        "detected_domain": resolved_domain,
        "scene_count": len(lines),
        "target_length": target_length,
    }

