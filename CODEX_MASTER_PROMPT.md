# MASTER PROMPT: 3D-cartoon animated shorts (Remotion + three.js)

Put this file in the project root as `AGENTS.md` (or paste it at the start of every Codex session).
Also copy `picture_gate.py` into `scripts/`. The repo `claude-animated-shorts` must be in the project folder.

---

## 0. Mission

You build 55-70 s vertical animated story shorts: **flat 2D bean-head characters standing in a painted, lit, inked 3D world, filmed by a moving camera**, with a fast voice-over and synthesized sound. The look and the working code already exist in `claude-animated-shorts/` (`SKILL.md`, `templates/bridge/`, `references/`). Your job is to reuse that engine for a NEW story, not to invent a different, simpler look.

A previous Codex run produced "Ten Thousand Steps" and the user rejected it. **Section 2 lists exactly what was wrong. Never repeat it.** You may not tell the user a video is finished until Section 9 passes.

## 1. Read first (mandatory, before writing any code)

Read in full, in this order: `SKILL.md`, `README.md`, `references/STYLE_BIBLE.md`, `references/reports/CONTEXT.md`, then the "Top 5 changes" and measured-number tables of all seven `references/reports/*.md`, `templates/SCRIPT_example.md`, and every file in `templates/bridge/`, `templates/audio/`, `templates/scripts/`. Look at at least 10 images in `references/frames/` and 4 in `references/sheets/`.

Then write `UNDERSTANDING.md` (max 1 page) with: (a) the 10 rules you consider most important, (b) which files in `templates/bridge/` are GENERIC (look: `ink.ts lensblur.ts grade.ts shade.ts lights.ts cardshade.ts Bridge.tsx`, drawing API in `toon.ts`) and which are STORY-SPECIFIC (`story.ts`, the bridge/town layout in `build.ts` and `world.ts`, crowd roles in `cast.ts`, the bridge numbers in `audio/timeline.py`), (c) your plan to refactor the story-specific parts into a clean per-video folder `src/videos/<name>/`. Do not start coding until this file exists.

## 2. What the rejected video did wrong (measured on the final .mp4)

Facts from analysing `TenThousandSteps-final.mp4` frame by frame:

| # | Defect | Evidence | Required instead |
|---|---|---|---|
| D1 | **It is a slideshow.** 67.6 % of all frames are frozen. | 2,545 of 3,744 frames identical to the previous one; frozen spans of 8.3-8.6 s at 0:00, 0:09, 0:17, 0:35, 1:26, 1:34 | Every frame moves: camera push-in on every hold, characters walk/blink/breathe/gesture |
| D2 | **~14 stills on a timer.** Hard cut every ~8.5 s (8.7, 17.1, 25.8, 34.9, 43.4, 51.2, 59.4, 67.2, 76.2, 85.8, 94.2, 102.0, 109.0, 117.8 s) | cut detector | 15+ shots in 67 s (about one per 4.5 s), each one with its own camera move; longest shot <= 7 s |
| D3 | **Wrong format.** 1024x1536 (2:3), 124.8 s long | ffprobe | 1080x1920 preview, 1440x2560 final, 55-70 s (about 200-260 words at 3.7 words/s) |
| D4 | **No 3D world.** Flat vector panels: single-colour wall/sky blocks, no depth, no light, no shadow, no lens blur, no ink on geometry | frames at 0:05, 0:28, 0:55, 1:06 | `three.js` scene: painted textures, world ink lines, light + shade, fog, depth of field on about 1/3 of screen time |
| D5 | **Broken anatomy / rigging.** Shoe-tying (0:26-0:34): arm is a rigid board that does not reach the shoe, backpack floats detached, head tilted off the neck. Big close-up (0:52-0:58): shirt shape is crude, one arm detached, hand and wrist look pasted on | frames at 0:28 and 0:55 | Characters from the `toon.ts` `Pen` API with the measured proportions (Section 5); every limb connects to the torso; hands touch what they hold |
| D6 | **Floating props.** A watch with a half arm (0:08-0:17), a phone hovering in a kitchen (0:34-0:43), shoes on a mat (1:26-1:34) with nothing moving | frames | A prop is either held by a visible hand that moves, or it is an animated insert (screen changes, shoe rocks, phone buzzes) |
| D7 | **Debug-looking marks.** Red dotted curves and a red measuring bracket drawn on the road and floor, red tick marks near the arm | frame 0:05, 0:55 | No stray overlays. Effects are the cartoon sprites in SKILL.md (dust puff, speed lines, stars, notes) and only on an impact |
| D8 | **Same shot reused.** The street-with-houses composition appears at 0:00, 0:18, 1:16 and 1:58 with the same camera; the finale (1:58) repeats the opening | contact sheets | Every shot has a different camera position/angle/distance. The ending is a payoff (callback twist), not a repeat |
| D9 | **Close-ups held 6-8 s** (face at 1:49-1:57, face at 0:52-0:59) with almost no change | motion measurement | A close-up lasts 1-3 s, blinks every 0.5-2.3 s, with expression changes tied to words |
| D10 | Loudness -16.2 LUFS, a little quiet versus the -14 LUFS target | ebur128 | -14 +/- 1 LUFS integrated, true peak <= -1 dBTP |

