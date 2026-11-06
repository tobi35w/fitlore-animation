# BLUR Video Publisher

This local Python service watches `C:\Users\tobik\Documents\Animation\Rendered Videos`, validates completed exports, prepares metadata, and sends them to SchedulePost for YouTube Shorts and TikTok. SQLite remembers file hashes, upload results, publishing requests and each platform's outcome across restarts.

The delivered configuration is **DRY_RUN=true / AUTO_PUBLISH=false**. No real publication is part of installation or automated tests. Account lookup has verified YouTube **FitLore** and TikTok **Ibit**, and their explicit connection IDs are configured. The user confirmed that Public is available for Ibit. The replacement key successfully passed authentication, account retrieval and the actual upload-target generation test. No video bytes were uploaded. See `data/verification-report.json` for the local verification record.

## Setup and verification

FitLore's local configuration was enabled for exact-time live scheduling on 4 November 2026 after the user's explicit request: `PUBLISH_MODE=schedule`, `DRY_RUN=false`, `AUTO_PUBLISH=true`. Credentials and connection IDs are unchanged. FitLore video metadata targets `"platforms": ["youtube"]`. The background watcher is stopped; the existing daily production workflow can submit each verified video with `main.py process`. The installation defaults in `.env.example` remain dry run.

Use PowerShell in this directory:

```powershell
Set-Location 'C:\Users\tobik\Documents\Animation\video_publisher'
.\setup.ps1
.\.venv\Scripts\python.exe main.py verify --upload-target-test
```

Requirements: Windows 11, Python 3.10+, FFmpeg and FFprobe on PATH, and SchedulePost accounts connected to YouTube and TikTok. The prepared computer already has Python, FFmpeg and the virtual environment. Dependencies are pinned in `requirements.txt`: Watchdog, requests, python-dotenv and tzdata. No cloud worker, paid database, or automation subscription is added. SchedulePost's service, platform limits and future pricing remain outside this local program's control.

Put the credential in `.env` as `SCHEDULEPOST_API_KEY=...`. SchedulePost's current docs say new keys default to read-only; select **posts:write** for upload/publish/queue access (write includes post read access). Expired or revoked keys return 401. Missing permissions return 403. The setup script preserves an existing `.env`; `.env`, data, logs and the venv are ignored by Git. Process environment variables override `.env`.

`verify --upload-target-test` retrieves the selected accounts and requests an upload target with a small declared byte count. It **does not upload bytes or create a post**. A successful run binds live verification to the key fingerprint and both selected connection IDs; replacement credentials or connections require verification again. A failed verification clears the prior approval record. Never paste credentials or returned signed URLs into source files or logs.

TikTok's documented REST API does not provide an account-specific privacy-options lookup. This project validates `TIKTOK_PRIVACY` against the explicit account confirmation in `data/tiktok-privacy.json`. If Ibit's availability changes or another TikTok connection is selected, confirm its options in SchedulePost and update that JSON with the matching `connection_id`, `allowed_options`, source and verification date. The initial allowed option is `PUBLIC_TO_EVERYONE`. This is a recorded user confirmation, not an invented API lookup.

## Normal video workflow

Continue creating videos in `..\claude-animated-shorts`. Before rendering, optionally create `projects/<slug>/publishing.json`:

```json
{
  "caption": "Your caption here.",
  "hashtags": "#shorts #fitness",
  "youtube_title": "Your title",
  "youtube_description": "Your description.",
  "publish": true
}
```

The existing `npm run render -- CompositionId --quality final` command renders the video, runs QA, and writes an atomic `<video>.mp4.ready.json` marker containing the exact filename, size and SHA-256. A full `hd` or `final` export is publishable; drafts, explicit frame ranges and technical checks are not. QA failure leaves no ready marker. Re-rendering removes the old marker before changing the export. Prepare metadata before completion so the watcher sees the intended caption.

The renderer copies the optional project template to `<video-stem>.json` beside the export if no such file already exists. Existing user metadata is preserved. `<video>.mp4.json` remains renderer metadata and is never interpreted as publishing metadata. Without publishing metadata, the filename supplies a neutral caption/title and `#shorts` supplies the default hashtag; no facts are invented. `publish:false` in either the ready marker or publishing metadata skips the video. Correcting a previously SKIPPED/FAILED entry requires `retry <id>` so an intentional exclusion cannot silently turn into a publication.

