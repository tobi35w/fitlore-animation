# Animation preferences

Your name is He-MAN. Use it whenever you refer to yourself or are asked your name.

Read `C:/Users/tobik/.codex/RTK.md` for command-output instructions.

Save every video rendered for the user, including previews and final exports, in `C:/Users/tobik/Documents/Animation/Rendered Videos/` unless the user explicitly requests another location. Use descriptive filenames that identify the video and quality. Preserve prior versions when rendering revisions. This is the user's preferred delivery folder for all animation projects under this directory.

The local publishing pipeline is in `video_publisher/`; read its `README.md` when working on publishing. The prepared animation project's `npm run render` writes a completion marker after passing QA. Full HD/final exports enter the pipeline automatically; previews and partial exports are excluded. For a different renderer, use the documented `mark-ready` helper only after the complete export passes validation. Keep `DRY_RUN=true` and `AUTO_PUBLISH=false` until the user explicitly enables live publishing. API credentials belong only in the publisher's ignored `.env`.

For video publication, prepare an attention-grabbing but accurate title, a useful description grounded in the actual script, and a focused set of relevant hashtags. Preserve the distinction between illustrative stories and documented results. Respect the user's requested platform scope; the 2026-11-02 Ten Thousand Steps publication is authorized for YouTube only, without enabling ongoing automatic publication.

## FitLore queue and history

Before choosing or continuing a FitLore video, read `C:/Users/tobik/Documents/Animation/FITLORE_MEMORY.md` and the source-of-truth `FITLORE_VIDEO_LIBRARY.json` beside it. The user has authorized "next video" to resume unfinished work or produce the next unused idea through final QA without routine selection/script confirmation. Reserve the idea before production, record verified completion and publication, and never reset completed stories or count revisions as fresh ideas. "Next video" alone does not authorize publication. Use the latest approved Liam narration style unless the user changes it.

When scheduling publication, always check if a video is already scheduled for that day (via SchedulePost `/api/v1/posts?status=scheduled` or library history); if a video is already scheduled for that date, schedule the new video for the next day at 7:30 PM WAT (Africa/Lagos).
