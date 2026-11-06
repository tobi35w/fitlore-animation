import json
from pathlib import Path

lib_path = Path("FITLORE_VIDEO_LIBRARY.json")
temp_path = Path("FITLORE_VIDEO_LIBRARY.tmp.json")

lib = json.loads(lib_path.read_text(encoding="utf-8"))

# 1. Update Idea 12
idea = next((i for i in lib["ideas"] if i["id"] == 12), None)
if idea:
    idea["status"] = "completed"
    idea["completed_at"] = "2026-11-04T22:00:52.000Z"
    idea["final_video"] = r"C:\Users\tobik\Documents\Animation\Rendered Videos\FourteenMondays-final-1440x2560-v1-Adam.mp4"
    idea["qa_report"] = r"C:\Users\tobik\Documents\Animation\Rendered Videos\FourteenMondays-final-1440x2560-v1-Adam-qa\report.md"
    idea["checkpoint"] = "Completed 1440x2560 final export with Kokoro Adam US 1.0x voiceover. QA passed with zero frozen frames and -14.6 LUFS loudness. Ready for scheduled release."

# 2. Clear active idea id
lib["selection"]["active_idea_id"] = None

# 3. Add to history if not present
existing_history = next((h for h in lib["history"] if h["history_id"] == "fourteen-mondays"), None)
if not existing_history:
    lib["history"].append({
        "history_id": "fourteen-mondays",
        "source_idea_id": 12,
        "title": "\"I'll Start Monday\": The 14-Week Trap",
        "aliases": [
            "\"I'll Start Monday\": Marcus's 14 Mondays",
            "Fourteen Mondays",
            "The 14-Week Trap"
        ],
        "status": "completed",
        "completed_date": "2026-11-04",
        "project_slug": "fourteen-mondays",
        "premise": "Marcus waits 14 weeks for the ideal Monday to start his workout routine; minor friction prompts repeated postponements. Seeing his neighbour start a cold, coughing truck anyway teaches him that action does not require a clean slate; he drops to his living room rug on Thursday in socks.",
        "lesson": "Waiting for a symbolic temporal landmark like Monday is often a polished excuse to delay effort; lowering immediate friction on any arbitrary day creates momentum.",
        "final_video": r"C:\Users\tobik\Documents\Animation\Rendered Videos\FourteenMondays-final-1440x2560-v1-Adam.mp4",
        "final_sha256": "a384ee4ef42549e8959746ffd6b62a8162e42c3ea4e4223d9543a0adb57d85ce",
        "qa_report": r"C:\Users\tobik\Documents\Animation\Rendered Videos\FourteenMondays-final-1440x2560-v1-Adam-qa\report.md",
        "versions": [
            {
                "file": r"C:\Users\tobik\Documents\Animation\Rendered Videos\fourteen-mondays-draft.mp4",
                "status": "preview_draft"
            },
            {
                "file": r"C:\Users\tobik\Documents\Animation\Rendered Videos\FourteenMondays-final-1440x2560-v1-Adam.mp4",
                "status": "current",
                "sha256": "a384ee4ef42549e8959746ffd6b62a8162e42c3ea4e4223d9543a0adb57d85ce",
                "narrator": "Adam US (Kokoro Voice Studio, 1.0x)",
                "qa_report": r"C:\Users\tobik\Documents\Animation\Rendered Videos\FourteenMondays-final-1440x2560-v1-Adam-qa\report.md"
            }
        ],
        "publication_status": "ready",
        "proposed_publish_at": "2026-11-05T19:30:00+01:00",
        "notes": [
            "Distinct procrastination / fresh start effect story; no step counter or brick wall analogy.",
            "Voice generated with local Kokoro Voice Studio (am_adam at 1.0x speed) per user specification."
        ]
    })

temp_path.write_text(json.dumps(lib, indent=2), encoding="utf-8")
temp_path.replace(lib_path)
print("Updated FITLORE_VIDEO_LIBRARY.json successfully.")
