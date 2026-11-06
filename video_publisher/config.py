"""Validated configuration. Environment variables override the local .env file."""
from dataclasses import dataclass, field
from pathlib import Path
from zoneinfo import ZoneInfo
import os
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parent

@dataclass(frozen=True)
class Config:
    root: Path
    output: Path
    api_key: str = field(repr=False)
    mode: str = 'immediate'
    youtube_privacy: str = 'public'
    tiktok_privacy: str = 'PUBLIC_TO_EVERYONE'
    timezone: str = 'Africa/Lagos'
    dry_run: bool = True
    auto_publish: bool = False
    require_marker: bool = True
    stability: float = 15
    interval: float = 10
    poll_interval: float = 60
    max_attempts: int = 5
    max_bytes: int = 512 * 1024 * 1024
    max_seconds: float = 180
    youtube_id: str = ''
    tiktok_id: str = ''
    hashtags: str = '#shorts'

    @property
    def live(self): return self.auto_publish and not self.dry_run

    @property
    def data(self): return self.root / 'data'

    @classmethod
    def load(cls, root=ROOT):
        root = Path(root).resolve()
        values = {**dotenv_values(root / '.env'), **os.environ}
        def value(name, default): return values.get(name) or default
        def boolean(name, default):
            raw = value(name, str(default)).lower()
            if raw not in ('true', 'false'): raise ValueError(f'{name} must be true or false')
            return raw == 'true'
        def number(name, default, low, high):
            n = float(value(name, default))
            if not low <= n <= high: raise ValueError(f'{name} must be between {low} and {high}')
            return n
        mode = value('PUBLISH_MODE', 'immediate').lower()
        privacy = value('YOUTUBE_PRIVACY', 'public').lower()
        if mode not in ('immediate', 'queue', 'schedule'): raise ValueError('PUBLISH_MODE must be immediate, queue or schedule')
        if privacy not in ('public', 'unlisted', 'private'): raise ValueError('Invalid YOUTUBE_PRIVACY')
        if value('TIKTOK_POST_MODE', 'DIRECT_POST') != 'DIRECT_POST':
            raise ValueError('This publisher requires TIKTOK_POST_MODE=DIRECT_POST')
        timezone = value('TIMEZONE', 'Africa/Lagos')
        ZoneInfo(timezone)
        return cls(root, (root / value('VIDEO_OUTPUT_DIR', './video_output')).resolve(),
            value('SCHEDULEPOST_API_KEY', ''), mode, privacy,
            value('TIKTOK_PRIVACY', 'PUBLIC_TO_EVERYONE'), timezone,
            boolean('DRY_RUN', True), boolean('AUTO_PUBLISH', False), boolean('REQUIRE_READY_MARKER', True),
            number('STABILITY_SECONDS', 15, 1, 3600), number('SCAN_INTERVAL', 10, 1, 300),
            number('POLL_INTERVAL', 60, 15, 3600), int(number('MAX_ATTEMPTS', 5, 1, 10)),
            int(number('MAX_FILE_BYTES', 512*1024*1024, 1024, 512*1024*1024)),
            number('MAX_VIDEO_SECONDS', 180, 1, 180), value('YOUTUBE_CONNECTION_ID', ''),
            value('TIKTOK_CONNECTION_ID', ''), value('DEFAULT_HASHTAGS', '#shorts'))

    def require_live(self):
        # A .env kill switch takes effect before each external write. Enabling needs restart.
        if not self.live or not Config.load(self.root).live:
            raise ValueError('Publishing disabled: set AUTO_PUBLISH=true and DRY_RUN=false, then restart')

