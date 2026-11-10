# MoniSekha Video Studio

MoniSekha is a local AI video studio designed for Khmer e-learning, pharmacy education, and teacher training. It turns research notes and lesson concepts into fully illustrated, voiced explainer videos. It combines LLM scripting, image generation (cloud or local), and voice synthesis (VoxCPM) in a scene-by-scene timeline.

---

## Features

- **Brainstorming & Scripting**: Draft narrative scripts and scene breakdowns with Gemini or Groq.
- **Image Generation**: Create scene visuals using Google Flow (cloud) or Draw Things (local Stable Diffusion).
- **Voice Synthesis**: Generate narration audio for each scene with local voice cloning (VoxCPM2).
- **Interactive Timeline**: Arrange scenes, preview audio, swap image variants, and export.

---

## Image-first scenes and animation timing

- **Input:** Brainstorming plans short narration lines, a starting-image prompt and a separate motion direction. Create images, then generate narration in Voice.
- **Process:** Scene voiceovers target 6–8 seconds and must measure 10 seconds or less. Overlong recordings are rejected intact, with a Split action that preserves every source word and reuses the illustration. Splitting archives superseded media in the project's `_scene_history` folder. New voiceovers and animations must then be generated for the shorter lines.
- **Output:** In Assembly, Animate uses the actual voiceover duration. Local Pan & Zoom works without Flow. Google Flow can animate the starting image when the account's interface supports image-to-video; a successful clip is fitted to the narration length. Export rejects voice segments over 10 seconds.
- **Boundary:** The app remains local. Flow receives only the scene image and motion prompt through the existing signed-in profile, and may consume credits. Local Pan & Zoom sends nothing to Flow. No generation is submitted automatically, and failed jobs are never retried automatically.

Use **Brainstorming → Images → Voice → Assembly → Animate**. Generate an up-to-date voiceover before animation. Neither long speech nor its wording is silently truncated to meet the limit.

## Khmer word boundaries

Khmer narration is segmented locally with `khmer-nltk==1.6`. The original editable script and stored voice transcripts stay unchanged. Subtitles and SRT exports receive U+200B zero-width spaces between adjacent segmented words; word pulses use the same boundaries rather than arbitrary character clusters. By default, preview subtitles and SRT exports show pages of up to four words and roughly 32 characters, keeping individual words intact and breaking at sentence endings. Each page uses its share of the estimated word timing, so the full scene narration is not shown at once. Original whitespace, spelling, punctuation, Latin terms and dosages are preserved.

VoxCPM2 receives regular word spaces in its derived synthesis input, including matching reference transcripts, so pronunciation does not rely on an invisible Unicode marker being recognized by the model. Regenerate a voice line to apply this processing to its audio. No text is sent to an additional service. Pulse, Classic, Off, size and position are saved with the timeline. Pulse and Classic captions are burned into exported MP4 frames using libass; Off exports without captions. SRT remains available as a separate download and uses the selected page limits (one word for the One Word behavior). Pulse timing remains an estimate across the voiceover duration; segmentation alone does not provide word-level audio alignment.

## Quick Start

### 1. Configure Keys
```bash
cp .env.example .env.local
# Open .env.local and add your GEMINI_KEY_1 or GROQ_KEY_1
```

### 2. Start Backend (Terminal 1)
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

### 3. Start Frontend (Terminal 2)
```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3005](http://localhost:3005) in your browser!

---

## Detailed Setup & Image Engines

For a complete beginner-friendly guide covering prerequisites, Draw Things (local SD), Google Flow MCP, and troubleshooting, read **[SETUP.md](./SETUP.md)**.

---

## Tech Stack

- **Frontend**: Next.js, React, Tailwind CSS
- **Backend**: FastAPI, SQLite, SQLAlchemy
- **AI Integrations**: Gemini, Groq, Google Flow MCP, Draw Things, VoxCPM2

Subtitle customization: local timeline settings control caption colors, outline/background, size, placement, paging and word behavior. Preview and MP4 export use the same libass renderer and installed fonts. The preview API accepts bounded narration/settings and returns transparent caption frames; it writes only temporary local files and sends no text to external services. Settings persist in the project timeline; captions retain estimated word timing.
