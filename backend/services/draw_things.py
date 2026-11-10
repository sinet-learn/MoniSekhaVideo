import os
import base64
import requests
import time
import re
import urllib.parse
from PIL import Image, ImageDraw
import io

def trigger_local_render(
    prompt: str,
    project_name: str,
    scene_number: int,
    width: int = 576,
    height: int = 1024,
    cfg_scale: float = 7.5,
    steps: int = 30,
    init_image_path: str = None,
    negative_prompt: str = ""
) -> str:
    """
    Renders an image for a scene:
    1. Attempts to connect to Draw Things API locally at http://127.0.0.1:7860
    2. If offline, falls back to Pollinations cloud synthesis with intelligent retry / rate limit waiting
    3. If all fails, creates a clear informational placeholder
    """
    workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "workspace"))
    project_dir = os.path.join(workspace_dir, project_name)
    os.makedirs(project_dir, exist_ok=True)
    
    padded_scene_number = f"{int(scene_number):03d}"
    save_path = os.path.join(project_dir, f"scene_{padded_scene_number}.png")
    
    # 1. Try Draw Things local server
    endpoint = "http://127.0.0.1:7860/sdapi/v1/txt2img"
    payload = {
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "steps": steps,
        "cfg_scale": cfg_scale,
        "width": width,
        "height": height,
    }
    
    if init_image_path and os.path.exists(init_image_path):
        try:
            with Image.open(init_image_path) as img:
                img_resized = img.resize((width, height), Image.Resampling.LANCZOS)
                buffered = io.BytesIO()
                img_resized.save(buffered, format="PNG")
                b64_init = base64.b64encode(buffered.getvalue()).decode("utf-8")
            payload["init_images"] = [b64_init]
            payload["denoising_strength"] = 0.55
            endpoint = "http://127.0.0.1:7860/sdapi/v1/img2img"
        except Exception as e:
            print(f"Failed to load init image, falling back to txt2img: {e}")
    
    try:
        response = requests.post(endpoint, json=payload, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if "images" in data and len(data["images"]) > 0:
            b64_image = data["images"][0]
            if b64_image.startswith("data:image/png;base64,"):
                b64_image = b64_image.split(",")[1]
            
            image_data = base64.b64decode(b64_image)
            with open(save_path, "wb") as f:
                f.write(image_data)
            print(f"Draw Things successfully rendered scene {scene_number} -> {save_path}")
            return save_path
        else:
            raise Exception("No image returned from Draw Things API")
            
    except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
        print(f"Draw Things API is offline on 127.0.0.1:7860. Attempting cloud generation for scene {scene_number}...")
        
        # 2. Cloud Fallback (Pollinations with rate limit retry & key support)
        # Check if an optional pollen key is set in environment
        pollen_key = os.getenv("POLLEN_API_KEY") or os.getenv("POLLINATIONS_API_KEY")
        headers = {}
        if pollen_key:
            headers["Authorization"] = f"Bearer {pollen_key.strip()}"
        
        # Clean & sanitize prompt for best cloud synthesis results
        clean_prompt = prompt.strip()
        # Truncate prompt if overly long (cloud models work best under 50 words)
        words = clean_prompt.split()
        if len(words) > 40:
            clean_prompt = " ".join(words[:40])
            
        encoded_prompt = urllib.parse.quote(clean_prompt)
        cloud_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width={width}&height={height}&nologo=true&seed={int(scene_number) * 100 + 42}"
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                print(f"[Cloud Fallback] Scene {scene_number} (attempt {attempt + 1}/{max_retries})...")
                cloud_resp = requests.get(cloud_url, headers=headers, timeout=60)
                
                if cloud_resp.status_code == 200 and len(cloud_resp.content) > 1000:
                    with Image.open(io.BytesIO(cloud_resp.content)) as pil_img:
                        pil_img.save(save_path, format="PNG")
                    print(f"[Cloud Fallback] Successfully rendered scene {scene_number} ({len(cloud_resp.content)} bytes) to {save_path}")
                    return save_path
                elif cloud_resp.status_code == 402:
                    # Rate limited: free limit is 1 image per 45s per IP
                    try:
                        err_data = cloud_resp.json()
                        msg = err_data.get("error", {}).get("message", "")
                        match = re.search(r"Retry after (\d+)s", msg)
                        wait_seconds = int(match.group(1)) + 2 if match else 45
                    except Exception:
                        wait_seconds = 45
                    
                    print(f"[Cloud Fallback] Rate limit reached for scene {scene_number}. Waiting {wait_seconds}s before retrying...")
                    time.sleep(wait_seconds)
                else:
                    print(f"[Cloud Fallback] Returned HTTP {cloud_resp.status_code}: {cloud_resp.text[:100]}")
                    time.sleep(5)
            except Exception as loop_err:
                print(f"[Cloud Fallback] Request error on scene {scene_number}: {loop_err}")
                time.sleep(5)

        # 3. Informational placeholder if both Draw Things and cloud fail
        try:
            img = Image.new('RGB', (width, height), color = (30, 41, 59))
            d = ImageDraw.Draw(img)
            text = (
                f"Scene {scene_number}\n\n"
                "Image Generation Offline\n\n"
                "To generate images:\n"
                "1. Open Draw Things app on Mac\n"
                "   and enable API Server on port 7860,\n"
                "   OR\n"
                "2. Upload your own image directly\n"
                "   using the Upload button above."
            )
            d.text((40, height // 3), text, fill=(226, 232, 240))
            img.save(save_path)
            return save_path
        except Exception as pil_error:
            print(f"Fallback generation failed: {pil_error}")
            raise Exception("Draw Things API is unreachable and cloud generation failed.")
            
    except Exception as e:
        print(f"Error calling Draw Things API: {e}")
        raise e
