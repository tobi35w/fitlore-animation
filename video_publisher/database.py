"""Durable content deduplication and frozen, replayable publication intents."""
import json
import sqlite3
import time
from pathlib import Path
from notifications import redact

class Database:
    def __init__(self, file):
        Path(file).parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(file, timeout=30)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute('PRAGMA journal_mode=WAL')
        self.conn.execute('PRAGMA synchronous=FULL')
        self.conn.execute('PRAGMA foreign_keys=ON')
        self.conn.executescript('''
        CREATE TABLE IF NOT EXISTS published_videos (
          id INTEGER PRIMARY KEY, filename TEXT NOT NULL, path TEXT NOT NULL,
          file_hash TEXT NOT NULL UNIQUE, caption TEXT, youtube_title TEXT,
          metadata_json TEXT, schedulepost_id TEXT, upload_url TEXT,
          publishing_status TEXT NOT NULL DEFAULT 'DETECTED',
          youtube_status TEXT NOT NULL DEFAULT 'PENDING', tiktok_status TEXT NOT NULL DEFAULT 'PENDING',
          created_at REAL NOT NULL, published_at REAL, error_message TEXT,
          attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at REAL NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS operations (
          id INTEGER PRIMARY KEY, video_id INTEGER NOT NULL REFERENCES published_videos(id),
          kind TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE, request_json TEXT NOT NULL,
          post_id TEXT, status TEXT NOT NULL DEFAULT 'SUBMITTING', attempts INTEGER NOT NULL DEFAULT 0,
          next_attempt_at REAL NOT NULL DEFAULT 0, error_message TEXT, created_at REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS deliveries (
          video_id INTEGER NOT NULL REFERENCES published_videos(id), connection_id TEXT NOT NULL,
          platform TEXT NOT NULL, status TEXT NOT NULL, platform_post_id TEXT,
          error_message TEXT, retryable INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY(video_id, connection_id));
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        ''')
        if 'refresh_failures' not in {r[1] for r in self.conn.execute('PRAGMA table_info(operations)')}:
            self.conn.execute('ALTER TABLE operations ADD COLUMN refresh_failures INTEGER NOT NULL DEFAULT 0')
        self.conn.commit()

    def close(self): self.conn.close()
    def one(self, sql, args=()):
        row = self.conn.execute(sql, args).fetchone()
        return dict(row) if row else None
    def all(self, sql, args=()): return [dict(r) for r in self.conn.execute(sql, args)]
    def get(self, digest): return self.one('SELECT * FROM published_videos WHERE file_hash=?', (digest,))
    def video(self, video_id): return self.one('SELECT * FROM published_videos WHERE id=?', (video_id,))
    def add(self, path, digest):
        with self.conn:
            self.conn.execute('INSERT OR IGNORE INTO published_videos(filename,path,file_hash,created_at) VALUES(?,?,?,?)',
                (path.name, str(path), digest, time.time()))
        return self.get(digest)
    def update(self, video_id, **fields):
        allowed = {'caption','youtube_title','metadata_json','schedulepost_id','upload_url','publishing_status',
            'youtube_status','tiktok_status','published_at','error_message','attempts','next_attempt_at'}
        if not fields.keys() <= allowed: raise ValueError('Invalid database update')
        if fields.get('error_message'): fields['error_message'] = redact(fields['error_message'])[:2000]
        with self.conn:
            self.conn.execute('UPDATE published_videos SET '+','.join(k+'=?' for k in fields)+' WHERE id=?', (*fields.values(), video_id))
    def operations(self, video_id): return self.all('SELECT * FROM operations WHERE video_id=? ORDER BY id', (video_id,))
    def create_operation(self, video_id, kind, key, payload):
        serialized = json.dumps(payload, sort_keys=True, separators=(',', ':'))
        with self.conn:
            self.conn.execute('INSERT OR IGNORE INTO operations(video_id,kind,idempotency_key,request_json,created_at) VALUES(?,?,?,?,?)',
                (video_id,kind,key,serialized,time.time()))
        op = self.one('SELECT * FROM operations WHERE idempotency_key=?', (key,))
        if op['request_json'] != serialized: raise ValueError('Idempotency conflict: frozen intent differs')
        return op
    def operation_update(self, op_id, **fields):
        if not fields.keys() <= {'post_id','status','attempts','next_attempt_at','error_message','refresh_failures'}: raise ValueError('Invalid operation update')
        if fields.get('error_message'): fields['error_message'] = redact(fields['error_message'])[:2000]
        with self.conn:
            self.conn.execute('UPDATE operations SET '+','.join(k+'=?' for k in fields)+' WHERE id=?', (*fields.values(),op_id))
    def set_delivery(self, video_id, connection_id, platform, status, post_id=None, error=None, retryable=False):
        if platform not in ('youtube','tiktok'): raise ValueError('Unexpected platform')
        with self.conn:
            self.conn.execute('''INSERT INTO deliveries VALUES(?,?,?,?,?,?,?) ON CONFLICT(video_id,connection_id)
              DO UPDATE SET status=excluded.status,platform_post_id=excluded.platform_post_id,
              error_message=excluded.error_message,retryable=excluded.retryable WHERE deliveries.status!='PUBLISHED' ''',
              (video_id,connection_id,platform,status,post_id,redact(error)[:2000] if error else None,int(retryable)))
    def deliveries(self, video_id): return self.all('SELECT * FROM deliveries WHERE video_id=?', (video_id,))
    def setting(self, key, value=None):
        if value is not None:
            with self.conn: self.conn.execute('INSERT OR REPLACE INTO settings VALUES(?,?)', (key,json.dumps(value)))
        row = self.one('SELECT value FROM settings WHERE key=?', (key,))
        return json.loads(row['value']) if row else None

