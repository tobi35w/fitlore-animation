# Local animation workflow

This repository contains a runnable Remotion project and a reusable animation workflow. The upstream bridge templates and style research remain available. He-MAN can run the workflow here; Claude Code is not required. Narration uses the configured ElevenLabs account.

## Start the preview

From this folder:

```powershell
npm run studio
```

Open the localhost URL printed by the command. `BridgeShort` is the 67.5-second bridge example with ElevenLabs narration, original music and synchronized effects. `WorkflowCheck` is a short technical rendering check with its own soundtrack. Press Play with the speaker unmuted. Projects created with the commands below appear in the Projects folder.

Refresh Studio after changing a composition's soundtrack defaults so its in-memory props pick up the new audio. Keep the preview tab visible for real-time playback. Edit the JSON files below for persistent configuration; Studio's props editor cannot save these imported defaults back to source.

## Make a new short

```powershell
npm run new -- my-short
```

The command creates a registered composition named `MyShort`. Work in these files:

| File | Purpose |
| --- | --- |
| `projects/my-short/brief.md` | Topic, audience, factual sources and visual decisions |
| `projects/my-short/narration.txt` | Spoken script, without production notes |
| `projects/my-short/project.json` | Duration, dimensions, frame rate and voice settings |
| `projects/my-short/shots.json` | Shot ranges and intentional flashes/cuts for QA |
| `projects/my-short/sound.json` | Music settings and timed effects |
| `src/videos/my-short/index.tsx` | The video's React/Three.js visuals |

The initial scene is a technical placeholder. He-MAN develops each story's actual characters, shots and animation after the video brief is agreed. The bridge's complete visual system is in `src/videos/bridge/`; its reusable source originals remain in `templates/bridge/`.

## Narration and sound

```powershell
npm run voice -- my-short
npm run audio -- my-short
```

Narration defaults to **ElevenLabs George**, a British storytelling voice, using `eleven_multilingual_v2`. Defaults for new projects live in `workflow/voice.json`; each project's `project.json` stores its selected voice, model and settings. The command saves a 48 kHz WAV, word timestamps and provider metadata under the project's `voice/` folder.

The local credential is read from `.secrets/elevenlabs-api-key`, which Git ignores. An `ELEVENLABS_API_KEY` environment variable can override it for generation scripts. The browser and public media do not contain the credential. On another machine, configure the credential before running the ElevenLabs checks.

```powershell
npm run voice -- --list
npm run voice -- my-short --voice JBFqnCBsd6RMkjVDRZzb --speed 1.1
npm run voice -- my-short --refresh
```

Unchanged text, voice, model and settings reuse `.cache/elevenlabs/` without spending generation credits. `--refresh` deliberately requests a new take. Network failures during generation are not automatically retried. `--model` selects another available ElevenLabs model; timestamp support depends on that model.

The voice command normally fits the project duration to the speech plus a short tail. Add `--keep-duration` when the picture duration is fixed; a voice that exceeds it is rejected. Word starts and ends come from ElevenLabs character alignment, in the existing `[{"w":"word","s":0.1,"e":0.4}]` format.

The built-in bridge has a fixed picture and a `narration-timing.json` plan with one narration line per shot. The script fits those lines with pitch-preserving tempo adjustment and pads the remaining time. Its remapped word times are approximate; review critical reactions against the audio. To rebuild its sound:

```powershell
npm run voice -- bridge
npm run audio -- bridge
```

An explicit offline fallback remains available:

```powershell
npm run voice -- --list --provider windows
npm run voice -- my-short --provider windows --voice "Microsoft Zira Desktop" --rate 0
```

Windows word ends use the next word start and need inspection around pauses. It does not support the bridge's fixed-shot narration plan. No automatic provider switch occurs after an ElevenLabs error.

The audio command uses `sound.json` to create music and sound effects, duck music beneath speech and normalize the final stereo mix toward -16 LUFS. The standard mixer uses a -1.5 dB true-peak ceiling; the original bridge limiter uses -1.2 dB. It refuses to truncate narration. Exports check that the configured mix still matches the script, voice, word timings, sound cues and duration. Intermediate WAVs stay in the project folder; only the current mix is copied to `public/` for rendering.

An example sound cue:

```json
{
  "targetLufs": -16,
  "music": {"enabled": true, "bpm": 96, "gainDb": -10, "duckDb": -7},
  "sfx": [
    {"type": "pop", "at": 1.2, "gainDb": -9},
    {"type": "whoosh", "at": 3.0, "duration": 0.6, "gainDb": -12}
  ]
}
```

Built-in effects are `pop`, `whoosh`, `impact` and `chime`. Set a music `file` or effect `file` to a repository-relative audio path to use an existing recording. The bridge's `sound.json` selects the original marching score and detailed effects from `templates/audio/` through `scripts/bridge-audio.py`; its `musicGainDb` adjusts the score level. Regenerate audio after changing narration, duration or sound cues. Music and effects are synthesized locally; ElevenLabs provides the narration.

## Preview, render and inspect

