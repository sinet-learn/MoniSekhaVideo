import os
import json
import time
import shutil
import subprocess
import requests
import sqlite3
import re
from datetime import datetime
from typing import List, Optional, Dict, Any

def get_default_profile() -> str:
    explicit = os.getenv("GFLOW_PROFILE")
    if explicit:
        return explicit
    home_dir = os.path.expanduser("~")
    base_dir = os.path.join(home_dir, "Library", "Application Support", "gflow-cli")
    if os.path.exists(base_dir):
        for entry in os.listdir(base_dir):
            if entry.startswith("profile_"):
                return entry.replace("profile_", "")
    return "cavepaint"

def get_gflow_bin() -> str:
    env_bin = os.getenv("GFLOW_BIN")
    if env_bin and (os.path.exists(env_bin) or shutil.which(env_bin)):
        return env_bin
    local_bin = os.path.expanduser("~/.local/bin/gflow")
    if os.path.exists(local_bin):
        return local_bin
    venv_bin = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".venv", "bin", "gflow"))
    if os.path.exists(venv_bin):
        return venv_bin
    return shutil.which("gflow") or "gflow"

GFLOW_BIN = get_gflow_bin()
DEFAULT_PROFILE = get_default_profile()
DEFAULT_DAEMON_HOST = os.getenv("GFLOW_DAEMON_HOST", "http://127.0.0.1:8765")

def find_flow_asset_for_image(img_rel_path: str, profile: str = DEFAULT_PROFILE) -> Optional[Dict[str, str]]:
    """
    Given a relative image path (e.g. 'test3/scene_001_v01_1789480370.png'),
    resolve its Flow media UUID and display_name from either:
    1. studio.db generations audit table
    2. gflow.db local assets catalog
    """
    if not img_rel_path:
        return None

    filename = os.path.basename(img_rel_path)
    media_id = None
    display_name = None

    # 1. Look in studio.db generations
    workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "workspace"))
    studio_db = os.path.join(workspace_dir, "studio.db")
    if os.path.exists(studio_db):
        try:
            conn = sqlite3.connect(studio_db)
            c = conn.cursor()
            c.execute(
                "SELECT flow_media_ids FROM generations WHERE output_paths LIKE ? ORDER BY id DESC LIMIT 1",
                (f"%{filename}%",)
            )
            row = c.fetchone()
            conn.close()
            if row and row[0]:
                ids = json.loads(row[0])
                if ids and isinstance(ids, list) and ids[0]:
                    media_id = ids[0]
        except Exception:
            pass

    # 2. Look in gflow.db assets for metadata display_name
    home_dir = os.path.expanduser("~")
    gflow_db = os.path.join(home_dir, "Library", "Application Support", "gflow-cli", "gflow.db")
    if os.path.exists(gflow_db):
        try:
            conn = sqlite3.connect(gflow_db)
            c = conn.cursor()
            if media_id:
                c.execute("SELECT metadata_json FROM assets WHERE flow_media_id = ? LIMIT 1", (media_id,))
                row = c.fetchone()
                if row and row[0]:
                    try:
                        meta = json.loads(row[0])
                        display_name = meta.get("display_name")
                    except Exception:
                        pass

            if not display_name:
                m = re.search(r'(\d{10})', filename)
                if m:
                    ts = int(m.group(1))
                    c.execute(
                        "SELECT flow_media_id, created_at, metadata_json FROM assets WHERE profile_name=? ORDER BY created_at DESC LIMIT 50",
                        (profile,)
                    )
                    for f_id, created_at, meta_json in c.fetchall():
                        try:
                            dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                            row_ts = int(dt.timestamp())
                            if abs(row_ts - ts) <= 10:
                                meta = json.loads(meta_json) if meta_json else {}
                                media_id = f_id
                                display_name = meta.get("display_name")
                                break
                        except Exception:
                            pass
            conn.close()
        except Exception:
            pass

    if media_id or display_name:
        return {"media_id": media_id, "display_name": display_name}

    return None

