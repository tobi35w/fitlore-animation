"""Publishing state machine. Remote acceptance is never labelled delivery success."""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
import time
import uuid
from metadata import load_metadata, normalize_scheduled_for
from notifications import notify
from schedulepost_client import APIError
from video_validator import file_hash, marker, stage

TERMINAL = {'PUBLISHED','PARTIAL_SUCCESS','FAILED','SKIPPED','NEEDS_REVIEW'}
ACTIVE_OPERATIONS = {'SUBMITTING','UNKNOWN','PUBLISHING','QUEUED'}

def privacy_options(config, connection_id):
    file = config.data / 'tiktok-privacy.json'
    if not file.exists(): raise ValueError('TikTok privacy unverified: record Ibit/account creator privacy options before publishing')
    data = json.loads(file.read_text(encoding='utf-8'))
    options = data.get('allowed_options')
    if data.get('connection_id') != connection_id or not isinstance(options,list) or not all(isinstance(v,str) for v in options):
        raise ValueError('TikTok privacy confirmation does not match the selected connection')
    if config.tiktok_privacy not in options: raise ValueError('Configured TikTok privacy is not in the confirmed account options')
    return data

def future_schedule(metadata):
    if 'scheduled_for' not in metadata:
        raise ValueError('Schedule mode requires scheduled_for in the video publishing metadata')
    value = normalize_scheduled_for(metadata['scheduled_for'])
    if datetime.fromisoformat(value.replace('Z', '+00:00')) <= datetime.now(timezone.utc):
        raise ValueError('scheduled_for must be in the future before starting a new submission')
    return value


def payload_for(config, metadata, url, connections):
    platforms = metadata.get('platforms', ['youtube','tiktok'])
    payload = {'mediaItems':[{'url':url,'mediaType':'VIDEO'}], 'caption':metadata['caption'],
        'hashtags':metadata['hashtags'],'connectionIds':[connections[p]['id'] for p in platforms]}
    if 'youtube' in platforms:
        payload.update(youtubeTitle=metadata['youtube_title'],youtubeDescription=metadata['youtube_description'],
            youtubePrivacy=config.youtube_privacy)
    if 'tiktok' in platforms:
        payload.update(tiktokPostMode='DIRECT_POST',tiktokPrivacy=config.tiktok_privacy)
    if config.mode=='queue': payload['settings'] = {'postsPerDay':1,'allowedDays':list(range(7)),'timezone':config.timezone}
    if config.mode=='schedule': payload['scheduledFor'] = future_schedule(metadata)
    return payload