The watcher scans the configured folder (not subfolders), requires the marker by default, waits for 15 seconds of unchanged file/marker/metadata, verifies the hash, copies a stable snapshot, probes and fully decodes it. Videos must be portrait or square, 0.5–180 seconds and at most 512 MB. MP4/H.264/yuv420p/AAC inputs are preserved; MOV, WEBM and incompatible codecs/pixel formats/rotation are normalized to an H.264/AAC MP4. The upload snapshot is stored under `data/spool`. A SHA-256 duplicate is tracked once even under a renamed filename. Keep the SQLite database when moving or reinstalling the service.

Exports from another application can use the explicit completion helper **after export finishes**:

```powershell
.\.venv\Scripts\python.exe main.py mark-ready '..\Rendered Videos\example-final.mp4' --publish
```

Omit `--publish` to mark a test/preview non-publishable. This command runs stability, probe and full-decode checks and can run while the watcher is active. `REQUIRE_READY_MARKER=false` supports outside workflows using stability-only detection, but cannot establish completion as reliably as the marker integration. Leave it true for this animation workspace. Existing BridgeShort and TenThousandSteps exports are not automatically marked ready by setup.

## Start, stop and inspect

To restrict an individual export to one platform, add `"platforms": ["youtube"]` or `"platforms": ["tiktok"]` to its publishing metadata. The default is both. Only those connection IDs and platform-specific settings are sent; an excluded platform is recorded as NOT_SELECTED. A completed single-platform operation counts as PUBLISHED for its selected target. The content hash still prevents automatically reposting an already published video when metadata changes.

```powershell
.\start.ps1
.\.venv\Scripts\python.exe main.py status
Get-Content .\logs\publisher.log -Tail 30 -Wait
.\stop.ps1
```

The start script launches hidden `pythonw.exe`; a process lock prevents multiple workers. `status` prints the configured mode, recorded PID and latest 50 videos. A PID file is informational and can be stale after a crash; check the process and log if uncertain. Stop requests finish the current bounded operation and then exit. A stop cannot undo a post already accepted by SchedulePost. Wait for the stopped message/PID removal before restarting. Use `main.py watch` for a foreground terminal instead. Terminal notifications are also written to rotating logs and `data/notifications.jsonl`; no email, webhook, chat, or Windows toast service is configured.

For optional startup at this Windows user's logon:

```powershell
.\setup.ps1 -RegisterAtLogon
```

This creates **BLUR Video Publisher** in Windows Task Scheduler using the current user, limited privileges and hidden pythonw. It runs while logged in, allows battery operation, avoids duplicate instances and restarts up to three times on failure. An existing task is not overwritten. Registration is optional and is not performed by ordinary setup. To disable startup, disable that task in Task Scheduler. The laptop must be on and the worker running for detection; files completed while offline are found by the next scan. SchedulePost can finish posts already queued after the laptop stops.

## Dry run and a controlled first publication

While stopped, test any existing video without creating a ready marker:

```powershell
.\.venv\Scripts\python.exe main.py dry-run '..\Rendered Videos\TenThousandSteps-final.mp4'
```

This command forces dry run regardless of `.env`, validates the video, checks connections and writes `data/dry-run-<id>.json`. It sends no upload, publish or queue request. The second identical dry run reuses its database entry. `main.py scan` performs a one-shot stability scan of ready files; it obeys the configured live/dry-run settings. Other state-changing CLI commands require the watcher to be stopped.

When you explicitly choose to enable publishing, perform the first real test with the watcher stopped:

1. Configure a key with `posts:write`; run `verify --upload-target-test` successfully. Review the exact accounts and TikTok privacy confirmation.
2. Choose one finished video, review its `<stem>.json`, and run `mark-ready <full-video-path> --publish`. Run `dry-run <full-video-path>` and review the saved plan first.
3. Edit `.env` to set `AUTO_PUBLISH=true` and `DRY_RUN=false`. Leave `PUBLISH_MODE=immediate` for immediate delivery. The default YouTube privacy is public and TikTok mode is DIRECT_POST.
4. Run `main.py process <full-video-path>` to submit only that video. This is the first command in this checklist that can upload and publish it. Read `main.py status`; if pending, run `main.py reconcile` after the poll interval until confirmed. Check the actual platform posts as well.
5. Once satisfied, start the background watcher. On startup, every unprocessed publishable ready file in the folder is eligible, including prior DRY_RUN entries; review/remove unwanted ready markers or set their metadata to `publish:false` first.

To disable new external writes, set `AUTO_PUBLISH=false` or `DRY_RUN=true` and stop/restart the worker. The write guard reloads these flags before external write attempts. Enabling needs a restart because startup configuration is retained. If you deliberately set these flags as process environment variables, those override edits to `.env`. Already accepted posts require provider-side management. A pending request whose response was lost retains its frozen content and idempotency key; changing metadata does not rewrite that remote intent.

## Modes, results and recovery