Root cause: the run treated the job as "illustrate each paragraph with one picture". The correct job is "stage a 3D scene per beat, then film it".

## 3. Non-negotiable rules (from the repo; they override anything you prefer)

1. **Use the repo's engine**: three.js inside Remotion, composer order `ink -> lens pre -> lens main -> bloom -> NEUTRAL tone map -> grade`, MSAA 4. No AI video generators, no image generators, no flat 2D vector slides, no stock footage.
2. Start from `templates/bridge/` copied to `src/videos/<name>/`. Keep the look values in `SKILL.md` ("Final look values") unless a reference report gives a measured reason.
3. **Story, characters, voice are original.** Use `references/` for the look only. Never copy the reference channel's scripts, characters or shots; never say its name in voice-over or description. The reference videos are private study material: never upload or publish them.
4. **No captions, no labels, no logos** in the picture. English only. One steady narrator tone. Jokes are real researched facts.
5. Script: ~3.7 words/s, 55-70 s, beat formula Hook -> Setting -> Action (3-4 escalating beats) -> Snap -> deadpan double line ("Luckily... / Unluckily...") -> Explanation (one idea, one everyday analogy, "You see,") -> Consequence -> Callback twist. Facts with sources at the top of `SCRIPT.md`. The hook is the first sentence and the voice starts at frame 1-4.
6. Never describe in the picture what the viewer already sees, and never leave a sentence un-illustrated: **every sentence gets a literal picture**, and props carry the joke.
7. Everything is timed to `words.json` (word-level timings, hand-fixed). Every visual reaction lands 0-3 frames BEFORE its word.
8. Every pixel-sized post parameter scales with output height / 1920.
9. Film grain stays OFF. Never put a caption layer in.
10. Save after every step. After the script is approved by the user, "just do it": do not stop to ask routine questions.

## 4. Pipeline with gates (do not skip a gate)

| Step | Output | Gate before moving on |
|---|---|---|
| 1 Topic + facts | `SCRIPT.md` header: 5-8 sourced facts, the physical cause-and-effect, one everyday analogy | The story is VISUAL: you can name the object that moves in each beat |
| 2 Script | `SCRIPT.md` | Word count 200-260; all 8 beats present; read-aloud time 55-70 s; send to user for approval if they have not said "just do it" |
| 3 Voice | `voice.wav`, `words.json` | Word timings hand-checked on 10 random words; no gap > 0.25 s except planned |
| 4 Shot plan | `shots.md` table, then `story.ts` | See Section 6. Table must list for EVERY shot: id, frames a-b, sentence/words, location, light (day/golden), camera type+start/end, who is on screen and what each does, props, DOF value. >= 15 shots; longest <= 7 s |
| 5 World | `lights.ts shade.ts build.ts paint.ts world.ts` for the new setting | 3 stills (wide, mid, close) that already look like the reference frames: painted textures, ink, fog, sky gradient |
| 6 Characters | `toon.ts cast.ts cardshade.ts` | **Character sheet** still (Section 5) passes the checklist |
| 7 Post | `Bridge.tsx ink.ts lensblur.ts grade.ts` | Look values equal to SKILL.md or documented deviation |
| 8 Sound | `audio/` (timeline.py, sfx_gen.py, sfx.py, music.py, instruments.py, dsp.py, mix.py) re-pointed at YOUR shot timeline | `mix.wav` 48 kHz, exact video length, music +3 dB, SFX -6 dB, voice unchanged, ducked under voice, -14 LUFS |
| 9 Look checks | Stills at frames 15 / middle / last of every shot, side-by-side vs `references/frames/` using `scripts/sbs_sheet.py` | Section 8 checklist, written, per shot |
| 10 Final render | 1440x2560 h264 crf 16 (`--scale 1.3333`), mux with `-map 0:v:0 -map 1:a:0` | Section 9 gates |
| 11 Deliver | final mp4 + notes | Only after PASS |