def check_flow_status(profile: str = DEFAULT_PROFILE, daemon_host: str = DEFAULT_DAEMON_HOST) -> Dict[str, Any]:
    """Check connectivity to gflow-cli and the background daemon."""
    status = {
        "cli_available": os.path.exists(GFLOW_BIN),
        "daemon_running": False,
        "authenticated": False,
        "profile": profile
    }
    
    # Check daemon without triggering MCP session handshake (root / returns 404 when server is up)
    try:
        r = requests.get(f"{daemon_host}/", timeout=1.5)
        if r.status_code in [200, 400, 404, 405]:  # Server responded
            status["daemon_running"] = True
    except Exception:
        status["daemon_running"] = False

    # Check profile directory in ~/Library/Application Support/gflow-cli/
    home_dir = os.path.expanduser("~")
    profile_dir = os.path.join(home_dir, "Library", "Application Support", "gflow-cli", f"profile_{profile}")
    if os.path.exists(profile_dir):
        status["authenticated"] = True

    return status

def trigger_flow_render(
    prompt: str,
    project_slug: str,
    scene_number: int,
    aspect_ratio: str = "16:9",
    count: int = 1,
    model: str = "nano2",
    reference_images: Optional[List[str]] = None,
    flow_project_id: Optional[str] = None,
    profile: str = DEFAULT_PROFILE,
    instructions: Optional[str] = None,
    daemon_host: str = DEFAULT_DAEMON_HOST
) -> Dict[str, Any]:
    """
    Trigger Google Flow image generation using either:
    1. Persistent Streamable HTTP MCP server (gflow serve on :8765)
    2. Direct CLI fallback (gflow image t2i / i2i)
    """
    workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "workspace"))
    project_dir = os.path.join(workspace_dir, project_slug)
    os.makedirs(project_dir, exist_ok=True)
    
    temp_out_dir = os.path.join(project_dir, "_flow_temp")
    os.makedirs(temp_out_dir, exist_ok=True)

    # Normalize aspect ratio (Flow supports 16:9, 9:16, 1:1, 4:3, 3:4)
    valid_aspects = ["16:9", "9:16", "1:1", "4:3", "3:4"]
    if aspect_ratio not in valid_aspects:
        aspect_ratio = "16:9"

    # Clean up prompt & instructions: remove '@' prefix to prevent gflow-cli from
    # attempting mention index lookups (which fail with 401 on migrated flow.google.com accounts)
    if prompt:
        prompt = prompt.replace("@", "")
    if instructions:
        instructions = instructions.replace("@", "")

    count = max(1, min(int(count), 4))
    if model not in ["nano2", "nano-pro", "image4"]:
        model = "nano2"

    # Resolve reference image paths: flow.google.com requires local files for image references.
    resolved_refs = []
    if reference_images:
        for ref in reference_images:
            if not ref:
                continue
            # 1. Prefer existing local file (absolute or workspace-relative)
            if os.path.isabs(ref) and os.path.exists(ref):
                resolved_refs.append(ref)
                continue
            rel_candidate = os.path.join(workspace_dir, ref)
            if os.path.exists(rel_candidate):
                resolved_refs.append(os.path.abspath(rel_candidate))
                continue
            # 2. Fallback: if not found on disk, check if it's a UUID
            resolved_refs.append(ref)

    # Fallback for migrated flow.google.com accounts where createProject TRPC is unsupported
    if not flow_project_id:
        flow_project_id = os.getenv("FLOW_PROJECT_ID") or None

    generated_files = []
    returned_flow_project_id = flow_project_id
    flow_media_ids = []

    # Strategy 1: Attempt Streamable HTTP MCP if daemon is running
    mcp_success = False
    try:
        mcp_url = f"{daemon_host}/mcp"
        headers = {"Accept": "application/json, text/event-stream"}
        
        # 1. Initialize MCP Session
        init_payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "cavepaint-backend", "version": "1.0"}
            }
        }
        init_res = requests.post(mcp_url, json=init_payload, headers=headers, timeout=10)
        if init_res.status_code == 200:
            session_id = init_res.headers.get("mcp-session-id")
            if session_id:
                sess_headers = dict(headers)
                sess_headers["mcp-session-id"] = session_id
                
                # 2. Initialized notification
                try:
                    requests.post(
                        mcp_url,
                        json={"jsonrpc": "2.0", "method": "notifications/initialized"},
                        headers=sess_headers,
                        timeout=5
                    )
                except Exception:
                    pass

                # 3. Call tool
                call_payload = {
                    "jsonrpc": "2.0",
                    "id": int(time.time()),
                    "method": "tools/call",
                    "params": {
                        "name": "gflow_generate_image",
                        "arguments": {
                            "prompt": prompt,
                            "model": model,
                            "aspect": aspect_ratio,
                            "count": count,
                            "profile": profile,
                            "project": flow_project_id or None,
                            "project_name": f"MoniSekha_{project_slug}",
                            "reference_images": resolved_refs if resolved_refs else None,
                            "output": temp_out_dir
                        }
                    }
                }
                call_res = requests.post(mcp_url, json=call_payload, headers=sess_headers, timeout=180)
                
                # Clean up session
                try:
                    requests.delete(mcp_url, headers=sess_headers, timeout=5)
                except Exception:
                    pass

                if call_res.status_code == 200:
                    # Parse SSE response
                    tool_data = None
                    for line in call_res.text.split("\n"):
                        line = line.strip()
                        if line.startswith("data:"):
                            data_str = line[len("data:"):].strip()
                            try:
                                data_obj = json.loads(data_str)
                                if "result" in data_obj:
                                    res_obj = data_obj["result"]
                                    tool_data = res_obj.get("structuredContent")
                                    if not tool_data:
                                        content_list = res_obj.get("content", [])
                                        if content_list and isinstance(content_list[0], dict):
                                            raw_text = content_list[0].get("text", "{}")
                                            try:
                                                tool_data = json.loads(raw_text)
                                            except Exception:
                                                tool_data = {"status": "error", "error": {"detail": raw_text}}
                                    if res_obj.get("isError") and not tool_data:
                                        tool_data = {"status": "error", "error": {"detail": "MCP Tool error"}}
                                    break
                                elif "error" in data_obj:
                                    print(f"MCP tool error: {data_obj['error']}")
                            except Exception as parse_err:
                                print(f"Error parsing MCP SSE chunk: {parse_err}")

                    if isinstance(tool_data, dict):
                        if tool_data.get("status") in ["completed", "success"]:
                            files = tool_data.get("files", [])
                            if files:
                                generated_files = list(files)
                            returned_flow_project_id = tool_data.get("flow_project_id") or tool_data.get("project") or flow_project_id
                            if tool_data.get("flow_media_ids"):
                                flow_media_ids = list(tool_data["flow_media_ids"])
                            elif tool_data.get("flow_media_id"):
                                flow_media_ids = [tool_data["flow_media_id"]]
                            mcp_success = True
                        elif tool_data.get("status") in ["failed", "error"]:
                            err_info = tool_data.get("error", {})
                            detail = err_info.get("detail") if isinstance(err_info, dict) else str(err_info)
                            err_type = err_info.get("type", "") if isinstance(err_info, dict) else ""
                            if "no-profile" in err_type or "login" in detail.lower() or "auth" in detail.lower():
                                raise Exception(
                                    f"Google Flow Authentication required. Please run in terminal: "
                                    f"'{GFLOW_BIN} auth login --profile {profile} --browser chrome'"
                                )
                            elif "profile-locked" in err_type or "locked" in detail.lower():
                                raise Exception(
                                    f"Google Flow profile '{profile}' is currently in use or locked by an active process "
                                    f"(such as 'gflow auth login' or an open Chrome window). "
                                    f"Please complete your sign-in in Chrome and let it close, then retry."
                                )
                            raise Exception(f"Google Flow MCP Generation error: {detail}")
    except Exception as e:
        if "Authentication required" in str(e) or "currently in use or locked" in str(e):
            raise
        print(f"MCP HTTP request to daemon failed or daemon offline ({e}). Falling back to direct CLI...")

    # Strategy 2: CLI Subprocess Fallback
    if not mcp_success:
        if not os.path.exists(GFLOW_BIN):
            raise Exception(f"gflow binary not found at '{GFLOW_BIN}'. Please ensure gflow-cli is installed.")

        cmd = [GFLOW_BIN, "image"]
        if resolved_refs:
            cmd.extend(["i2i", prompt])
            for ref in resolved_refs:
                cmd.extend(["--ref", ref])
        else:
            cmd.extend(["t2i", prompt])

        cmd.extend([
            "--model", model,
            "--aspect", aspect_ratio,
            "--count", str(count),
            "--out", temp_out_dir,
            "--profile", profile,
            "--json"
        ])

        if flow_project_id:
            cmd.extend(["--project", flow_project_id])
        else:
            cmd.extend(["--project-name", f"MoniSekha_{project_slug}"])

        print(f"Executing gflow command: {' '.join(cmd)}")
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=300)

        if proc.returncode != 0:
            err_msg = proc.stderr.strip() or proc.stdout.strip()
            if "not logged in" in err_msg.lower() or "no profiles" in err_msg.lower() or "auth" in err_msg.lower():
                raise Exception(
                    f"Google Flow Authentication required. Please run in terminal: "
                    f"'{GFLOW_BIN} auth login --profile {profile} --browser chrome'"
                )
            elif "profilelockederror" in err_msg.lower() or "resource temporarily unavailable" in err_msg.lower() or "profile-locked" in err_msg.lower():
                raise Exception(
                    f"Google Flow profile '{profile}' is currently locked by an active process "
                    f"(such as 'gflow auth login' or an open Chrome window). "
                    f"Please complete your sign-in in Chrome and let it close, then retry."
                )
            raise Exception(f"Google Flow Generation failed (code {proc.returncode}): {err_msg}")

        # Parse JSON output from stdout
        try:
            # Look for JSON block in stdout
            lines = proc.stdout.strip().split("\n")
            for line in reversed(lines):
                line = line.strip()
                if line.startswith("{") and line.endswith("}"):
                    parsed = json.loads(line)
                    if "files" in parsed:
                        generated_files = parsed.get("files", [])
                    elif "images" in parsed:
                        generated_files = [img.get("local_path") for img in parsed.get("images", []) if img.get("local_path")]
                        flow_media_ids = [img.get("media_name") for img in parsed.get("images", []) if img.get("media_name")]
                    if "project_id" in parsed:
                        returned_flow_project_id = parsed.get("project_id")
                    elif "project" in parsed:
                        returned_flow_project_id = parsed.get("project")
                    break
        except Exception as json_err:
            print(f"Could not parse JSON stdout: {json_err}. Scanning output directory...")

    # Scan temp_out_dir and project_dir for any generated files not captured in generated_files
    if os.path.exists(temp_out_dir):
        for root, _, fnames in os.walk(temp_out_dir):
            for f in sorted(fnames):
                if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
                    full_f = os.path.join(root, f)
                    if full_f not in generated_files:
                        generated_files.append(full_f)

    if os.path.exists(project_dir):
        for f in sorted(os.listdir(project_dir)):
            if f.startswith("_flow_temp") and f.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
                full_f = os.path.join(project_dir, f)
                if full_f not in generated_files:
                    generated_files.append(full_f)

    if not generated_files:
        raise Exception("No image files produced by Google Flow generation.")

    # Determine starting version index by checking existing versions for this scene
    ver_pattern = re.compile(rf"^scene_{scene_number:03d}_v(\d+)_")
    existing_versions = []
    if os.path.exists(project_dir):
        for f in os.listdir(project_dir):
            m = ver_pattern.match(f)
            if m:
                try:
                    existing_versions.append(int(m.group(1)))
                except ValueError:
                    pass
    next_ver = max(existing_versions, default=0) + 1

    # Move generated files into project workspace with clean filenames (standardize on PNG)
    final_paths = []
    ts = int(time.time())
    for idx, filepath in enumerate(generated_files):
        if not os.path.exists(filepath):
            continue
        ver_num = next_ver + idx
        dest_filename = f"scene_{scene_number:03d}_v{ver_num:02d}_{ts}.png"
        dest_path = os.path.join(project_dir, dest_filename)
        
        ext = os.path.splitext(filepath)[1].lower()
        if ext in [".jpg", ".jpeg", ".webp"]:
            try:
                from PIL import Image
                with Image.open(filepath) as im:
                    im.convert("RGB").save(dest_path, "PNG")
                try:
                    os.remove(filepath)
                except Exception:
                    pass
            except Exception:
                shutil.move(filepath, dest_path)
        else:
            shutil.move(filepath, dest_path)

        final_paths.append(f"{project_slug}/{dest_filename}")

    # Cleanup temp folder and any stray _flow_temp files
    try:
        shutil.rmtree(temp_out_dir, ignore_errors=True)
    except Exception:
        pass

    if os.path.exists(project_dir):
        for f in os.listdir(project_dir):
            if f.startswith("_flow_temp"):
                try:
                    p = os.path.join(project_dir, f)
                    if os.path.isfile(p):
                        os.remove(p)
                    elif os.path.isdir(p):
                        shutil.rmtree(p, ignore_errors=True)
                except Exception:
                    pass

    return {
        "status": "completed",
        "output_paths": final_paths,
        "flow_project_id": returned_flow_project_id,
        "flow_media_ids": flow_media_ids
    }
