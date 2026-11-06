# FitLore Animated Shorts Autopilot

An autonomous 3D vertical animation production and scheduling pipeline for **FitLore** YouTube Shorts.

## Features
- **Script & Scientific Foundation**: Sourced from peer-reviewed sports science, psychology, and biomechanics literature.
- **Narrator**: Local & cloud-ready neural TTS using **Kokoro Voice Studio** (`am_adam` at 1.0x speed).
- **Animation**: 1440×2560 vertical 3D canvas animation built with **Remotion** and **Three.js**.
- **Mastered Audio**: Dynamic musical score and foley mix conforming to YouTube Shorts loudness standards (-14.0 LUFS, -1.5 dBTP max peak).
- **Publishing & Scheduling**: Direct integration with **SchedulePost** targeting YouTube Shorts daily at 7:30 PM WAT (Africa/Lagos).

## Repository Structure
```
├── .github/workflows/
│   └── daily-video-automation.yml   # 12:00 PM WAT daily cloud automation
├── claude-animated-shorts/          # Remotion & Three.js animation engine
│   ├── projects/                    # Storyboards, scripts, narration, and scenes
│   ├── scripts/kokoro_voice.py      # Portable Kokoro TTS synthesizer
│   └── src/videos/                  # Three.js 3D character & scene components
├── video_publisher/                 # SchedulePost publishing engine & SQLite ledger
├── Rendered Videos/                 # Delivery receipts, subtitles (.srt), and cover stills
├── scripts/
│   └── produce_and_schedule.py      # Master autonomous pipeline runner
├── FITLORE_VIDEO_LIBRARY.json       # Master state & queue tracking all 100 video ideas
└── FITLORE_MEMORY.md                # Operating directives and repetition prevention rules
```

## Running the Pipeline

### 1. Locally (via Antigravity Sidecar)
The local scheduled automation runs via Antigravity Sidecars at 12:00 PM WAT:
- Sidecar ID: `daily-fitlore-video`
- Managed at: `~/.gemini/config/sidecars/daily-fitlore-video/sidecar.json`
- Dashboard: [Open Automations Dashboard](sidecar://dashboard)

### 2. Remotely (via Antigravity Remote / Cloud Agent)
Connect this repository to **Antigravity Remote** at [antigravity.google.com](https://antigravity.google.com):
- The cloud agent can run `python scripts/produce_and_schedule.py` directly inside Google's managed cloud container.

### 3. Fully Automated (via GitHub Actions)
The workflow in `.github/workflows/daily-video-automation.yml` triggers automatically every day at 12:00 PM WAT:
- Set `SCHEDULEPOST_API_KEY` in your GitHub repository secrets (**Settings > Secrets and variables > Actions**).
- Produces the next video, uploads and books it on SchedulePost for 7:30 PM, and automatically commits the updated [`FITLORE_VIDEO_LIBRARY.json`](FITLORE_VIDEO_LIBRARY.json) back to the repo.
