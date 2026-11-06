"""Watchdog wakes one worker; periodic rescans recover missed events and restarts."""
import json
import os
from pathlib import Path
import threading
import time
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer
from notifications import notify
from publisher import TERMINAL
from video_validator import candidate, fingerprint, marker_path, file_hash

class SingleInstance:
    def __init__(self, directory): self.directory = directory
    def __enter__(self):
        self.directory.mkdir(parents=True,exist_ok=True)
        self.file = (self.directory/'publisher.lock').open('a+b')
        try:
            if os.fstat(self.file.fileno()).st_size == 0:
                self.file.write(b'0'); self.file.flush()
            self.file.seek(0)
            if os.name=='nt':
                import msvcrt
                msvcrt.locking(self.file.fileno(),msvcrt.LK_NBLCK,1)
            else:
                import fcntl
                fcntl.flock(self.file,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except OSError:
            self.file.close()
            raise ValueError('Publisher is already running. Stop it before a controlled CLI operation.') from None
        (self.directory/'publisher.pid').write_text(str(os.getpid()))
        return self
    def __exit__(self,*args):
        (self.directory/'publisher.pid').unlink(missing_ok=True)
        self.file.close()

class Changes(FileSystemEventHandler):
    def __init__(self,event): self.event=event
    def on_any_event(self,event):
        if not event.is_directory and not event.event_type in ('opened','closed_no_write'): self.event.set()

class Scanner:
    def __init__(self,config,publisher):
        self.config,self.publisher = config,publisher
        self.stable,self.done,self.hashes,self.errors = {},{},{},{}
    def scan(self):
        self.config.output.mkdir(parents=True,exist_ok=True)
        for path in self.config.output.iterdir():
            if not path.is_file() or not candidate(path): continue
            try:
                mark = marker_path(path)
                if self.config.require_marker and not mark.exists(): continue
                signature = (fingerprint(path),fingerprint(mark) if mark.exists() else None,
                    fingerprint(path.with_suffix('.json')) if path.with_suffix('.json').exists() else None)
                if self.done.get(path)==signature: continue
                previous, since = self.stable.get(path,(None,0))
                if previous!=signature:
                    self.stable[path]=(signature,time.monotonic())
                    notify(self.config,f'New or changed video detected: {path.name}; waiting for stable export')
                    continue
                if time.monotonic()-since < self.config.stability: continue
                cached = self.hashes.get(path)
                digest = cached[1] if cached and cached[0]==signature else file_hash(path)
                self.hashes[path]=(signature,digest)
                row = self.publisher.process(path,digest=digest)
                if row['publishing_status'] in TERMINAL | {'DRY_RUN','PUBLISHING','QUEUED'}:
                    self.done[path]=signature
            except (OSError,ValueError) as error:
                if self.errors.get(path)!=str(error):
                    notify(self.config,f'Waiting/review required for {path.name}: {error}','warning')
                    self.errors[path]=str(error)

def watch(config,publisher):
    config.output.mkdir(parents=True,exist_ok=True)
    event = threading.Event()
    observer = Observer()
    observer.schedule(Changes(event),str(config.output),recursive=False)
    scanner = Scanner(config,publisher)
    stop = config.data/'stop.request'
    with SingleInstance(config.data):
        stop.unlink(missing_ok=True)
        observer.start()
        notify(config,f'Watching {config.output}; mode={config.mode}; live={config.live}')
        try:
            while not stop.exists():
                scanner.scan()
                publisher.reconcile(allow_replay=True)
                event.wait(config.interval)
                event.clear()
        except KeyboardInterrupt: pass
        finally:
            observer.stop()
            observer.join(timeout=10)
            stop.unlink(missing_ok=True)
            notify(config,'Publisher stopped')

