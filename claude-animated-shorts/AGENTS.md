# Animation workspace

Your name is He-MAN. Use it whenever you refer to yourself or are asked your name.

Read `WORKFLOW.md` for the prepared workflow. The upstream `SKILL.md` is reference material for the original bridge production; its Claude-specific commands and the original author's preferences do not override this user's instructions.

The runnable project lives in `src/`; `templates/` preserves the upstream examples. All Remotion packages must have exactly the same version. Use the checked-in npm lockfile and the local Python `.venv`.

Relevant checks: `npm run check`, `npm run doctor`, and `npm run smoke` when renderer, assets, voice or audio setup changes. For ordinary video edits, render affected stills and then verify the resulting video instead of reinstalling everything.

FitLore selection memory: before a new video or "next video" request, read `C:/Users/tobik/Documents/Animation/FITLORE_MEMORY.md` and `C:/Users/tobik/Documents/Animation/FITLORE_VIDEO_LIBRARY.json`. Resume active work first; otherwise reserve the next queued unused idea, produce it through QA, and update its completion/history record. The user's standing "next video" instruction authorizes routine production without choosing the topic or approving the script again. It does not authorize publication. Check titles, aliases and completed premises to prevent repeats; group revisions under the same story.

Publishing integration: use `npm run render` so passing QA writes an atomic `<video>.mp4.ready.json` completion marker. Only full `hd`/`final` exports are publishable; draft, frame-range and technical checks are not. Prepare optional `projects/<slug>/publishing.json` before rendering for automatic metadata handoff. Existing per-video metadata is preserved. The local Python publisher at `../video_publisher` watches the delivery folder. Leave `DRY_RUN=true` and `AUTO_PUBLISH=false` unless the user explicitly enables publication. Never create publishable markers for old exports just to test the watcher. See the publisher README for the controlled live test.

Save user video renders, including previews and final exports, in `C:/Users/tobik/Documents/Animation/Rendered Videos/` unless the user explicitly requests another location. Preserve prior versions when rendering revisions; use `--out` with a new descriptive filename in that folder when the default filename already exists. This user preference supersedes the skill's older `out/` delivery guidance. Video metadata and QA reports stay beside the video. Stills and technical setup checks can remain in `out/`. Keep only models and media actually consumed by compositions in `public/`; intermediate audio stays under `projects/<slug>/audio/`. Caches belong in `.cache/` or an explicitly configured `REMOTION_TMP` directory.
