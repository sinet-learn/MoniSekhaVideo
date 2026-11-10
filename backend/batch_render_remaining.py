import os
import sys
import sqlite3
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from backend.services.draw_things import trigger_local_render

def render_remaining_scenes(project_id: int = 2):
    db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "workspace", "studio.db"))
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    
    # Get project slug
    c.execute("SELECT slug FROM projects WHERE id = ?", (project_id,))
    row = c.fetchone()
    if not row:
        print(f"Project {project_id} not found")
        return
    project_slug = row[0]
    
    # Get all scenes
    c.execute(
        "SELECT scene_number, image_prompt_english, image_path FROM scenes WHERE project_id = ? ORDER BY scene_number",
        (project_id,)
    )
    scenes = c.fetchall()
    
    workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "workspace"))
    proj_dir = os.path.join(workspace_dir, project_slug)
    
    for scene_number, prompt, img_path in scenes:
        file_path = os.path.join(proj_dir, f"scene_{scene_number:03d}.png")
        # If file doesn't exist or is a placeholder (< 20 KB)
        is_placeholder = not os.path.exists(file_path) or os.path.getsize(file_path) < 20000
        
        if is_placeholder:
            print(f"--> Rendering Scene {scene_number} ({prompt[:50]}...)...")
            try:
                trigger_local_render(
                    prompt=prompt or "Clean educational illustration",
                    project_name=project_slug,
                    scene_number=scene_number,
                    width=1024,
                    height=576
                )
                print(f"Successfully finished Scene {scene_number}")
            except Exception as e:
                print(f"Failed Scene {scene_number}: {e}")
        else:
            print(f"Scene {scene_number} already has high-res image ({os.path.getsize(file_path)/1024:.1f} KB). Skipping.")
            
    print("All remaining scenes processed.")

if __name__ == "__main__":
    render_remaining_scenes()
