"""
Educational Domain Prompt Enhancements for MoniSekha
Specialized for Khmer Pharmacy Education and Teacher Education.
"""

def detect_domain(text: str) -> str:
    """
    Detects whether the project belongs to Pharmacy Education, Teacher Education,
    or General Education based on keywords in research, concept, or title.
    """
    if not text:
        return "general_education"
    
    t = text.lower()
    
    # Pharmacy / Medical keywords
    pharmacy_keywords = [
        "pharmacy", "pharmacology", "pharmacist", "medicine", "medication", "drug",
        "dosage", "contraindication", "antibiotic", "prescription", "side effect",
        "adme", "receptor", "paracetamol", "amoxicillin", "ibuprofen", "capsule", "tablet",
        "pharmacokinetics", "pharmacodynamics", "clinical", "patient",
        "ឱសថ", "ឱសថសាស្ត្រ", "ឱសថការី", "ថ្នាំ", "វេជ្ជសាស្ត្រ", "អ្នកជំងឺ", "ដូស",
        "កម្រិតប្រើប្រាស់", "ផលរំខាន", "ការហាមឃាត់"
    ]
    if any(k in t for k in pharmacy_keywords):
        return "pharmacy"
        
    # Teacher Education / Pedagogy keywords
    teacher_keywords = [
        "teacher", "teaching", "pedagogy", "pedagogical", "classroom", "lesson plan",
        "student", "active learning", "formative assessment", "summative assessment",
        "curriculum", "didactic", "instructional", "bloom", "scaffolding", "rubric",
        "គរុកោសល្យ", "វិធីសាស្ត្របង្រៀន", "កិច្ចតែងការ", "ការបង្រៀន", "គ្រូបង្រៀន",
        "សិស្ស", "ថ្នាក់រៀន", "ការវាយតម្លៃ", "ការគ្រប់គ្រងថ្នាក់រៀន"
    ]
    if any(k in t for k in teacher_keywords):
        return "teacher_education"
        
    return "general_education"

