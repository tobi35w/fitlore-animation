import json
from pathlib import Path

timeline_path = Path("claude-animated-shorts/projects/fourteen-mondays/timeline.json")
data = json.loads(timeline_path.read_text(encoding="utf-8"))

lines = [
    "# Fourteen Mondays shot plan",
    "",
    "Frame ends are exclusive. Reactions precede aligned words by 0–3 frames. timeline.json drives picture and sound.",
    "",
    "|Shot|Frames / seconds|Words|Location / light|Camera start → end; look start → end|Action and props|DOF|",
    "|---|---|---|---|---|---|---|"
]

for s in data["shots"]:
    sec_a = s["a"] / 30.0
    sec_b = s["b"] / 30.0
    cam = f"{s['cameraType']}: {s['pos']} → {s['end']}; {s['look']} → {s['lookEnd']}; FOV 40°"
    row = f"|{s['id']} · {s['title']}|{s['a']}–{s['b']} / {sec_a:.2f}–{sec_b:.2f}|{s['words']}|{s['location']} / {s['light']}|{cam}|{s['action']} Props: {s['props']}|{s['dof']}|"
    lines.append(row)

out_path = Path("claude-animated-shorts/projects/fourteen-mondays/shots.md")
out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
print("Wrote shots.md successfully.")