class Publisher:
    def __init__(self, config, database, client):
        self.config,self.db,self.client = config,database,client
        self.client.write_guard = config.require_live

    def verify(self, upload_test=False):
        if upload_test:
            self.db.setting('verified_key', '')
            self.db.setting('verified_connections', {})
        accounts = self.client.select_connections(self.config)
        self.db.setting('connections', accounts)
        privacy = privacy_options(self.config,accounts['tiktok']['id'])
        if upload_test:
            # Allocate a signed target only. No file bytes, publish, or queue requests are sent.
            self.client.presign('blur-upload-contract-test.mp4','video/mp4',1024)
            self.db.setting('verified_key',hashlib.sha256(self.config.api_key.encode()).hexdigest())
            self.db.setting('verified_connections',{p:a['id'] for p,a in accounts.items()})
        return {'accounts':accounts,'privacy_options':privacy['allowed_options'],'upload_contract_verified':upload_test}

    def preflight(self, live=False):
        accounts = self.client.select_connections(self.config)
        self.db.setting('connections',accounts)
        privacy_options(self.config,accounts['tiktok']['id'])
        if live:
            self.config.require_live()
            if self.db.setting('verified_key') != hashlib.sha256(self.config.api_key.encode()).hexdigest():
                raise ValueError('Run verify --upload-target-test for the current API key before live publication')
            if self.db.setting('verified_connections') != {p:a['id'] for p,a in accounts.items()}:
                raise ValueError('Connections changed; verify the selected accounts again')
        return accounts

    def process(self, path, dry_run=False, digest=None):
        path = Path(path).resolve()
        info = marker(path,self.config.require_marker) if not dry_run else None
        digest = digest or file_hash(path)
        if info and digest != info['sha256']: raise ValueError('Completion marker hash mismatch; export is not ready')
        row = self.db.add(path,digest)
        video_id = row['id']
        if row['publishing_status'] in TERMINAL | {'QUEUED','PUBLISHING'}: return row
        if self.db.operations(video_id): return row  # Recovery uses the original frozen intent.
        live = self.config.live and not dry_run
        if row['next_attempt_at'] > time.time(): return row
        try:
            metadata = load_metadata(path,self.config.hashtags)
            if not metadata['publish'] or info and not info['publish']:
                self.db.update(video_id,publishing_status='SKIPPED',error_message='Publishing disabled for this video/preview')
                notify(self.config,f'SKIPPED: {path.name} is marked publish=false')
                return self.db.video(video_id)
            if row['publishing_status']=='DRY_RUN' and not live and json.loads(row['metadata_json'])==metadata:
                return row
            if row['upload_url'] and row['metadata_json']:
                metadata = json.loads(row['metadata_json'])
            # Reject missing/expired times before staging or uploading. Recovery never recomputes a frozen request.
            if self.config.mode=='schedule': future_schedule(metadata)
            self.db.update(video_id,publishing_status='VALIDATING',caption=metadata['caption'],
                youtube_title=metadata['youtube_title'],metadata_json=json.dumps(metadata),error_message=None)
            notify(self.config,f'Validating video: {path.name}')
            snapshot, details = stage(path,digest,self.config,info)
            accounts = self.preflight(live)
            accounts = {p:a for p,a in accounts.items() if p in metadata.get('platforms',['youtube','tiktok'])}
            if not live:
                plan = payload_for(self.config,metadata,'https://example.invalid/dry-run.mp4',accounts)
                plan['dryRun'] = True
                (self.config.data / f'dry-run-{video_id}.json').write_text(json.dumps(plan,indent=2)+'\n',encoding='utf-8')
                self.db.update(video_id,publishing_status='DRY_RUN',next_attempt_at=0)
                snapshot.unlink(missing_ok=True)
                notify(self.config,f'DRY RUN: {path.name}; {details["duration"]:.1f}s; targets {", ".join(accounts)}. No upload or publication sent.')
                return self.db.video(video_id)
            url = row['upload_url']
            if not url:
                self.db.update(video_id,publishing_status='UPLOADING')
                notify(self.config,f'Uploading to SchedulePost: {path.name}')
                url = self.client.upload(snapshot,self.config.require_live)
                self.db.update(video_id,publishing_status='UPLOADED',upload_url=url,attempts=0,next_attempt_at=0)
            for platform, account in accounts.items(): self.db.set_delivery(video_id,account['id'],platform,'PENDING')
            key = str(uuid.uuid5(uuid.NAMESPACE_URL,'blur-publisher:v1:'+digest))
            op = self.db.create_operation(video_id,self.config.mode,key,payload_for(self.config,metadata,url,accounts))
            self._submit(op)
        except APIError as error:
            self._video_error(video_id,error)
        except (ValueError,OSError,json.JSONDecodeError) as error:
            self.db.update(video_id,publishing_status='FAILED',error_message=str(error))
            notify(self.config,f'ERROR: {path.name}: {error}', 'error')
        return self.db.video(video_id)

    def _video_error(self, video_id, error):
        # If an intent exists, only that intent may recover a potentially accepted write.
        if self.db.operations(video_id): return
        row = self.db.video(video_id)
        attempts = row['attempts']+1
        retry = error.retryable and attempts < self.config.max_attempts
        self.db.update(video_id,publishing_status='RETRY_PENDING' if retry else 'FAILED',
            attempts=attempts,next_attempt_at=time.time()+min(300,2**attempts*10),error_message=str(error))
        notify(self.config,f'ERROR: {row["filename"]}: {error}; '+('retry scheduled' if retry else 'retry available after correction'), 'error')

    def _submit(self, op):
        if op['attempts'] >= self.config.max_attempts:
            self.db.operation_update(op['id'],status='NEEDS_REVIEW')
            self.db.update(op['video_id'],publishing_status='NEEDS_REVIEW',error_message='Submission retry limit reached; reconcile the same intent')
            return
        try:
            self.db.operation_update(op['id'],attempts=op['attempts']+1)
            accounts = self.preflight(live=True)
            targets = set(json.loads(op['request_json'])['connectionIds'])
            if not targets <= {a['id'] for a in accounts.values()}:
                raise ValueError('Frozen request targets differ from the selected accounts; review before recovery')
            self.db.update(op['video_id'],publishing_status='PUBLISHING')
            self.db.operation_update(op['id'],status='SUBMITTING',attempts=op['attempts']+1)
            self.config.require_live()
            result = self.client.submit(op['kind'],json.loads(op['request_json']),op['idempotency_key'])
            post_id = result['postId']
            state = 'QUEUED' if op['kind'] in ('queue','schedule') else 'PUBLISHING'
            self.db.operation_update(op['id'],post_id=post_id,status=state,error_message=None,next_attempt_at=0)
            self.db.update(op['video_id'],schedulepost_id=post_id,publishing_status=state,error_message=None)
            if state=='QUEUED':
                label = 'SCHEDULED' if op['kind']=='schedule' else 'QUEUED'
                notify(self.config,f'{label}: {self.db.video(op["video_id"])["filename"]}; awaiting confirmed delivery')
            else: notify(self.config,f'PUBLISHING: {self.db.video(op["video_id"])["filename"]}; awaiting platform results')
            self._refresh(self.db.one('SELECT * FROM operations WHERE id=?',(op['id'],)))
        except APIError as error:
            ambiguous = error.ambiguous or error.retryable or error.status == 409
            state = 'UNKNOWN' if ambiguous else 'FAILED'
            self.db.operation_update(op['id'],status=state,error_message=str(error),next_attempt_at=time.time()+min(300,2**(op['attempts']+1)*10))
            self.db.update(op['video_id'],publishing_status='PUBLISHING' if ambiguous else 'FAILED',error_message=str(error))
            notify(self.config,f'ERROR: submission {op["id"]}: {error}. '+('The same idempotency key will be reconciled; no new post intent.' if ambiguous else 'Request rejected; review before retry.'),'error')
        except ValueError as error:
            # Kill switch or preflight failure: leave the existing intent intact, with no send.
            self.db.operation_update(op['id'],status='NEEDS_REVIEW',error_message=str(error))
            self.db.update(op['video_id'],publishing_status='NEEDS_REVIEW',error_message=str(error))
            notify(self.config,f'Publication paused: {error}','warning')

    def _refresh(self, op):
        try:
            data = self.client.post(op['post_id'])
            wanted = set(json.loads(op['request_json'])['connectionIds'])
            accounts = self.db.setting('connections') or {}
            known = {a['id']:p for p,a in accounts.items()}
            # Existing deliveries bind historical intents even if configured accounts later change.
            known.update({d['connection_id']:d['platform'] for d in self.db.deliveries(op['video_id'])})
            seen = set()
            validated = []
            for item in data['results']:
                if not isinstance(item,dict): raise APIError('Invalid delivery result')
                connection = item.get('connection_id')
                if connection not in wanted or connection not in known: raise APIError('Unexpected delivery connection')
                if connection in seen: raise APIError('Duplicate delivery result')
                seen.add(connection)
                status = item.get('status')
                if status not in ('published','failed','pending','publishing','scheduled'):
                    raise APIError('Unknown platform delivery status; requires reconciliation')
                mapped = 'PUBLISHED' if status=='published' else 'FAILED' if status=='failed' else 'PENDING'
                if item.get('platform') != known[connection]: raise APIError('Delivery platform mismatch')
                if item.get('platform_post_id') is not None and not isinstance(item['platform_post_id'],str):
                    raise APIError('Invalid platform post ID')
                validated.append((connection,known[connection],mapped,item.get('platform_post_id'),
                    item.get('error'),item.get('retryable') is True))
            complete = data['delivery_complete']
            if complete and (seen != wanted or any(r.get('status') not in ('published','failed') for r in data['results'])):
                raise APIError('Incomplete terminal outcome; publication remains unconfirmed')
            remote_status = data['post'].get('status')
            if remote_status not in ('published','partial','failed','publishing','scheduled'):
                raise APIError('Unknown post status')
            if op['kind']=='schedule' and remote_status=='scheduled':
                expected = normalize_scheduled_for(json.loads(op['request_json'])['scheduledFor'])
                actual = normalize_scheduled_for(data['post'].get('scheduled_for'))
                if actual != expected:
                    raise APIError('SchedulePost time differs from the frozen request; review the existing post',status=409)
                self.db.setting('scheduled_post:'+op['post_id'], {'scheduled_for':actual,'verified_at':time.time()})
            for delivery in validated: self.db.set_delivery(op['video_id'], *delivery)
            self.db.operation_update(op['id'],status='DONE' if complete else 'QUEUED' if remote_status=='scheduled' else 'PUBLISHING',
                next_attempt_at=time.time()+self.config.poll_interval,error_message=None,refresh_failures=0)
            self._aggregate(op['video_id'], queued=remote_status=='scheduled')
        except (APIError,ValueError) as error:
            failures = op.get('refresh_failures',0)+1
            paused = failures >= self.config.max_attempts or getattr(error,'status',None) in (401,403,409)
            fields = {'next_attempt_at':time.time()+self.config.poll_interval*min(8,2**(failures-1)),
                'error_message':str(error),'refresh_failures':failures}
            if paused:
                fields['status'] = 'NEEDS_REVIEW'
                self.db.update(op['video_id'],publishing_status='NEEDS_REVIEW',error_message=str(error))
            self.db.operation_update(op['id'],**fields)
            notify(self.config,f'Outcome not yet verified for post {op["post_id"]}: {error}', 'warning')

    def _aggregate(self, video_id, queued=False):
        row = self.db.video(video_id)
        deliveries = self.db.deliveries(video_id)
        states = {p:next((d['status'] for d in deliveries if d['platform']==p),'NOT_SELECTED') for p in ('youtube','tiktok')}
        values = [s for s in states.values() if s != 'NOT_SELECTED']
        unresolved = any(o['status'] != 'DONE' for o in self.db.operations(video_id) if o['status'] != 'FAILED')
        if unresolved: status = 'QUEUED' if queued else 'PUBLISHING'
        elif values and all(s=='PUBLISHED' for s in values): status = 'PUBLISHED'
        elif 'PENDING' in values: status = 'QUEUED' if queued else 'PUBLISHING'
        elif 'PUBLISHED' in values: status = 'PARTIAL_SUCCESS'
        else: status = 'FAILED'
        self.db.update(video_id,publishing_status=status,youtube_status=states['youtube'],tiktok_status=states['tiktok'],
            published_at=time.time() if status=='PUBLISHED' else row['published_at'])
        if status != row['publishing_status'] or states['youtube'] != row['youtube_status'] or states['tiktok'] != row['tiktok_status']:
            notify(self.config,f'{status}: {row["filename"]}; YouTube={states["youtube"]}, TikTok={states["tiktok"]}')
        if status=='PUBLISHED':
            (self.config.data/'spool'/(row['file_hash']+'.mp4')).unlink(missing_ok=True)

    def reconcile(self, allow_replay=False):
        operations = self.db.all("SELECT * FROM operations WHERE status IN ('SUBMITTING','UNKNOWN','PUBLISHING','QUEUED') AND next_attempt_at<=?",(time.time(),))
        for op in operations:
            if op['post_id']: self._refresh(op)
            elif allow_replay and self.config.live: self._submit(op)

    def retry(self, video_id, failed_only=False):
        row = self.db.video(video_id)
        if not row: raise ValueError('Unknown video ID')
        ops = self.db.operations(video_id)
        unresolved = [o for o in ops if o['status'] in ACTIVE_OPERATIONS | {'NEEDS_REVIEW'}]
        if unresolved:
            if failed_only: raise ValueError('Resolve pending/unknown outcomes before retrying a failed platform')
            op = unresolved[-1]
            if op['post_id']: self._refresh(op)
            else:
                self.db.operation_update(op['id'],attempts=0,status='SUBMITTING')
                self._submit(self.db.one('SELECT * FROM operations WHERE id=?',(op['id'],)))
            return
        if not ops:
            self.db.update(video_id,publishing_status='DETECTED',attempts=0,next_attempt_at=0,error_message=None)
            return self.process(row['path'])
        rejected = [o for o in ops if o['status']=='FAILED' and not o['post_id']]
        if rejected and not failed_only:
            op = rejected[-1]
            self.db.operation_update(op['id'],attempts=0,status='SUBMITTING')
            self._submit(self.db.one('SELECT * FROM operations WHERE id=?',(op['id'],)))
            return
        if not failed_only: raise ValueError('Use retry --failed-only; an existing cross-platform intent will never be blindly repeated')
        failed = [d for d in self.db.deliveries(video_id) if d['status']=='FAILED' and d['retryable'] and not d['platform_post_id']]
        if not failed: raise ValueError('No server-confirmed retryable failed platform; correct/reconcile the provider state first')
        self.preflight(live=True)
        payload = json.loads(ops[0]['request_json'])
        payload.pop('settings',None)  # A failed queued delivery recovers immediately.
        payload.pop('scheduledFor',None)  # A failed scheduled delivery also uses the explicit immediate recovery.
        payload['connectionIds'] = [d['connection_id'] for d in failed]
        # Confirm the selected failed connection has not been replaced since the original attempt.
        current = {a['id'] for a in (self.db.setting('connections') or {}).values()}
        if not set(payload['connectionIds']) <= current: raise ValueError('Failed target is no longer a selected connected account')
        key = str(uuid.uuid5(uuid.NAMESPACE_URL,f'blur-recovery:{row["file_hash"]}:{len(ops)}'))
        op = self.db.create_operation(video_id,'immediate',key,payload)
        for d in failed: self.db.set_delivery(video_id,d['connection_id'],d['platform'],'PENDING')
        self._submit(op)