def get_educational_script_prompt(domain: str) -> str:
    base = (
        "You are an expert instructional designer and educational scriptwriter specializing in "
        "high-engagement educational video lessons in natural, spoken Khmer (ភាសាខ្មែរ).\n\n"
        "CORE SCRIPT FORMATTING RULES (STRICT):\n"
        "1. Every single sentence/visual beat MUST end with the Khmer full-stop delimiter (។).\n"
        "2. Put every sentence on its own separate line (press Enter after each ។). Each line represents exactly 1 visual scene.\n"
        "3. Zero speaker labels (no 'អ្នកនិទាន:', no 'Scene 1:'), zero stage directions, and zero parentheticals like '(សើច)', "
        "because this text is synthesized directly by the local AI voice engine.\n"
    )
    
    if domain == "pharmacy":
        return base + (
            "\nDOMINANT PEDAGOGICAL DOMAIN: PHARMACY & PHARMACOLOGY EDUCATION (ការអប់រំឱសថសាស្ត្រ)\n"
            "- PEDAGOGICAL STRUCTURE:\n"
            "  1. Clinical Hook: Present a real-world patient scenario, common medication mistake, or drug question.\n"
            "  2. Mechanism of Action (MOA): Clearly explain how the drug works at the cellular/receptor or physiological level.\n"
            "  3. Dosage & Administration: State accurate dosage guidelines, routes (PO, IV, IM), and frequency.\n"
            "  4. Precautions & Contraindications (ការប្រុងប្រយ័ត្ន និងផលរំខាន): Highlight key drug interactions and safety red flags.\n"
            "  5. Practical Counseling Tip: Conclude with practical advice that a pharmacist gives to a patient.\n"
            "- CRITICAL BILINGUAL RULE FOR PHARMACY:\n"
            "  * Scientific Latin/English drug names, active molecules, biological receptors, dosages, and medical units MUST stay in English/Latin characters "
            "    (e.g., Paracetamol 500mg, Amoxicillin, Ibuprofen, NSAIDs, Beta-blockers, ACE inhibitors, 10mg/kg, twice daily, BID, PO, IV).\n"
            "  * NEVER phonetically transliterate English drug names into awkward Khmer characters (e.g., write 'Paracetamol', NOT 'ប៉ារ៉ាសេតាម៉ុល'; write 'Amoxicillin', NOT 'អាម៉ុកស៊ីស៊ីលីន').\n"
            "  * Everyday explanations, patient advice, symptoms, and anatomical descriptions MUST be in natural, fluent Khmer.\n"
        )
    elif domain == "teacher_education":
        return base + (
            "\nDOMINANT PEDAGOGICAL DOMAIN: TEACHER EDUCATION & PEDAGOGY (គរុកោសល្យ និងវិធីសាស្ត្របង្រៀន)\n"
            "- PEDAGOGICAL STRUCTURE:\n"
            "  1. Learning Objective & Hook: Announce the core instructional technique and why traditional methods fail.\n"
            "  2. Practical Demonstration: Describe concrete classroom steps (Teacher action -> Student activity -> Output).\n"
            "  3. Classroom Management & Engagement: Address common challenges (noisy rooms, disengaged students, time management).\n"
            "  4. Formative Assessment: How the teacher checks for understanding without a written exam.\n"
            "  5. Reflection & Action Step: 1 immediate tip teachers can apply in their classroom tomorrow.\n"
            "- KHMER TERMINOLOGY RULE FOR PEDAGOGY:\n"
            "  * Use official Cambodian Ministry of Education (MoEYS) standard pedagogical terms "
            "    (e.g., វិធីសាស្ត្របង្រៀនសកម្ម, កិច្ចតែងការបង្រៀន, ការវាយតម្លៃស្ថាបនា, ការគ្រប់គ្រងថ្នាក់រៀន).\n"
            "  * For internationally recognized concepts, provide the English name in parentheses on first mention "
            "    (e.g., វិធីសាស្ត្របង្រៀនសកម្ម (Active Learning), ឋានានុក្រមប្លូម (Bloom's Taxonomy), ការពិភាក្សាគូ (Think-Pair-Share)).\n"
        )
    else:
        return base + (
            "\nDOMINANT PEDAGOGICAL DOMAIN: GENERAL EDUCATIONAL EXPLAINER\n"
            "- Explain concepts progressively: Definition -> Real-world analogy -> Key mechanism -> Practical takeaway.\n"
            "- Keep technical terms in Latin characters while delivering conversational, natural Khmer narration.\n"
        )

def get_educational_illustration_style(domain: str) -> str:
    if domain == "pharmacy":
        return (
            "CRITICAL STYLE ENFORCEMENT (PHARMACY & MEDICAL EDUCATION):\n"
            "Style: Clean, modern 2D flat medical and pharmaceutical vector illustration.\n"
            "Aesthetic: Crisp outlines, smooth solid shapes, high contrast, clean professional color palette "
            "(clinical teal, dark navy blue, clean medical white, vibrant accent orange/red for callouts).\n"
            "Subject Matter: Pharmaceutical laboratory settings, apothecary/pharmacy counter interactions, clear cross-sections of organs, "
            "molecular receptor diagrams, medication blister packs and capsules, pharmacological process flowcharts.\n"
            "STRICT CONSTRAINTS: Zero unreadable messy text or random gibberish labels on images. Clear visual hierarchy with central focal point. "
            "Keep prompts concise (35-50 words), natural, and prompt-engine friendly."
        )
    elif domain == "teacher_education":
        return (
            "CRITICAL STYLE ENFORCEMENT (TEACHER EDUCATION & CLASSROOM PEDAGOGY):\n"
            "Style: Bright, welcoming 2D flat educational vector illustration.\n"
            "Aesthetic: Warm and inviting color palette (soft navy, amber, sage green, clean white), clean outlines, clear compositions.\n"
            "Subject Matter: Modern classroom environments, teacher standing beside whiteboard facilitating activities, "
            "diverse students collaborating in small discussion circles, pedagogical concept maps, step-by-step instructional icons.\n"
            "STRICT CONSTRAINTS: Zero unreadable random gibberish text on images. Clean, focused compositions highlighting instructional interactions. "
            "Keep prompts concise (35-50 words), natural, and prompt-engine friendly."
        )
    else:
        return (
            "CRITICAL STYLE ENFORCEMENT (EDUCATIONAL EXPLAINER):\n"
            "Style: Minimalist 2D flat vector educational explainer art, bold clean outlines, vibrant flat solid colors, seamless solid backgrounds.\n"
            "Subject Matter: Clear diagrams, educational metaphors, step-by-step concept visualizations.\n"
            "STRICT CONSTRAINTS: Zero random text or gibberish words on images. Keep prompts concise (30-50 words)."
        )

