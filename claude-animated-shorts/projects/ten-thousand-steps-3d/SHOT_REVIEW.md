# Ten Thousand Steps — shot review

He-MAN, 2 November 2026. Reviewed 54 stills in `out/ten-thousand-steps-3d/shot-check-v4`, plus the revised ending frames for shots 10 and 17 in `shot-check-v5`. This is the pre-export visual review; moving-frame QA is recorded separately for each actual MP4.

All shots use the copied Three.js world/post engine. The inspected images show painted perspective geometry, ink, scene light and contact shadows. The code drives the camera and actors from the current frame. These stills cannot establish temporal smoothness by themselves.

Checklist keys: C = camera moves throughout; A = independent character/prop animation; D = visible depth; R = connected rig and supported props; U = distinct neighboring composition; S = spoken sentence illustrated; O = no unintended overlays/text; L = comparison with the reference look. C/A are provisional until the exported motion check.

| Shot | C / A | D / R | U / S / O | Look comparison and specific observations |
|---|---|---|---|---|
| 1 | Tracking/push; walk, wrist and face | Perspective paving and facade; feet/arms connected | Pass | Bean silhouette and planted stride read clearly. Original costume and skin color differ intentionally from references. |
| 2 | Aerial drift/push; two walkers | Car, curb, roofs and hills separate in depth | Pass | Wider establishing image; sharp scene is intentional. |
| 3 | Low lateral move/push; stride | Near curb against receding facade; hands and feet supported | Pass | Lower viewpoint differs from shot 2. |
| 4 | Lateral push; walker and fading steam | Bowl/table foreground and walker behind | Pass | Earlier bowl obstruction corrected. Strong warm key/blue shade uses the template golden values. |
| 5 | Push; blink, breath and head shift | Doorstep perspective; hand touches backpack handle | Pass | Expression changes show waiting; no detached backpack. |
| 6 | Oblique tracking/push; approach and turn | Porch depth; both characters grounded | Pass | Marcus deliberately exits left for another lap. Motion at the turn requires export review. |
| 7 | Wrist follow/push; ring fills and expression changes | Shallow depth with complete arm attached | Pass | Face cropping is intentional in this wrist insert; ring remains clear. Local impact sprite only. |
| 8 | Bowl follow/push; carrying walk and door swing | Interior perspective, shelf and door depth | Pass | Fridge door is moved out of the hand/bowl sightline. Bowl is carried by a visible connected hand. |
| 9 | Low follow rising to medium; three walkers | Foreground paving, plants and facades | Pass | Push-offs and ordinary movement illustrate activity; no individual medical transformation. |
| 10 | Wide lateral follow; three distinct walkers | Physical desk and magnifier before walking cohort | Pass | Blue explanation palette. Revised camera keeps the walkers in view at the end; foreground desk leaves the shot naturally. |
| 11 | Three-quarter push; wrist lowers, hand and face change | Lit interior, table and floor shadows | Pass | Modest reaction accompanies the research limitation. Table occludes part of the arm naturally; no detached limb. |
| 12 | Coin follow; hand releases and coin falls | 3D transparent jar, rim and falling coin | Pass | Reframed jar stays inside picture. Sparse glass highlights preserve the view of the coin. |
| 13 | Top-down push; coins fall/tumble/settle | Jar rim and base show perspective | Pass | No magic transformation; accumulated coins remain visible. |
| 14 | Side follow; walk and carried bag | Painted street layers | Pass | Hand meets the bag handle. Warm return to story lighting. |
| 15 | Wide side follow; father/daughter walk | School forecourt, path, gateway and bell | Pass | Backpack stays connected by straps; both walkers readable. |
| 16 | High diagonal follow; family and neighbor travel | Curb, porch, shadows and near mailbox | Pass | Distinct longer/shorter routes; no labels or graphical route overlays. |
| 17 | Medium push; wrist rises, daughter blinks | Same doorstep from a new direction | Pass | Revised wider framing keeps daughter's full silhouette inside the frame. |
| 18 | Two-person follow; hands meet and pair advances | Angled street and callback doorstep | Pass | Shared world-space hand anchor prevents drift; both remain inside frame through 1893. |

Reference comparison: `style-study-v3.jpg` documents day, golden and interior comparisons. The project shares inked geometry, flat bean characters, painted surfaces, window light and lens blur. Buildings and props have simpler silhouettes than the supplied study footage; there are no reference images embedded in the output. Golden scenes intentionally retain the specified template preset rather than being graded to the unrelated reference frame's time of day.

Outstanding verification at the time of this file: inspect every exported contact sheet, investigate any frame-difference spikes, run the unchanged picture gate, verify the encoded audio and final dimensions. No final PASS is claimed here.


## Final export review — 2 November 2026

He-MAN inspected all 32 final-export contact sheets, covering every frame from 0 through 1893, and the six-image full-size comparison. Continuous camera and independent actor/prop movement are confirmed by the sequence images and every-frame diagnostics. No unresolved texture fragments, unintended pops, detached limbs, black/white frames or camera clipping were found. Intentional upper-face cropping in the wrist insert, colored coin shadows, and six-frame scene crossfades are retained.

The user requested repair of audible glitches and a social-media narration style, then explicitly approved the revised Liam soundtrack: “Use this revised soundtrack.” The new narration preserves all 222 approved words. Conservative click repair, pitch-preserving phrase fitting and short silence-boundary fades are documented in audio/fit_social_voice.py. The previous George narration and mix are preserved in versions/george-v2. Ten word contexts were checked against waveforms; speech alignment remains an estimate from the provider plus the documented fit.

The encoded AAC matches the approved PCM mix with correlation 0.999708 and 32.31 dB signal-to-error ratio. Encoded loudness is -14.6 LUFS by the required checker; high-precision true peak is -1.01 dBTP. The listening review was the user's; He-MAN performed the technical and visual review.

The dinner bowl is small in the wide shot, and the coin-jar set uses simple geometry. These are the weaker compositions shown in the six-image review. No unresolved delivery defect was identified. The final remains a local export with publish=false.
