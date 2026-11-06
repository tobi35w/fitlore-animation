# Perfect Streaks — production understanding

He-MAN · 2 November 2026 · FitLore idea 91

The existing instructions, style reports, reference images and template sources have been studied, with separate world, character and sound review roles completing the full assigned template reads. This is an original illustrative sequel about returning after a missed opportunity; it does not repeat the step-counter/family-time story.

1. Build 55–70 seconds of original action in the existing painted, inked Three.js world, at 30 fps in vertical 9:16.
2. Preserve the composer: ink, lens pre, lens main, bloom, neutral tone map, grade; MSAA 4 and grain off. Scale pixel values with output height.
3. Keep the approved Liam voice and use its actual word alignment as the source for cuts, reactions, props, captions and sound cues.
4. Stage 18 different shots, each at most seven seconds; inserts and close-ups last one to three seconds. Every frame has purposeful camera motion and independent animation.
5. Include at least five traveling-character shots, three object follows, two lighting changes and three localized impact effects.
6. Use the Pen rig with connected limbs, planted feet, per-character seeds, correct hand/prop contact, NOINK cards and contact shadows. Approve construction sheets before story stills.
7. Give each location six or more purposeful objects. Keep camera corridors clear, with no opaque object within two metres of the lens unless a checked insert intentionally frames it.
8. Clearly distinguish the fictional story from the limited research finding: Lally et al. observed that one missed opportunity did not materially affect habit formation in their study. No fabricated results or guaranteed timeline.
9. The current user request explicitly calls for clear captions; it supersedes the older no-caption rule. Use concise, word-aligned captions within Shorts safe areas, with no debug overlays or logos.
10. Render the complete story, inspect all required stills and contact sheets, run the unchanged picture gate and every-frame QA, verify the mix and obtain truthful audio review before a publishable completion. Save every MP4 in the user's Rendered Videos folder with versioned names.

Generic template machinery: `ink.ts`, `lensblur.ts`, `grade.ts`, `shade.ts`, `lights.ts`, `cardshade.ts`, `paint.ts`, the Pen API in `toon.ts`, and the renderer/composer lifecycle in `Bridge.tsx`. The approved renderer readiness and texture-resize repairs are retained. The current custom rig needs the two face helpers exported from the template drawing module.

Story-specific: the bridge timeline/physics and camera keys in `story.ts`, town/bridge geometry in `build.ts` and `world.ts`, crowd roles in `cast.ts`, and bridge counts/timing/cues in `templates/audio/`. None of those plots or constants belongs in this episode.

Implementation: create `src/videos/perfect-streaks/`; retain the generic look modules and replace staging with a courtyard, a bricklayer's workshop and a blue-lit research/analogy workbench. A single `projects/perfect-streaks/timeline.json` drives 18 shots, props and sound. A paper tracker has 30 squares, one missed square and seven later successes; a brick becomes the final paperweight. Keep SchedulePost configuration, credentials and automatic settings untouched; prepare only a YouTube handoff with a future time and duplicate check.
