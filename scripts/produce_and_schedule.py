"""Autonomous daily production & scheduling runner for FitLore shorts.

Compatible with both local Windows workstations and headless Linux cloud runners.
"""
import datetime
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIBRARY_PATH = ROOT / "FITLORE_VIDEO_LIBRARY.json"
SHORTS_DIR = ROOT / "claude-animated-shorts"
PUBLISHER_DIR = ROOT / "video_publisher"
RENDERED_DIR = ROOT / "Rendered Videos"


def log(msg: str):
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{now}] [AUTOPILOT] {msg}", flush=True)


def get_python_exe() -> str:
    # Use current running python interpreter (compatible with cloud and local venvs)
    return sys.executable


def load_library():
    with open(LIBRARY_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_library(data):
    with open(LIBRARY_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def main():
    log("Starting autonomous FitLore daily video production runner...")
    RENDERED_DIR.mkdir(parents=True, exist_ok=True)

    lib = load_library()
    selection = lib.get("selection", {})
    order = selection.get("order", [])
    active_id = selection.get("active_idea_id")

    # Find the next idea
    idea_to_run = None
    if active_id:
        log(f"Resuming active idea #{active_id}...")
        for idea in lib.get("ideas", []):
            if idea["id"] == active_id:
                idea_to_run = idea
                break
    else:
        completed_ids = {h.get("source_idea_id") for h in lib.get("history", []) if h.get("source_idea_id")}
        for idea_id in order:
            if idea_id not in completed_ids:
                for idea in lib.get("ideas", []):
                    if idea["id"] == idea_id and idea.get("status") in ("queued", "in_progress"):
                        idea_to_run = idea
                        break
            if idea_to_run:
                break

    if not idea_to_run:
        log("No eligible ideas waiting in the queue. Everything is up to date!")
        return

    idea_id = idea_to_run["id"]
    title = idea_to_run.get("title")
    slug = idea_to_run.get("project_slug") or f"idea-{idea_id}"
    log(f"Selected Idea #{idea_id}: '{title}' (slug: {slug})")

    # Mark in-progress
    selection["active_idea_id"] = idea_id
    idea_to_run["status"] = "in_progress"
    save_library(lib)

    project_dir = SHORTS_DIR / "projects" / slug
    if not project_dir.exists():
        log(f"Project directory {project_dir} does not exist yet. Ensure the story project is created.")
        return

    # 1. Voice Synthesis via Kokoro
    voice_dir = project_dir / "voice"
    voice_dir.mkdir(parents=True, exist_ok=True)
    narration_file = project_dir / "narration.txt"
    if narration_file.exists():
        log("Synthesizing narration via Kokoro TTS (am_adam, 1.0x)...")
        kokoro_script = SHORTS_DIR / "scripts" / "kokoro_voice.py"
        subprocess.check_call([
            get_python_exe(),
            str(kokoro_script),
            "--text", str(narration_file),
            "--voice", "am_adam",
            "--speed", "1.0",
            "--out-dir", str(voice_dir)
        ])

    # 2. Remotion Render
    log("Rendering Remotion final export (1440x2560 at 30 fps)...")
    comp_name = "".join(part.capitalize() for part in slug.split("-"))
    render_cmd = ["node", "scripts/cli.mjs", "render", comp_name, "--quality", "final"]
    subprocess.check_call(render_cmd, cwd=str(SHORTS_DIR))

    # 3. Schedule via Publisher
    log("Scheduling post on SchedulePost for YouTube Shorts at 7:30 PM WAT...")
    pub_cmd = [get_python_exe(), "main.py", "process"]
    subprocess.check_call(pub_cmd, cwd=str(PUBLISHER_DIR))

    # 4. Reconcile confirmation
    reconcile_cmd = [get_python_exe(), "main.py", "reconcile"]
    subprocess.check_call(reconcile_cmd, cwd=str(PUBLISHER_DIR))

    log(f"Daily automation run for Idea #{idea_id} completed successfully!")


if __name__ == "__main__":
    main()