The bridge template is bridge-specific (74 soldiers, a bridge deck, a swing, tourists). Do not leave bridge code, constants (`COUNT`, `HALF`, `SNAP`, `DROP*`, `PARK`), shot ids or sound cues in the new video. Rewrite `story.ts`, the layout in `build.ts`/`world.ts`, the crowd roles in `cast.ts`, and `audio/timeline.py` + `audio/cues.md` for the new story. Keep one source of truth for the timeline: `audio/timeline.py` must mirror `story.ts` (shots, tau, footfalls, impacts) so every sound lands on its frame.

## 5. Characters (fixes D5, D6, D9)

Use the `Pen` drawing API in `toon.ts` (600x1000 design canvas, soles at y = 975) and the measured proportions:
- Adult 3.5 head-heights tall (head 1 : torso 1.1 : legs 1.4); kid 2.85. Bean head, H/W 0.94, narrower chin, pointier crown, +/-4 degree tilt, per-character seed so no two heads match.
- Legs = ONE stroke about 0.058 head-widths; arms one stroke about 0.052; hands = ink dots about 0.055; feet short strokes about 0.16. Torso = bean, round bottom. Plum outline `#241726`, thick on the shadow/ground side, thin inside.
- No blush, no eye highlights, eyes 0.26 head-widths apart, faces brightness ~0.93, 14 expressions.
- Characters are camera-facing billboards on layer `NOINK`, lit by the scene (`cardshade.ts`, no emissive), planted feet, contact shadow ~0.5 under the feet plus a sun-direction tail by day.
- Motion: walk bob 3-7 %, lean 1-7 degrees, stride tied to speed (feet never skate), blinks every 0.5-2.3 s lasting 4 frames, gestures timed to words.

Before any shot work, render a **character sheet** (each main character: front, side, walk phase 0/0.25/0.5/0.75, 6 expressions, holding each prop they use). Pass criteria: no limb is detached; no joint bends the wrong way; hand touches the prop; head sits on the shoulders; silhouette is readable at 1/4 size. If a pose cannot be drawn correctly with a billboard (tying a shoe, hugging, sitting on a bench), **change the staging, not the quality**: use a side view, a cutaway to a prop insert with an animated hand, or a camera angle that hides the hard part. Never ship a distorted pose.

Props: a held prop is drawn with the hand on it and moves with the hand. An insert shot (watch, phone, shoes) must animate (screen changes, glow pulse, a wrist raising into frame, shoe lacing, a dust puff) and last 1-3 s.

## 6. Shot plan and camera (fixes D1, D2, D8, D9)

- 15-18 shots for 67 s. Hold range 1.5-7 s. Hard cuts only on big jumps (new place/time); 6-8 frame crossfade between places.
- Every shot has a unique camera pose. No two adjacent shots share angle or distance. Mix: wide establishing (sharp, no DOF), medium (DOF 10-12 px at 1080), close-up (DOF 12-16), insert, low-angle, aerial/top, follow shot, whip pan with blur.
- Camera: smootherstep glides of 18-40 frames, peak <= 25 px/frame at 720p; **every hold creeps in 0.15-0.35 %/frame** (0.6 %/f on punch words); rolls of 4-5 degrees; impact kicks that flip sign every frame and decay in 7 frames; foreground props in about 1/3 of shots; no hand-held float; no static hold >= 4 frames.
- Required beats of motion: at least 5 shots where characters travel through the 3D space (walk toward/away/across), at least 3 where the camera follows an object, at least 2 weather/light changes (day -> golden, or night-blue for the explanation), at least 3 impact moments with fx cards.
- The explanation beat gets its own visual language (new lighting, the analogy drawn literally).
- The last shot is a callback twist that reuses the hook's location from a NEW angle, and it ends on the last word.

