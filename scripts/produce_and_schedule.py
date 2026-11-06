"""Autonomous daily production & scheduling runner for FitLore shorts.

Compatible with both local Windows workstations and headless Linux cloud runners.
"""
import argparse
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
    # On Windows, check for the dedicated Kokoro virtual environment first
    voice_pack_venv = Path(r"C:\Users\tobik\Documents\voice pack\.venv\Scripts\python.exe")
    if voice_pack_venv.exists():
        return str(voice_pack_venv)
    # Check local project venv
    local_venv = SHORTS_DIR / ".venv" / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
    if local_venv.exists():
        return str(local_venv)
    # Default to current running python interpreter (Linux/cloud containers)
    return sys.executable


def load_library():
    with open(LIBRARY_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_library(data):
    with open(LIBRARY_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def run_test_mode():
    log("=== RUNNING CLOUD END-TO-END PIPELINE VERIFICATION TEST ===")
    out_test_dir = ROOT / "out" / "test_verification"
    out_test_dir.mkdir(parents=True, exist_ok=True)

    # 1. Test Kokoro TTS synthesis
    log("[TEST 1/3] Testing Kokoro TTS voice synthesis (am_adam 1.0x)...")
    test_text_file = out_test_dir / "test_narration.txt"
    test_text_file.write_text("Hello! This is an autonomous pipeline verification test for FitLore shorts.", encoding="utf-8")
    test_voice_dir = out_test_dir / "voice"
    test_voice_dir.mkdir(parents=True, exist_ok=True)
    kokoro_script = SHORTS_DIR / "scripts" / "kokoro_voice.py"
    subprocess.check_call([
        get_python_exe(),
        str(kokoro_script),
        "--text", str(test_text_file),
        "--voice", "am_adam",
        "--speed", "1.0",
        "--out-dir", str(test_voice_dir)
    ])
    log("✓ Kokoro voice synthesis test passed!")

    # 2. Test Remotion rendering (30-frame slice)
    log("[TEST 2/3] Testing Remotion headless Chromium rendering...")
    test_video_output = out_test_dir / "test-render-30f.mp4"
    render_cmd = ["node", "scripts/cli.mjs", "render", "FourteenMondays", "--quality", "draft", "--frames", "0-30", "--out", str(test_video_output)]
    subprocess.check_call(render_cmd, cwd=str(SHORTS_DIR))
    log("✓ Remotion headless rendering test passed!")

    # 3. Test SchedulePost API & storage presigning
    log("[TEST 3/3] Testing SchedulePost API authentication and storage target...")
    pub_cmd = [get_python_exe(), "main.py", "verify", "--upload-target-test"]
    subprocess.check_call(pub_cmd, cwd=str(PUBLISHER_DIR))
    log("✓ SchedulePost connection and storage test passed!")

    log("=== ALL PIPELINE VERIFICATION TESTS PASSED SUCCESSFULLY! ===")


def main():
    parser = argparse.ArgumentParser(description="FitLore Autopilot Daily Runner")
    parser.add_argument("--test", action="store_true", help="Run end-to-end pipeline verification test")
    args = parser.parse_args()

    if args.test:
        run_test_mode()
        return

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
