"""Fictional voice designs. Names label characters, never real speakers.

Keep keys stable: installation receipts let users delete or customize a preset
without having it reappear or be overwritten on the next backend restart.
"""

REFERENCE_TEXT = (
    "សួស្តី និងសូមស្វាគមន៍! ថ្ងៃនេះ យើងនឹងសិក្សាអ្វីថ្មីៗជាមួយគ្នា។ "
    "សូមស្តាប់ដោយយកចិត្តទុកដាក់ ហើយសាកល្បងអនុវត្តតាមជំហាននីមួយៗ។"
)

ENGLISH_REFERENCE_TEXT = (
    "Hello and welcome! Today we are going to learn something new together. "
    "Please listen carefully, and try each step as we go."
)

# Key, display name, gender, age, voice direction, pace.
VOICE_PRESETS = (
    ("dara", "Dara — Calm Narrator", "Male", "Adult", "Deep resonant calm documentary", "Normal"),
    ("sophea", "Sophea — Warm Teacher", "Female", "Adult", "Warm clear encouraging teacher", "Normal"),
    ("vanna", "Vanna — Energetic Presenter", "Male", "Young Adult", "Bright lively enthusiastic presenter", "Fast"),
    ("sokha", "Sokha — Gentle Storyteller", "Female", "Elderly", "Soft gentle textured storytelling", "Slow"),
    ("visal", "Visal — News Anchor", "Male", "Adult", "Steady polished authoritative news anchor", "Normal"),
    ("bopha", "Bopha — Friendly Guide", "Female", "Young Adult", "Light welcoming friendly tour guide", "Normal"),
    ("rithy", "Rithy — Science Explainer", "Male", "Adult", "Clear curious analytical science explainer", "Normal"),
    ("kanha", "Kanha — Science Host", "Female", "Young Adult", "Crisp inquisitive animated science host", "Normal"),
    ("sovann", "Sovann — History Narrator", "Male", "Elderly", "Low rich weathered historical storyteller", "Slow"),
    ("malis", "Malis — Bedtime Storyteller", "Female", "Adult", "Soft soothing intimate bedtime storyteller", "Slow"),
    ("piseth", "Piseth — Clinical Educator", "Male", "Adult", "Precise reassuring professional clinical educator", "Slow"),
    ("chenda", "Chenda — Health Educator", "Female", "Adult", "Calm compassionate articulate health educator", "Slow"),
    ("raksa", "Raksa — Sports Commentator", "Male", "Young Adult", "Punchy spirited excited sports commentator", "Fast"),
    ("sreypov", "Sreypov — Radio Host", "Female", "Adult", "Full warm conversational radio host", "Normal"),
    ("makara", "Makara — Business Presenter", "Male", "Adult", "Confident measured polished business presenter", "Normal"),
    ("nary", "Nary — News Reader", "Female", "Adult", "Composed crisp articulate broadcast news reader", "Normal"),
    ("chamroeun", "Chamroeun — Village Elder", "Male", "Elderly", "Gravelly kind reflective village elder", "Slow"),
    ("sophary", "Sophary — Wise Elder", "Female", "Elderly", "Mature rounded dignified reflective elder", "Slow"),
    ("panha", "Panha — Curious Student", "Male", "Young Adult", "Light youthful curious conversational student", "Normal"),
    ("sreynich", "Sreynich — Curious Learner", "Female", "Young Adult", "Bright youthful questioning attentive learner", "Normal"),
    ("kosal", "Kosal — Mindfulness Guide", "Male", "Adult", "Low soft breathy tranquil mindfulness guide", "Slow"),
    ("rumduol", "Rumduol — Meditation Guide", "Female", "Adult", "Airy serene soothing meditation guide", "Slow"),
    ("virak", "Virak — Adventure Narrator", "Male", "Adult", "Bold resonant dramatic adventure narrator", "Normal"),
    ("tepida", "Tepida — Fairy Tale Narrator", "Female", "Adult", "Melodic expressive magical fairy tale storyteller", "Normal"),
    ("sambath", "Sambath — Practical Instructor", "Male", "Adult", "Grounded patient direct practical instructor", "Slow"),
    ("sreymom", "Sreymom — Patient Tutor", "Female", "Adult", "Gentle patient precise step by step tutor", "Slow"),
    ("oudom", "Oudom — Technology Host", "Male", "Young Adult", "Clean upbeat modern technology presenter", "Normal"),
    ("leakhena", "Leakhena — Technology Guide", "Female", "Young Adult", "Smooth confident clear technology guide", "Normal"),
    ("sopheak", "Sopheak — Friendly Neighbor", "Male", "Adult", "Relaxed easygoing warm everyday conversational", "Normal"),
    ("sreyleak", "Sreyleak — Friendly Companion", "Female", "Adult", "Natural relaxed smiling friendly conversational", "Normal"),
    ("bunthoeun", "Bunthoeun — Formal Announcer", "Male", "Adult", "Rich projected formal ceremonial announcer", "Slow"),
    ("sotheary", "Sotheary — Formal Host", "Female", "Adult", "Elegant poised clear formal ceremony host", "Slow"),
    ("chhay", "Chhay — Comedy Storyteller", "Male", "Young Adult", "Playful nimble witty lighthearted storyteller", "Fast"),
    ("pich", "Pich — Cheerful Entertainer", "Female", "Young Adult", "Bubbly playful smiling cheerful entertainer", "Fast"),
    ("vuthy", "Vuthy — Nature Narrator", "Male", "Adult", "Gentle low intimate contemplative nature narrator", "Slow"),
    ("maly", "Maly — Nature Guide", "Female", "Adult", "Soft clear wonder filled nature documentary guide", "Slow"),
    ("chetra", "Chetra — Youthful Explorer", "Male", "Young Adult", "Light open eager adventurous youthful explorer", "Normal"),
    ("lina", "Lina — Creative Presenter", "Female", "Young Adult", "Vibrant expressive imaginative creative presenter", "Normal"),
    ("reach", "Reach — Dramatic Narrator", "Male", "Adult", "Very deep weighty theatrical cinematic narrator", "Slow"),
    ("reasmey", "Reasmey — Dramatic Storyteller", "Female", "Adult", "Rich textured emotional dramatic storyteller", "Slow"),
    ("narin", "Narin — Young Learner", "Male", "Child", "Light clear curious gentle child learner", "Normal"),
    ("kunthea", "Kunthea — Young Storyteller", "Female", "Child", "Small bright innocent cheerful child storyteller", "Normal"),
    ("samnang", "Samnang — Encouraging Coach", "Male", "Adult", "Strong supportive motivating encouraging coach", "Normal"),
    ("sreyneang", "Sreyneang — Inspiring Mentor", "Female", "Adult", "Assured warm uplifting inspiring mentor", "Normal"),
    ("heng", "Heng — Reflective Elder", "Male", "Elderly", "Soft slightly raspy thoughtful reflective elder", "Slow"),
    ("chanthou", "Chanthou — Family Storyteller", "Female", "Elderly", "Warm husky affectionate family storyteller", "Slow"),
    ("davin", "Davin — Quick Explainer", "Male", "Young Adult", "Crisp agile focused concise explainer", "Fast"),
    ("soriya", "Soriya — Upbeat Explainer", "Female", "Young Adult", "Bright clear rhythmic upbeat explainer", "Fast"),
)


