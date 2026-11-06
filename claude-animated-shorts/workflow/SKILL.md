---
name: animated-shorts-workflow
description: Create and edit cartoon story shorts in the prepared local Three.js and Remotion animation project, including narration, sound, rendering and visual checks. Use for this animation workspace and requests to make shorts in the downloaded cartoon style.
---
<!-- Managed by animated-shorts-workspace -->

Use the prepared project at `{{PROJECT_ROOT}}`. Read its `WORKFLOW.md` for commands and file locations. Run commands from that project directory; use its `.venv` for Python.

## Start a video

- Establish the topic, intended audience, duration and visual direction from the current request. Research factual claims and keep their sources in `projects/<slug>/brief.md`.
- `npm run new -- <slug>` creates a registered composition, editable source, narration text and sound/shot files. Existing projects are never overwritten by that command.
- Put the actual spoken script in `projects/<slug>/narration.txt`. Follow the user's requested review process; a particular example's approval steps are not universal requirements.
- `npm run voice -- <slug>` uses the configured ElevenLabs voice (initially George), saves character-aligned word timings and fits the project duration to the voice. Defaults are in `workflow/voice.json`, with per-project settings in `project.json`. Unchanged inputs reuse cached narration; `--refresh` deliberately spends credits on another take. Use `--keep-duration` when the picture is fixed. The credential is in the ignored `.secrets/elevenlabs-api-key` file or an environment override; keep it out of browser source, public assets and command output.

## Build the picture and sound

- Edit `src/videos/<slug>/index.tsx` and additional source files in that folder. The starter is a technical placeholder, not a completed story.
- The bridge example in `src/videos/bridge/` supplies the established world, character drawing, lighting, outlines and lens effects. Copy the relevant modules when a new story should use that style; rewrite story-specific geometry, actors and timing.
- Use `references/STYLE_BIBLE.md`, the relevant `references/reports/` file, and selected reference images when matching the look. The upstream root `SKILL.md` documents the original bridge's values; its Claude/Opus commands, personal rules and old machine paths are historical context, not requirements for this user's workflow. Keep reference images as study material rather than output assets.
- Drive movement from `useCurrentFrame()` and deterministic functions. Do not use `useFrame()`, wall-clock timers or unseeded randomness for animation. Use `ThreeCanvas` and `staticFile()` for assets.
- Time shots to the narration in `projects/<slug>/voice/words.json`. Put shot cuts, flashes and intentional holds in `shots.json` so checks can distinguish them from defects.
- Edit `sound.json` for music levels and effects. `npm run audio -- <slug>` mixes the current narration, music and effects into a 48 kHz stereo WAV and updates the composition. Regenerate the mix after changing narration, timing or sound cues.
- The configurable mixer includes original procedural music, pop/whoosh/impact/chime effects and file inputs. `npm run audio -- bridge` uses the detailed original marching score and synchronized bridge effects. ElevenLabs supplies narration; music and effects are generated locally. Windows voices remain an explicit `--provider windows` fallback.
- The built-in `BridgeShort` composition reads `projects/bridge/project.json`, including its soundtrack. Its fixed 67.5-second picture uses one narration line per segment in `narration-timing.json`. `npm run voice -- bridge` fits each line with pitch-preserving tempo adjustment; remapped word times are approximate and need audio review for critical reactions. Do not substitute the short setup-check soundtrack for this full-length example.

## Verify and deliver

- Run `npm run check` after source changes. Render selected frames early with `npm run stills -- <CompositionId> --frames 100,400 --quality draft` and inspect the actual image files.
- `npm run render -- <CompositionId> --quality draft` creates a preview and runs every-frame QA. `--quality hd` produces 1080x1920; `--quality final` produces 1440x2560 for the default portrait project. Preview size is 540x960. Keep final exports in `out/`, never in `public/`.
- Review the output video's QA JSON, contact sheets and full-size frames. Investigate missing assets, unexplained black/white/frozen frames, visual obstructions, audio peaks and timing errors. Automated QA does not replace visual or audio review.
- `npm run doctor` checks dependencies, models, offline voices and ElevenLabs access without generating audio. `npm run smoke` checks the technical pipeline using the reserved `setup-check` project and cached ElevenLabs narration. Refresh Studio after changing soundtrack defaults, and keep the tab visible during playback checks. Verify the actual story's preview is unmuted and contains its own audio, as well as checking its exported audio track. A passing setup check does not establish that a later story is complete or visually correct.
- Deliver the verified local MP4 with a brief account of its duration, resolution and any remaining limitations. Video topics and creative choices come from the conversation, not from the setup example.
