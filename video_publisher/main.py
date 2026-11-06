"""Local command line entry point. No command enables live publication implicitly."""
import argparse
from dataclasses import replace
import json
from pathlib import Path
import sys
from config import Config, ROOT
from database import Database
from notifications import setup, notify, redact
from publisher import Publisher
from schedulepost_client import SchedulePostClient, APIError
from video_validator import mark_ready, wait_stable
from watcher import SingleInstance, Scanner, watch


def summary(row):
    return {key:row[key] for key in ('id','filename','publishing_status','youtube_status','tiktok_status','error_message')}


def main(argv=None):
    parser = argparse.ArgumentParser(description='BLUR local video publisher')
    parser.add_argument('--root', type=Path, default=ROOT, help='Configuration/state directory (default: this project)')
    commands = parser.add_subparsers(dest='command', required=True)
    verify = commands.add_parser('verify', help='Check authentication, selected accounts and confirmed privacy')
    verify.add_argument('--upload-target-test', action='store_true', help='Also request an upload target; sends no video bytes or posts')
    for name in ('dry-run','process','mark-ready'):
        sub = commands.add_parser(name)
        sub.add_argument('video', type=Path)
        if name=='mark-ready': sub.add_argument('--publish', action='store_true', help='Permit this completed video to enter the pipeline')
    for name in ('watch','status','stop','scan'): commands.add_parser(name)
    reconcile = commands.add_parser('reconcile', help='Read pending outcomes; optionally replay a frozen request')
    reconcile.add_argument('--replay',action='store_true')
    retry = commands.add_parser('retry')
    retry.add_argument('id',type=int)
    retry.add_argument('--failed-only',action='store_true')
    args = parser.parse_args(argv)
    root = args.root.resolve()
    setup(root)
    db = None
    try:
        config = Config.load(root)
        config.data.mkdir(parents=True, exist_ok=True)
        if args.command=='dry-run': config = replace(config,dry_run=True,auto_publish=False)
        if args.command=='stop':
            (config.data/'stop.request').touch()
            notify(config,'Stop requested; the worker exits after the current bounded operation')
            return 0
        db = Database(config.data/'publisher.db')
        client = SchedulePostClient(config.api_key)
        publisher = Publisher(config,db,client)
        if args.command=='status':
            pid = config.data/'publisher.pid'
            result = {'live_config':config.live,'mode':config.mode,'output':str(config.output),
                'recorded_pid':pid.read_text().strip() if pid.exists() else None,
                'videos':[summary(r) for r in db.all('SELECT * FROM published_videos ORDER BY id DESC LIMIT 50')]}
        elif args.command=='mark-ready':
            info = mark_ready(args.video,config,publish=args.publish)
            result = {'filename':info['filename'],'complete':True,'publish':info['publish']}
        elif args.command=='watch':
            watch(config,publisher)
            return 0
        else:
            with SingleInstance(config.data):
                if args.command=='verify': result = publisher.verify(args.upload_target_test)
                elif args.command in ('process','dry-run'):
                    wait_stable(args.video, config.stability)
                    result = summary(publisher.process(args.video,dry_run=args.command=='dry-run'))
                elif args.command=='mark-ready':
                    info = mark_ready(args.video,config,publish=args.publish)
                    result = {'filename':info['filename'],'complete':True,'publish':info['publish']}
                elif args.command=='retry':
                    publisher.retry(args.id,failed_only=args.failed_only)
                    result = summary(db.video(args.id))
                elif args.command=='reconcile':
                    publisher.reconcile(allow_replay=args.replay)
                    result = {'videos':[summary(r) for r in db.all('SELECT * FROM published_videos ORDER BY id DESC LIMIT 50')]}
                elif args.command=='scan':
                    import time
                    scanner = Scanner(config,publisher)
                    scanner.scan()
                    time.sleep(config.stability)
                    scanner.scan()
                    publisher.reconcile(allow_replay=True)
                    result = {'videos':[summary(r) for r in db.all('SELECT * FROM published_videos ORDER BY id DESC LIMIT 50')]}
        if sys.stdout is not None: print(redact(json.dumps(result,indent=2,ensure_ascii=True)))
        return 1 if result.get('publishing_status') in ('FAILED','NEEDS_REVIEW','PARTIAL_SUCCESS') else 0
    except (APIError,ValueError,OSError) as error:
        import logging
        logging.getLogger('blur').error(str(error))
        return 1
    except KeyboardInterrupt:
        return 130
    except Exception as error:
        import logging
        logging.getLogger('blur').error('Unexpected %s: %s',type(error).__name__,redact(error))
        return 1
    finally:
        if db: db.close()


if __name__=='__main__': raise SystemExit(main())
