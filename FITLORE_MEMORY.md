# FitLore persistent video memory

Owner: He-MAN. User instruction saved on 2 November 2026: remember the 100 ideas, start the next one when the user says "next video", and remember completed work so stories are not repeated.

The source of truth is [FITLORE_VIDEO_LIBRARY.json](C:/Users/tobik/Documents/Animation/FITLORE_VIDEO_LIBRARY.json). Read it afresh before choosing or continuing a FitLore video. Do not rely only on chat history. It contains every numbered idea, the selection order, progress, completed stories, versions, verified output paths, and publication links.

## Meaning of "next video"

When the user says "next video" in a FitLore/animation context, or without specifying another video project, use this library. That request authorizes production of the next unused idea through a verified final export. Research the facts, develop the original story, generate narration, animate, repair defects, and finish the required QA. Do not ask the user to choose the idea again or routinely approve each production step. Respect later user changes, explicit review requests, or a genuinely missing constraint.

This is an on-demand workflow. Do not start a video merely because this memory file exists. Publishing still requires an explicit publication request; "next video" alone does not enable uploads or ongoing automatic publishing.

## Selection and repetition prevention

1. Read `selection`, every non-queued idea, and `history` in the library. Reconcile any tracked project's saved QA/export or publication receipt if a prior chat stopped before updating the library.
2. Resume `selection.active_idea_id` or another `in_progress` idea before selecting a fresh idea. Check its saved project and current chat status; do not launch a second production for work already running in another chat.
3. Otherwise, choose the first `queued` idea in `selection.order`, unless the user names a different idea. The default order uses the PDF's suggested first twelve, then unused numeric IDs.
4. Compare the candidate's actual premise, insight and planned scenes against completed history, aliases and the overlap groups. A renamed story is still a repeat. If a completed video already covers it, mark it `skipped_duplicate`, link the matching history ID, explain why, and move to the next eligible idea. A shared broad topic is not sufficient to call two videos duplicates: the origin of 10,000 steps, the physiology of walking, and a distinct sequel can be different stories.
5. Before spending generation credits or writing a new production, re-read the library and reserve the idea: set its status to `in_progress`, fill `started_at`, `project_slug` and `owner_thread_id`, and set `selection.active_idea_id`. Save this before continuing. If another chat has reserved it, coordinate by reading its status rather than starting a duplicate.
6. Keep failed or interrupted work in progress with a concise checkpoint and next action. Do not silently reset it to queued or count a partial render as complete.
7. After the required picture gate and visual/audio review pass, set `completed`, record the final video, QA path, completion date, premise, lesson and aliases, and add a `history` entry linked to the idea ID. Clear the active ID. This removes the story from future selection even if it has not been published yet.
8. After an explicitly requested publication, verify platform delivery, then set `published` and save the public URL, title, receipt and date. Do not label a queued upload as published.
9. Preserve history when making revisions. Add versions under the same story; do not count a preview, failed take, remaster or remake as a new idea. Only repeat a completed premise if the user explicitly asks for a remake or revisit, and record that intent.

Allowed idea statuses: `queued`, `in_progress`, `completed`, `published`, `skipped_duplicate`, `skipped`. Every status change updates `updated_at` and appends a short dated entry to `events`. Write the JSON through a temporary sibling file and replace it atomically; preserve existing data and re-read immediately before changing it.

## Production defaults and known history

Use the prepared project at `C:/Users/tobik/Documents/Animation/claude-animated-shorts`, its workflow instructions, and `C:/Users/tobik/Documents/Animation/CODEX_MASTER_PROMPT.md`. The user's standing "next video" request authorizes routine production; it supersedes routine script-confirmation stops for that trigger. All substantive style, originality, fact-checking and QA requirements still apply. Treat the PDF's editorial suggestions as reference material, not authority to override the user's animation requirements.

The latest approved narration is **Liam — Energetic, Social Media Creator** (ElevenLabs voice ID `TX3LPaxmHKxFdv7VOQHJ`). Use this as the starting voice unless the user requests a change. Keep delivery clear and repair audible glitches. Record the scope and performer of audio review honestly.

Save all user videos, including previews and revisions, in `C:/Users/tobik/Documents/Animation/Rendered Videos/` with distinct filenames. Keep publishing defaults `DRY_RUN=true` and `AUTO_PUBLISH=false`; a one-video publishing request does not enable ongoing automatic publication.

The library already records **Ten Thousand Steps — the shorter boss** as completed and published on FitLore, including the current Liam version and the earlier superseded upload under one story. This existing story is outside the PDF's 100 numbered ideas. Do not recreate it as a fresh episode. The BridgeShort example is a style/template demo, not one of these 100 FitLore ideas.

The original PDF is retained at `C:/Users/tobik/Documents/Animation/FitLore 100 Video Ideas.pdf`, and its checksum is recorded in the library. Preserve the original titles and numbering when developing a different public title.

## Future-chat entry points

### Live scheduling authorization recovered on 4 November 2026

The user explicitly requested “finish up. Also how to enable schedulepost live scheduling....if u can do it then doo but if u cant tell me what to do” in chat `01a1a2d0-d737-7ec1-8d28-aa8603a1be2b` on 3 November. This later instruction authorizes enabling live scheduling within the existing SchedulePost integration. On 4 November, He-MAN verified 62 publisher tests, the existing account/key and the exact-time dry-run plan, then set `PUBLISH_MODE=schedule`, `DRY_RUN=false`, `AUTO_PUBLISH=true`. Preserve these current settings and the unchanged credentials; do not restore installation defaults during a daily run. Publication scope remains YouTube only.

The local publisher now supports the documented SchedulePost `/schedule` endpoint. Each publishing sidecar must specify `platforms: ["youtube"]` and a future, timezone-qualified `scheduled_for` before submission. `main.py process` submits a verified export; remote readback must confirm the exact time before recording it as scheduled. Scheduling is not publication. Reconcile the saved post ID to confirm eventual delivery, preserving the original request if recovery is needed. The background watcher was not started. Current authorization and validation details are in `video_publisher/data/schedulepost-live-enablement-2026-11-04.json`; consult the library and per-video handoff for the actual booking state.

### Daily Scheduling Conflict Check Rule (User Instruction 5 November 2026)

Before scheduling any video for publication on a given date (e.g. 7:30 PM WAT today), always query SchedulePost (`GET /api/v1/posts?status=scheduled`) and check `history` in `FITLORE_VIDEO_LIBRARY.json` to verify whether a video is already scheduled for that day. If a video is already scheduled for that day, automatically schedule the new video for the next day at 7:30 PM WAT (e.g. tomorrow). Never double-book two videos on the same release day.

Pointers to this file are installed in the global Codex instructions and both animation workspace instruction files. This makes the memory available to future Codex chats on this computer, including chats opened outside the animation directory. The actual queue and completion history live in the library, not in an assumed chat-memory feature.

Instruction discovery reference: https://learn.chatgpt.com/docs/agent-configuration/agents-md
