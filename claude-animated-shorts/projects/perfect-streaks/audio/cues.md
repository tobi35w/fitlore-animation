# Perfect Streaks — sound cue sheet

Original score and foley synthesized locally by He-MAN with numpy/scipy and the prepared generic DSP.
The unchanged standard mixer combines these sources with Liam, ducks music, and normalizes the exact 62.7-second mix to -14 LUFS with a -1.5 dBTP ceiling.
No subjective listening is claimed here. Final listening remains a separate required review.

## Shared timing

Source: projects/perfect-streaks/timeline.json; SHA-256: 902258495a7f4cc0a79ef8a4b1032a7044c06edb4d081b9325cc224a6d3ea4ee.
30 fps; 1881 frames; 3,009,600 samples at 48 kHz. audio/timeline.py reads the source directly.

| Shot | Frames | Words / beat |
|---|---|---|
| 1 | 0–96 | Marcus missed one workout and declared the whole month a failure. |
| 2 | 97–241 | Every evening, he trained, coloured one square green, and admired his perfect calendar. |
| 3 | 242–354 | Soon, protecting the streak became more important than enjoying the routine. |
| 4 | 355–405 | Then a storm flooded the lane. |
| 5 | 406–459 | One square stayed blank. |
| 6 | 460–554 | Marcus rolled up the calendar and marched his shoes toward the bin. |
| 7 | 555–625 | Luckily, his neighbour was building a wall. |
| 8 | 626–703 | Unluckily, Marcus was about to explain bricks to a bricklayer. |
| 9 | 704–858 | He pointed at one empty space. The neighbour looked at the gap, then at all the bricks still standing. |
| 10 | 859–966 | You see, habits develop through repetition in a familiar situation. |
| 11 | 967–1106 | In one study of everyday habits, missing a single opportunity did not materially disrupt the process. |
| 12 | 1107–1237 | Think of adding bricks. Skipping one delivery doesn't make yesterday's wall disappear. |
| 13 | 1238–1326 | But abandoning the building site certainly stops it getting taller. |
| 14 | 1327–1405 | So the next evening, Marcus put his shoes beside the same doorway |
| 15 | 1406–1567 | and returned to his usual routine. No heroic double session. Just the next sensible step. |
| 16 | 1568–1712 | A week later, his calendar still had a gap. It also had seven new green squares. |
| 17 | 1713–1798 | This time, Marcus used a brick to hold the calendar flat. |
| 18 | 1799–1880 | Apparently, progress needed a paperweight more than a perfect record. |

## Mix and music

Music gain -7 dB = default -10 +3 dB; speech duck -7 dB. SFX base -15 dB = default -9 -6 dB, with documented quieter offsets.
New 96 bpm G/Em/C/D pizzicato motif with sparse bells and warm bass. Storm and deadpan beats dip; explanation uses a sparse open rhythm; the final chord lands with the paperweight.
Objective masking checks prompted additional score rides of -2.5/-3/-3.5/-5 dB in shots 1/6/15/17, plus lower paper foley in shots 6 and 17. Other sections retain their first-mix levels.
The voice is not EQ'd, replaced, sped up or otherwise edited here. Final master normalization affects the complete mix.

## Events

| Cue | Frame | Time s | Shot | Gain dB | Picture anchor |
|---|---|---|---|---|---|
| failure | 70 | 2.333 | 1 | -18 | Calendar trembles as Marcus declares failure. |
| footstep-112 | 112 | 3.733 | 2 | -19 | Agreed planted-foot contact; a restrained subset of the cast's deterministic gait. |
| footstep-127 | 127 | 4.233 | 2 | -19 | Agreed planted-foot contact; a restrained subset of the cast's deterministic gait. |
| footstep-142 | 142 | 4.733 | 2 | -19 | Agreed planted-foot contact; a restrained subset of the cast's deterministic gait. |
| green-stamp | 160 | 5.333 | 2 | -15 | Marker contacts the calendar on green. |
| rain-bed | 355 | 11.833 | 4 | -22 | Rain fades across the storm and blank-square shots, then ends. |
| thunder | 364 | 12.133 | 4 | -18 | Distant thunder follows the storm's visual arrival. |
| footstep-385 | 385 | 12.833 | 4 | -22 | Agreed planted-foot contact; a restrained subset of the cast's deterministic gait. |
| roll-calendar | 472 | 15.733 | 6 | -19 | Rolled calendar remains in the visible hand; lowered for quiet narration. |
| footstep-490 | 490 | 16.333 | 6 | -19 | Agreed planted-foot contact; a restrained subset of the cast's deterministic gait. |
| footstep-520 | 520 | 17.333 | 6 | -19 | Agreed planted-foot contact; a restrained subset of the cast's deterministic gait. |
| transition-7 | 555 | 18.500 | 7 | -22 | Quiet air movement across the six-frame location/light transition. |
| footstep-570 | 570 | 19.000 | 7 | -19 | Agreed planted-foot contact; a restrained subset of the cast's deterministic gait. |
| footstep-600 | 600 | 20.000 | 7 | -19 | Agreed planted-foot contact; a restrained subset of the cast's deterministic gait. |
| transition-10 | 859 | 28.633 | 10 | -22 | Quiet air movement across the six-frame location/light transition. |
| footstep-874 | 874 | 29.133 | 10 | -19 | Agreed planted-foot contact; a restrained subset of the cast's deterministic gait. |
| footstep-904 | 904 | 30.133 | 10 | -19 | Agreed planted-foot contact; a restrained subset of the cast's deterministic gait. |
| brick-land | 1123 | 37.433 | 12 | -15 | Brick makes physical contact at frame 1123. |
| footstep-1253 | 1253 | 41.767 | 13 | -19 | Agreed planted-foot contact; a restrained subset of the cast's deterministic gait. |
| footstep-1283 | 1283 | 42.767 | 13 | -19 | Agreed planted-foot contact; a restrained subset of the cast's deterministic gait. |
| transition-14 | 1327 | 44.233 | 14 | -22 | Quiet air movement across the six-frame location/light transition. |
| shoes-set | 1376 | 45.867 | 14 | -15 | Trainers touch the mat at frame 1376. |
| footstep-1441 | 1441 | 48.033 | 15 | -19 | Agreed planted-foot contact; a restrained subset of the cast's deterministic gait. |
| footstep-1474 | 1474 | 49.133 | 15 | -19 | Agreed planted-foot contact; a restrained subset of the cast's deterministic gait. |
| footstep-1540 | 1540 | 51.333 | 15 | -19 | Agreed planted-foot contact; a restrained subset of the cast's deterministic gait. |
| footstep-1583 | 1583 | 52.767 | 16 | -19 | Agreed planted-foot contact; a restrained subset of the cast's deterministic gait. |
| footstep-1613 | 1613 | 53.767 | 16 | -19 | Agreed planted-foot contact; a restrained subset of the cast's deterministic gait. |
| seven-green | 1657 | 55.233 | 16 | -17 | Restrained marker accent starts the seven later green squares. |
| transition-17 | 1713 | 57.100 | 17 | -22 | Quiet air movement across the six-frame location/light transition. |
| calendar-flat | 1768 | 58.933 | 17 | -22 | Paper unrolls across the table; lowered for the quiet final word. |
| paperweight | 1830 | 61.000 | 18 | -15 | Brick contacts the calendar at frame 1830. |

Footsteps use the agreed cast contacts: ordinary side-walk contacts every 15 frames relative to the shot start, with shot 2 ending at local frame 45. Shot 15 uses round(a+2+16.5*n), including frame 1540.