`PUBLISH_MODE=immediate` uses `/publish`. `PUBLISH_MODE=queue` uses `/queue` with one post per day, all days allowed and the configured timezone (`Africa/Lagos`). Queue acceptance is **QUEUED**, not publication. Only saved per-platform outcomes from `GET /posts/:id` plus `delivery_complete=true` can establish full success.

`PUBLISH_MODE=schedule` uses the documented `/schedule` endpoint for an exact time. Add `"scheduled_for": "2026-11-04T19:30:00+01:00"` to the video's publishing metadata, replacing this example with the chosen future date. Keep `"platforms": ["youtube"]` for FitLore. The timestamp must include an explicit timezone; the publisher converts it to UTC and rejects missing, ambiguous or expired times before uploading. Select schedule mode before running `dry-run` so its saved plan includes the intended time. Live submission still requires `AUTO_PUBLISH=true` and `DRY_RUN=false`.

After schedule acceptance, the publisher reads the post back and verifies that `scheduled_for` matches the frozen request. A confirmed booking remains **QUEUED** locally until platform delivery is verified. The verified timestamp is retained in the database; a different remote time requires review. Retries preserve the original timestamp, targets and idempotency key, so an interrupted request cannot silently become another post. To check delivery later, run `main.py reconcile`.

SQLite tracks DETECTED, VALIDATING, UPLOADING, UPLOADED, RETRY_PENDING, DRY_RUN, SKIPPED, PUBLISHING, QUEUED, PUBLISHED, PARTIAL_SUCCESS, FAILED and NEEDS_REVIEW. Per-platform PUBLISHED results are preserved even if a later response regresses. Read errors and ambiguous writes are visible in logs; repeated failures stop at a bounded retry limit. A 401/403 is not endlessly retried. Pending, healthy provider outcomes are periodically checked until completion.

```powershell
.\.venv\Scripts\python.exe main.py reconcile
.\.venv\Scripts\python.exe main.py reconcile --replay
.\.venv\Scripts\python.exe main.py retry 3
.\.venv\Scripts\python.exe main.py retry 3 --failed-only
```

Plain `reconcile` only reads due outcomes. `--replay` may resend an unresolved frozen request when live is explicitly enabled, using its original idempotency key and exact payload. `retry <id>` resumes the same unresolved/rejected request, or retries a pre-submission failure after correction. It never blindly republishes both channels after a partial result. `--failed-only` creates an immediate recovery request targeting only server-confirmed retryable failures with no platform post ID; successful connections are excluded. Unknown outcomes, a possible existing platform post ID, or non-retryable delivery failures require checking SchedulePost before a new attempt. Do not delete history or change idempotency keys to force a retry.

The SQLite `upload_url` field holds only the public media URL, never the signed PUT URL. Frozen payloads contain that public media URL and user metadata. Logs redact credentials and URLs. Back up `.env` and `data/publisher.db` privately; a lost database removes the local guarantee against duplicate requests. A network failure after media upload but before its URL is recorded may leave an unused uploaded object, but cannot create a publication by itself.

## API contract and tests

Official reference: https://schedulepost.fulinlabs.com/api-docs

The documented JSON presign endpoint is now **POST `/api/v2/upload`**, using `filename`, `contentType` and exact `contentLength`; the former v1 JSON upload endpoint returns 426. The file is PUT to the signed R2 URL with matching Content-Type and Content-Length, without sending the SchedulePost API key to storage. Connections, publication, queue and outcome reads use `/api/v1`. Publish/queue use `Idempotency-Key`; uncertain responses keep the same frozen intent. HTTPS, response size, identifiers and outcome schemas are validated. No undocumented creator-info or retry endpoint is used.

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
Set-Location '..\claude-animated-shorts'
node --test scripts/publish-ready.test.mjs
npm run check
```

Tests use fake network clients and temporary local videos. They cover auth/permission errors, exact upload contract, upload credential separation, retries, frozen intents after restart, partial success, queue/pending states, kill switches, metadata limits, SQLite persistence, hash duplicates, locks, stability, completion markers and actual FFmpeg validation/conversion. They never publish a real video. Actual account lookup and presign verification are separate explicit integration checks; a passing mock suite does not prove live platform delivery.

## Files

`main.py` supplies commands; `watcher.py` handles events/stability/locking; `video_validator.py` verifies and snapshots video; `metadata.py` generates or reads metadata; `schedulepost_client.py` implements the documented API; `publisher.py` manages durable recovery; `database.py` stores history; `notifications.py` supplies sanitized terminal/file notifications. `data/spool` can retain snapshots for incomplete/failed jobs; successful and dry-run snapshots are removed. Do not remove pending operation state while recovering delivery.