# English voices. The accent is written into the voice direction; narration is
# English when the scene text contains no Khmer script.
# Key, display name, gender, age, accent, voice direction, pace.
ENGLISH_VOICE_PRESETS = (
    ("us_grant", "Grant — American Narrator", "Male", "Adult", "American", "deep calm documentary narrator", "Normal"),
    ("us_hannah", "Hannah — American Teacher", "Female", "Adult", "American", "warm clear encouraging teacher", "Normal"),
    ("us_tyler", "Tyler — American Presenter", "Male", "Young Adult", "American", "bright lively enthusiastic presenter", "Fast"),
    ("us_claire", "Claire — American Storyteller", "Female", "Adult", "American", "soft gentle expressive storyteller", "Slow"),
    ("uk_edmund", "Edmund — British Narrator", "Male", "Adult", "British", "deep refined documentary narrator", "Normal"),
    ("uk_florence", "Florence — British Teacher", "Female", "Adult", "British", "warm clear articulate teacher", "Normal"),
    ("uk_oliver", "Oliver — British Presenter", "Male", "Young Adult", "British", "bright witty engaging presenter", "Fast"),
    ("uk_imogen", "Imogen — British Storyteller", "Female", "Adult", "British", "soft elegant expressive storyteller", "Slow"),
)


def iter_voice_presets():
    for key, name, gender, age, direction, pace in VOICE_PRESETS:
        yield key, {
            "name": name,
            "gender": gender,
            "personality_tag": f"({gender}, {age}, {direction} tone, {pace} speed)",
            "reference_text": REFERENCE_TEXT,
        }
    for key, name, gender, age, accent, direction, pace in ENGLISH_VOICE_PRESETS:
        yield key, {
            "name": name,
            "gender": gender,
            "personality_tag": f"({gender}, {age}, {accent} accent {direction} tone, {pace} speed)",
            "reference_text": ENGLISH_REFERENCE_TEXT,
        }