def get_educational_structure_prompt(domain: str, visual_mode: str = "images") -> str:
    if visual_mode == "video":
        return (
            "You are an educational animation director. Return only a valid JSON array of scenes. "
            "Each object must contain scene_number (integer), narration_khmer (exact Khmer narration), "
            "video_prompt (English), and negative_prompt_english (English). "
            "Write each video_prompt as a self-contained 60-120 word text-to-video prompt: establish the "
            "characters, attire, setting and visual style; describe one clear action unfolding over time, "
            "a deliberate camera movement or locked camera, secondary environmental motion, and the final state. "
            "Keep character appearances consistent across scenes. Avoid montage cuts, on-screen text, generated "
            "dialogue and lip syncing; narration will be added separately. Do not produce image_prompt_english. "
            f"Use the supplied illustration style and domain context ({domain}) for every clip."
        )
    style_guideline = get_educational_illustration_style(domain)
    return (
        "You are an expert educational video production coordinator. "
        "Consolidate all provided upstream research, concept, script, and visual style into a structural JSON sequence block.\n"
        "Plan an image first and a separate image-to-video motion direction for every scene. Use natural narration breaks without a fixed scene duration limit. Preserve all source words in order; do not summarize away content.\n"
        "STRICT SCHEMA RULE: The output MUST be a valid JSON array of objects perfectly adhering to the following schema:\n"
        "[\n"
        "  {\n"
        "    \"scene_number\": <int>,\n"
        "    \"narration_khmer\": <string ending strictly with ។>,\n"
        "    \"image_prompt_english\": <string concise 35-50 words>,\n"
        '    "video_prompt": <string describing motion from the starting image; no generated speech>,\n'
        "    \"negative_prompt_english\": <string, e.g. 'blurry, low quality, distorted text, photorealistic clutter, bad anatomy'>,\n"
        "    \"key_points_khmer\": <string 1-3 short key terms/takeaways for subtitle/callout overlay>\n"
        "  }\n"
        "]\n"
        f"{style_guideline}\n"
        "Return ONLY the raw valid JSON array without any markdown wrappers or conversational intro."
    )

def get_educational_vocal_prompt(domain: str) -> str:
    if domain == "pharmacy":
        return (
            "Voice Direction for Pharmacy Education (VoxCPM2):\n"
            "- Persona: Professional Clinical Pharmacist / Medical Lecturer.\n"
            "- Delivery: Calm, authoritative, highly articulate enunciation of medical terms, measured pacing (speed 0.88x - 0.92x).\n"
            "- Pauses: Clear deliberate pauses at clause delimiters (។) to allow medical students to absorb pharmaceutical mechanisms and dosages."
        )
    elif domain == "teacher_education":
        return (
            "Voice Direction for Teacher Education (VoxCPM2):\n"
            "- Persona: Master Teacher Trainer / Pedagogical Mentor.\n"
            "- Delivery: Warm, encouraging, dynamic pedagogical cadence, clear emphasis on actionable classroom steps (speed 0.92x - 0.95x).\n"
            "- Pauses: Engaging conversational flow with clean pauses between lesson phases."
        )
    else:
        return (
            "Voice Direction for Educational Explainer (VoxCPM2):\n"
            "- Persona: Engaging Educational Explainer Narrator.\n"
            "- Delivery: Crisp, clear, friendly educational delivery with natural phrasing."
        )