## 7. World look (fixes D4)

- Lighting presets, sky gradients, fog (= horizon colour), ink widths (5.1 px near -> 3.3 px far at 1080x1920), lens-blur values per shot type, bloom and grade exactly as in SKILL.md "Final look values". Painted textures with seams painted in; muted brick/cream/ochre/terracotta; never lemon yellow or lavender lit faces.
- The sky, ground and walls are geometry with textures, not single-colour rectangles. Interiors have window light pools that tint characters. Each location has 6+ dressing props that carry the story.
- Check the "Readability traps" list in SKILL.md on every new prop (swing ropes, props < 2 m from lens, flags, signs, rim lights, rails at chest height).

## 8. Per-shot visual checklist (write it down for every shot; fix before rendering)

1. Does the camera move for the whole shot (push-in at minimum)?
2. Is something in the frame animating other than the camera (walk, blink, prop, fx, water, cloud)?
3. Is the world visibly 3D (perspective, parallax, fog, DOF where planned)?
4. Are all limbs attached; do hands touch props; do feet touch the ground with a contact shadow?
5. Is the shot different from its neighbours (angle, distance, content)?
6. Is the sentence being spoken drawn literally?
7. Any stray overlay, debug mark, text, grey-blue unreadable sign, floating prop or green ball at the frame edge?
8. Compared side by side with a reference frame: colour, ink and depth of the same quality? If not, name the gap and fix it.

## 9. Final QA (fixes everything; you may not skip it)

Run both and paste the full output into `out/<name>/QA_REPORT.md`:
```
python scripts/picture_gate.py out/<name>/final.mp4
python scripts/short_qa.py out/<name>/final.mp4 out/<name>/qa shots.json
```
`picture_gate.py` must print `RESULT: PASS`. It fails on: wrong resolution, duration outside 55-70 s, more than 8 % frozen frames, any frozen span over 0.8 s, any shot over 7 s, fewer than 8 shots/min, black/white frames, loudness outside -16..-12 LUFS, true peak above -1 dBTP. Then open the generated 2-second contact sheets from `short_qa.py` and look at EVERY one. List every defect you see (pop frames, frozen spans, clipping through geometry, cameras inside walls, props too close to the lens) and fix them. Re-render and re-run until clean.

If a gate fails you may not deliver. Report the failure honestly with the numbers and what you will change.

## 10. Environment

- Set `REMOTION_TMP` to a folder on a big drive; every bundle copies `public/` (~1.3 GB). Render with `TEMP`/`TMP` pointing there. Ask before deleting old `remotion-webpack-bundle-*` folders; delete only your own project's when finished.
- The scripts contain Windows paths (`C:/Program Files/Google/Chrome/...`). Detect the OS; take the browser path from an env var `CHROME_PATH`, and fix `D:`/`C:` assumptions.
- Stills at `--scale 0.5` for look checks, final at `--scale 1.3333`. 2K renders run about 4 fps; plan for it, render shot ranges in chunks and keep each chunk on disk.
- Python 3, numpy, PIL, ffmpeg required. Do not download code or assets from the internet except npm packages the repo already lists and CC0 kits it names (Kenney).
- Scratch `.ts` files inside `out/` break `tsc`: name them `.txt`.

## 11. What to send the user when done

1. Final mp4 path. 2. The `picture_gate.py` output. 3. The shot table (id, time, camera, what moves). 4. One line per known remaining flaw. 5. A 6-image contact sheet of the strongest and weakest shots. No marketing language.

## 12. The brief for THIS video (the user fills this in; ask only if empty)

- Topic / story idea:
- Real facts and sources the user wants included:
- Main character(s) description (age, outfit colours, personality):
- Setting(s) and time of day:
- Ending or twist the user wants:
- Length target (default 55-70 s):
