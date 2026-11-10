# Google Flow Setup & Operation Guide

This guide documents the Google Flow (`gflow-cli` MCP Streamable HTTP) integration with **MoniSekha Video Studio**, including the fixes applied for Google's new `flow.google.com` domain, daily startup instructions, and troubleshooting steps.

---

## 1. What Was Fixed

When setting up Google Flow with MoniSekha, five distinct issues were identified and resolved:

### 1. Support for Migrated Domain (`flow.google.com`)
* **Problem**: Google recently migrated user accounts from `labs.google/fx/tools/flow` to `flow.google.com`. The `gflow-cli` library hardcoded session checks to `https://labs.google/fx/api/auth/session` and filtered cookies strictly to `labs.google`. Even though you successfully logged into Google and generated images on `flow.google.com`, `gflow-cli` thought you were logged out and entered a 10-minute waiting loop before rolling back authentication.
* **Fix**:
  * Patched `gflow_cli/auth/cookies.py` to recognize `flow.google.com` cookies (`OSID`, `__Secure-OSID`, `SAPISID`).
  * Patched `gflow_cli/auth/verification.py` so `verify_flow_profile` validates active sessions via Google SSO and extracts your account (`user@gmail.com`).
  * Patched `gflow_cli/auth/internal_chromium.py` so `poll_session_until_authenticated` immediately recognizes `flow.google.com` and exits gracefully instead of timing out.

### 2. Terminal Single-Letter / Squashed Vertical Output
* **Problem**: When running in narrow terminal panes (e.g. split windows under 80 columns wide), Python's `rich` logging library attempted to squeeze timestamps, log levels, file names, and messages into the remaining 2–3 characters in the center, wrapping every letter vertically.
* **Fix**: Added `export COLUMNS=120` in `scripts/start_flow_daemon.sh` to enforce a standard terminal width.

### 3. Flow Agent / Chat Drawer Auto-Dismissal
* **Problem**: In `flow.google.com`, projects sometimes open with the "Agent" chat drawer expanded on the right side. This drawer hides the classic `.settings-trigger-button`, causing `migrated_composer.py` to raise `UiSelectorDriftError`.
* **Fix**: Updated `migrated_composer.py` to detect `button.agent-mode-chip.agent-mode-chip-checked` and `button[aria-label='Close']`, automatically closing the chat drawer and returning to the generation prompt box.

### 4. Queue Worker Parameter Alignment
* **Problem**: In `backend/queue_worker.py`, `flow_engine.trigger_flow_render` was called with positional arguments in the wrong order, swapping `count` and `model` (passing integer `1` as the model name and `"nano2"` as the count).
* **Fix**: Converted the function call to explicit keyword arguments (`model=model`, `count=count`).

### 5. Flow Project ID Association
* **Problem**: On `flow.google.com`, the legacy tRPC `project.createProject` endpoint returns `401 Unauthorized` because project creation must occur on `flow.google.com`. Generation requires an existing project ID.
* **Fix**: Linked your Flow project in `workspace/studio.db` and added `FLOW_PROJECT_ID` configuration fallback in `backend/services/flow_engine.py`.

---

## 2. Daily Startup (How to Run Next Time)

Your Google login is saved on disk under your profile (`profile_cavepaint`). **You do not need to sign in every time.**

### Starting Services

#### Terminal 1: Flow Daemon (MCP Server)
```bash
./scripts/start_flow_daemon.sh
```
*Starts the MCP server on `127.0.0.1:8765` using profile `cavepaint`.*

#### Terminal 2: Backend API
```bash
# In your Python virtual environment (e.g. source .venv/bin/activate or conda activate voice):
uvicorn backend.main:app --reload --port 8000
```
*Starts the FastAPI backend at `http://localhost:8000`.*

#### Terminal 3: Frontend Studio
```bash
cd frontend && npm run dev
```
*Starts the Next.js web application at `http://localhost:3000`.*

---

## 3. Generating Images in MoniSekha

1. Open `http://localhost:3000` in your web browser.
2. Select your project and navigate to the **Images** tab.
3. Verify the status indicators below the Flow engine settings:
   - **Daemon Online (:8765)**: Green badge
   - **Auth: cavepaint**: Green badge
4. Choose **Google Flow (Daemon)** as your Image Engine.
5. Click **Generate Frame (Flow)** on any scene!
   - Generation takes roughly 15–25 seconds.
   - The rendered PNG file will be saved directly into `workspace/<project_slug>/` and displayed in the studio.

---

## 4. Re-Authentication (Only If Session Expires)

Google sessions typically remain valid for weeks. If your Google login ever expires, you will see `Auth: Auth Required` in the UI.

To refresh your session:

1. Stop the daemon by pressing `Ctrl + C` in Terminal 1.
2. Run the authentication command:
   ```bash
   gflow auth login --profile cavepaint --browser chrome
   ```
3. A Google Chrome window will open. If prompted, complete your Google sign-in.
4. Once you land on `flow.google.com`, `gflow` will automatically detect your session, display:
   ```text
   Flow session verified as your-account@gmail.com.
   ```
   and close Chrome automatically.
5. Re-run `./scripts/start_flow_daemon.sh` and resume generating.

---

## 5. Quick Troubleshooting & Diagnostics

### Check Authentication Status Directly
```bash
gflow auth status --profile cavepaint
```
*Expected Output: `Flow session verified as your-account@gmail.com.`*

### Check Backend Flow API Status
```bash
curl -s http://localhost:8000/api/flow/status
```
*Expected Output: `{"cli_available":true,"daemon_running":true,"authenticated":true,"profile":"cavepaint"}`*

### If a Scene Gets Stuck in "failed" or "processing"
You can reset scene statuses in SQLite:
```bash
python3 -c "
import sqlite3
con = sqlite3.connect('workspace/studio.db')
cur = con.cursor()
cur.execute(\"UPDATE scenes SET image_status = 'idle' WHERE image_status = 'failed'\")
con.commit()
print('Reset failed scenes to idle')
"
```
