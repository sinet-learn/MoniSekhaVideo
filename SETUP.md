# Local Setup Guide for MoniSekha

Welcome! This guide walks you through setting up and running **MoniSekha Video Studio** on your own computer from scratch.

---

## Prerequisites

Before starting, make sure you have the following installed on your system:

1. **Python 3.10 or newer**: [python.org](https://www.python.org/downloads/)
2. **Node.js 18 or newer** (with `npm`): [nodejs.org](https://nodejs.org/)
3. **FFmpeg**: Required for audio/video processing.
   - **macOS**: `brew install ffmpeg`
   - **Ubuntu/Debian**: `sudo apt install ffmpeg`
   - **Windows**: Install via `winget install Gyan.FFmpeg` or download from [ffmpeg.org](https://ffmpeg.org/)
4. **An API key** for at least one LLM provider:
   - [Google AI Studio (Gemini)](https://aistudio.google.com/) (Free tier available)
   - *or* [Groq Cloud](https://console.groq.com/) (Fast inference, free tier available)

---

## Step-by-Step Setup

### Step 1: Clone the Repository

```bash
git clone https://github.com/manet09/video-studio.git
cd video-studio
```

---

### Step 2: Set Up Environment Variables

Create your local `.env.local` file by copying the provided example:

```bash
cp .env.example .env.local
```

Open `.env.local` in your favorite code editor and paste in your API key:

```env
# Add your Gemini key (or Groq key below)
GEMINI_KEY_1=AIzaSy...your_gemini_api_key_here

# Optional: Groq alternative
GROQ_KEY_1=gsk_...your_groq_api_key_here
```

---

### Step 3: Set Up and Start the Backend (FastAPI)

In your project root directory, create a Python virtual environment and install the required dependencies:

```bash
# 1. Create a virtual environment
python3 -m venv .venv

# 2. Activate it
# On macOS / Linux:
source .venv/bin/activate
# On Windows (cmd/PowerShell):
# .venv\Scripts\activate

# 3. Install dependencies
pip install -r backend/requirements.txt

# 4. Start the backend server
uvicorn backend.main:app --reload --port 8000
```

Once running, your backend is live at:
* **API Server**: [http://localhost:8000](http://localhost:8000)
* **API Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)

Keep this terminal tab open.

---

### Step 4: Set Up and Start the Frontend (Next.js)

Open a **new terminal window**, navigate to the `frontend/` directory, and start the development server:

```bash
cd frontend

# Install frontend dependencies
npm install

# Start the dev server
npm run dev
```

The web application is now running at:
* **Studio UI**: [http://localhost:3005](http://localhost:3005)

Open [http://localhost:3005](http://localhost:3005) in your web browser to start creating!

---

## Optional: Image Generation Engines

MoniSekha supports multiple image generation engines. You can choose whichever you prefer directly inside the UI:

### Option A: Draw Things (Local Stable Diffusion on macOS)
If you have an Apple Silicon Mac and want 100% offline image synthesis:
1. Download [Draw Things](https://drawthings.ai/) from the macOS App Store.
2. In Draw Things, open **Settings** and enable **API Server** on port `7860`.
3. In MoniSekha's **Images** tab, choose **Local (Draw Things)**.

### Option B: Google Flow MCP (Cloud)
If you want to use Google Flow:
1. Install `gflow-cli`:
   ```bash
   pip install --upgrade gflow-cli
   playwright install chromium
   ```
2. Log in once to authenticate your Google profile:
   ```bash
   gflow auth login --profile cavepaint --browser chrome
   ```
3. Start the daemon:
   ```bash
   ./scripts/start_flow_daemon.sh
   ```
4. In MoniSekha's **Images** tab, choose **Google Flow (Daemon)**.
   *(See [FLOW_SETUP_GUIDE.md](./FLOW_SETUP_GUIDE.md) for detailed notes).*

---

## Common Troubleshooting

* **Port 8000 or 3000 already in use**:
  Check if an older instance is running:
  - macOS/Linux: `lsof -i :8000` or `lsof -i :3000`, then terminate with `kill -9 <PID>`
  - Or run the backend on another port: `uvicorn backend.main:app --reload --port 8001`
* **API Key Error**:
  Ensure `.env.local` is in the root directory (not inside `backend/` or `frontend/`) and has no extra quotation marks around the key values.
* **Database File**:
  MoniSekha automatically creates and migrates its SQLite database under `workspace/studio.db` when the backend starts up. You don't need to manually configure any database.
