# Ten Thousand Steps — 3D rebuild

He-MAN, 2 November 2026. The user's chosen brief is a 55–70 second rebuild of Marcus's illustrative thirty-day walking challenge. The original project and exports stay available.

## Ten rules

1. Use the supplied Three.js/Remotion engine: painted, lit, inked 3D settings with flat bean characters. No slides, generated pictures, stock footage or captions.
2. Preserve the measured look and composer order: ink → lens pre → lens main → bloom → NEUTRAL tone map → grade; MSAA 4, grain off, pixel parameters scaled to height/1920.
3. Source factual claims; distinguish an invented character's story from measured health outcomes. Keep reference footage private and use it only to study the look.
4. Write 200–260 words with the eight required story beats and a literal moving object for every sentence. Obtain the requested script approval before voice/shot production.
5. Use corrected word timings as the timeline source. Start speech at frames 1–4 and land reactions zero to three frames before the associated word.
6. Plan 15–18 different shots, all at most seven seconds, with one-to-three-second inserts/close-ups, continuous camera movement and independent visible animation.
7. Include five traveling-character shots, three object follows, two lighting changes and three localized impact effects; end with a callback filmed from a different angle.
8. Pass character sheets before implementing shots: attached limbs, supported heads, planted feet and shadows, hands contacting props, adult/kid proportions and readable silhouettes. Change difficult staging rather than accept distorted anatomy.
9. Inspect world wide/mid/close stills and three frames from every shot; compare color, ink, depth, motion, anatomy and sentence coverage. Produce original music/SFX beneath clear narration, exact-length 48 kHz audio at −14 ±1 LUFS and ≤−1 dBTP.
10. Preserve versioned videos in `../Rendered Videos/`. Preview at 1080×1920; final at 1440×2560/30 fps/CRF16. Run the unchanged picture gate and short QA, record full outputs, inspect every contact sheet and repair failures before delivery. Publishing remains disabled.

## Generic engine and per-video work

Generic look modules: `ink.ts`, `lensblur.ts`, `grade.ts`, `shade.ts`, `lights.ts`, `cardshade.ts`, the renderer/composer in `Bridge.tsx`, the `Pen` drawing API in `toon.ts`, and reusable painted texture recipes in `paint.ts`.

Story-specific: `story.ts`, bridge/town geometry in `build.ts` and `world.ts`, cast roles/action in `cast.ts`, costumes/props in `toon.ts`, and shot/music/event schedules in `audio/timeline.py`, `sfx.py`, `music.py` and `cues.md`.

Start from the template files in `src/videos/ten-thousand-steps-3d/`; retain generic rendering code, replace bridge geography with a residential street, home and coin-jar explanation set, and replace the crowd with Marcus and his daughter. Keep script, approved narration, word alignment and one shared shot/event manifest in `projects/ten-thousand-steps-3d/`; picture and audio consume that manifest. No bridge story constants survive in the new video.

Read the required source files, audio/scripts, seven report tables/top-five lists; studied ten individual reference frames and four full sheets. The original video fails the user gate (124.8 s, 1024×1536, 67.6% frozen, longest frozen span 8.6 s). Its PASS status cannot be carried into this rebuild.