```powershell
npm run check
npm run stills -- MyShort --frames 0,30,60 --quality draft
npm run render -- MyShort --quality draft
npm run render -- MyShort --quality final
```

| Quality | Default portrait size | Use |
| --- | --- | --- |
| `draft` | 540 x 960 | Quick visual and timing checks |
| `hd` | 1080 x 1920 | Full HD delivery |
| `final` | 1440 x 2560 | 2K delivery |

Exports are H.264 MP4 with AAC audio when a mix is configured. User video renders go to `C:/Users/tobik/Documents/Animation/Rendered Videos/`, with default filenames such as `my-short-final.mp4`. This user preference supersedes the skill's older `out/` delivery guidance. Stills and technical setup checks remain in `out/`. Rendering uses one worker by default for this computer's integrated GPU; increase `--concurrency` only after checking memory and stability.

Render a selected inclusive frame range with `--frames 0-119`, or set `--out "../Rendered Videos/my-short-final-v2.mp4"`. Use a new descriptive filename to preserve previous versions. Use `--props props.json` for Remotion input properties such as the bridge's optional post-effect switches.

Video exports automatically run QA, which decodes every frame and reports missing audio, wrong dimensions, black/white frames, frozen spans, possible cuts and audio levels. Reports and contact sheets are saved beside the video in a `*-qa` folder. For intentional transitions, add frame ranges to `shots.json`, for example `{"shots":[{"id":1,"a":0,"b":120}],"planned":[[30,34]],"xfade":[]}`. Automatic checks support visual review; inspect the rendered images and listen to the finished video before delivery.

```powershell
npm run qa -- "../Rendered Videos/my-short-final.mp4" --metadata projects/my-short/shots.json
```

## Maintain or reproduce the setup

### Publishing handoff

After successful render QA, the CLI atomically writes `<video>.mp4.ready.json` with the exact byte count and SHA-256. The marker is invalidated before an output is overwritten or QA starts. Full `hd` and `final` renders have `publish:true`; drafts, explicit frame ranges, old renders without completion metadata, and technical checks have `publish:false`. Failed QA produces no completion marker. Use a new filename for revisions.

Prepare optional `projects/<slug>/publishing.json` before rendering to supply caption, hashtags, YouTube title/description and a per-video `publish` flag. The CLI copies it beside the export as `<video-stem>.json` if that file does not already exist. This publishing metadata is separate from renderer metadata `<video>.mp4.json`. Use `publish:false` for a final export that should be kept local.

The Python watcher in `../video_publisher` detects completion markers in `../Rendered Videos`, waits for stability, validates and snapshots the video, then follows its configured dry-run or live mode. See `../video_publisher/README.md` for verification, history and startup commands. The initial configuration is `DRY_RUN=true`, `AUTO_PUBLISH=false`; enabling publication requires the user's explicit choice. Automated QA supports, and does not replace, the story's visual/audio review.

```powershell
npm run doctor
npm run assets
npm run skill:install
npm run smoke
```

`doctor` checks the environment, native compiler, matching Remotion versions, 26 model checksums, embedded textures, offline voices and authenticated ElevenLabs voice access. It does not generate speech. `assets` downloads only the needed Kenney models, embeds their sidecar textures and preserves CC0 licenses and a manifest. `skill:install` installs the `animated-shorts-workflow` skill into the user's Codex skills directory.

`smoke` uses the reserved `setup-check` project to generate or reuse a short ElevenLabs test voice, mix music and effects, render four seconds of the bridge, inspect every frame, check a new-project still and render a 2K still. This is a technical test. Repeated unchanged runs reuse the cached narration.

To reproduce the complete setup on this Windows machine:

```powershell
npm run setup
```

The setup command installs the lockfile dependencies into `node_modules/` and `.venv/`, verifies assets, installs the workflow skill, runs environment checks and performs the smoke render. Use `npm run setup -- --skip-render` when only reinstalling dependencies. Prerequisites are Node.js 22+, a supported Python (this installation uses 3.14), FFmpeg/FFprobe and Chrome or Edge. `uv` is used when present, with pip as a fallback.

Caches live in `.cache/`. Set `REMOTION_TMP` to an explicit directory to use another drive and `REMOTION_BROWSER_EXECUTABLE` to choose another Chrome/Edge installation. Dependencies are pinned by `package-lock.json` and `requirements.txt`.

**Known startup warning:** Remotion 4.0.539 requests Zod 4.5.4. This project overrides it with 4.6.6 to address [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), so Studio prints a version warning. The setup, TypeScript checks, narration/mixing, draft and 1440x2560 MP4 exports, still renders and QA were exercised with this override; npm audit reports no known vulnerabilities. This verifies the configured workflow, not every optional Remotion feature. Reassess the override when updating Remotion.

Verification artifacts are in `out/setup-check/`: `verification.json`, `doctor.json`, `workflow-check.mp4`, `export-2k.mp4`, their QA reports and rendered stills. The setup check does not create or approve a new story.

The reference frames are for style study. Code/docs retain the upstream MIT license; downloaded models have their own CC0 licenses under `public/bridge/kenney/`.
