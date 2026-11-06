import copy
from dataclasses import replace
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import Mock, patch
import requests

from config import Config
from database import Database
from metadata import load_metadata
from notifications import redact
from publisher import Publisher, payload_for, privacy_options
from schedulepost_client import SchedulePostClient, APIError, UPLOAD, BASE, retry_delay
from video_validator import candidate, file_hash, marker, marker_path, stage, mark_ready, probe, wait_stable
from watcher import Scanner, SingleInstance

YT='11111111-1111-4111-8111-111111111111'
TT='22222222-2222-4222-8222-222222222222'
POST='33333333-3333-4333-8333-333333333333'
ACCOUNTS={'youtube':{'id':YT,'platform':'youtube','account_name':'Test YouTube'},
          'tiktok':{'id':TT,'platform':'tiktok','account_name':'Test TikTok'}}


def outcome(statuses=('published','published'), complete=True, post_status='published'):
    return {'post':{'id':POST,'status':post_status},'delivery_complete':complete,
        'results':[{'connection_id':cid,'platform':platform,'status':status,
            'platform_post_id':platform+'-post' if status=='published' else None,
            'error':'Temporary service failure' if status=='failed' else None,'retryable':status=='failed'}
            for cid,platform,status in zip((YT,TT),('youtube','tiktok'),statuses)]}


class FakeClient:
    def __init__(self):
        self.uploads=[]; self.submissions=[]; self.reads=[]
        self.response=outcome(); self.submit_error=None; self.read_error=None
    def select_connections(self, config): return copy.deepcopy(ACCOUNTS)
    def presign(self,*args): return {'uploadUrl':'hidden','videoUrl':'https://media.example/video.mp4'}
    def upload(self,path,before_write):
        before_write(); self.uploads.append(str(path)); return 'https://media.example/video.mp4'
    def submit(self,kind,payload,key):
        self.submissions.append((kind,copy.deepcopy(payload),key))
        if self.submit_error: raise self.submit_error
        return {'postId':POST}
    def post(self,post_id):
        self.reads.append(post_id)
        if self.read_error: raise self.read_error
        return copy.deepcopy(self.response)


class EngineTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(); self.root=Path(self.temp.name)
        self.config=Config(self.root,self.root/'output','sp_unit_test',dry_run=False,auto_publish=True,require_marker=False,stability=1)
        self.config.output.mkdir(); self.config.data.mkdir()
        (self.root/'.env').write_text('DRY_RUN=false\nAUTO_PUBLISH=true\n')
        (self.config.data/'tiktok-privacy.json').write_text(json.dumps({'connection_id':TT,'allowed_options':['PUBLIC_TO_EVERYONE']}))
        self.db=Database(self.config.data/'publisher.db'); self.client=FakeClient()
        self.publisher=Publisher(self.config,self.db,self.client)
        self.publisher.verify(upload_test=True)
        self.video=self.config.output/'TestStory-final.mp4'; self.video.write_bytes(b'video fixture'*200)
        self.digest=file_hash(self.video)
        def staged(*args):
            f=self.config.data/'spool'/f'{self.digest}.mp4'; f.parent.mkdir(exist_ok=True); f.write_bytes(self.video.read_bytes())
            return f,{'duration':1}
        self.stage_patch=patch('publisher.stage',side_effect=staged); self.stage_patch.start()
    def tearDown(self):
        self.stage_patch.stop(); self.db.close(); self.temp.cleanup()
    def due(self): self.db.conn.execute('UPDATE operations SET next_attempt_at=0'); self.db.conn.commit()
    def test_dry_run_sends_no_media_or_publication(self):
        row=self.publisher.process(self.video,dry_run=True)
        self.assertEqual(row['publishing_status'],'DRY_RUN'); self.assertFalse(self.client.uploads); self.assertFalse(self.client.submissions)
        self.assertTrue((self.config.data/f'dry-run-{row["id"]}.json').exists())
    def test_publish_false_skips(self):
        self.video.with_suffix('.json').write_text('{"publish":false}')
        row=self.publisher.process(self.video)
        self.assertEqual(row['publishing_status'],'SKIPPED'); self.assertFalse(self.client.uploads)
    def test_youtube_only_never_sends_a_tiktok_target(self):
        self.video.with_suffix('.json').write_text('{"platforms":["youtube"]}')
        self.client.response['results']=self.client.response['results'][:1]
        row=self.publisher.process(self.video)
        payload=self.client.submissions[0][1]
        self.assertEqual(payload['connectionIds'],[YT])
        self.assertNotIn('tiktokPostMode',payload); self.assertNotIn('tiktokPrivacy',payload)
        self.assertEqual(row['publishing_status'],'PUBLISHED')
        self.assertEqual(row['youtube_status'],'PUBLISHED'); self.assertEqual(row['tiktok_status'],'NOT_SELECTED')
        self.assertEqual(len(self.db.deliveries(row['id'])),1)
    def test_youtube_only_pending_remains_pending(self):
        self.video.with_suffix('.json').write_text('{"platforms":["youtube"]}')
        self.client.response=outcome(('pending','pending'),False,'publishing')
        self.client.response['results']=self.client.response['results'][:1]
        row=self.publisher.process(self.video)
        self.assertEqual(row['publishing_status'],'PUBLISHING'); self.assertIsNone(row['published_at'])
    def test_dry_run_metadata_edit_refreshes_plan(self):
        row=self.publisher.process(self.video,dry_run=True)
        self.video.with_suffix('.json').write_text('{"caption":"Reviewed caption"}')
        self.publisher.process(self.video,dry_run=True)
        plan=json.loads((self.config.data/f'dry-run-{row["id"]}.json').read_text())
        self.assertEqual(plan['caption'],'Reviewed caption'); self.assertFalse(self.client.submissions)
    def test_recovery_cannot_silently_target_an_old_account(self):
        self.client.submit_error=APIError('Response lost',retryable=True,ambiguous=True)
        row=self.publisher.process(self.video)
        current=copy.deepcopy(ACCOUNTS); current['youtube']['id']=POST
        self.db.setting('verified_connections',{p:a['id'] for p,a in current.items()})
        with patch.object(self.client,'select_connections',return_value=current):
            self.due(); self.publisher.reconcile(True)
        self.assertEqual(len(self.client.submissions),1)
        self.assertEqual(self.db.video(row['id'])['publishing_status'],'NEEDS_REVIEW')
    def test_persisted_hash_prevents_renamed_duplicate(self):
        first=self.publisher.process(self.video); self.assertEqual(first['publishing_status'],'PUBLISHED')
        duplicate=self.video.with_name('renamed.mp4'); shutil.copyfile(self.video,duplicate)
        self.db.close(); self.db=Database(self.config.data/'publisher.db')
        self.publisher=Publisher(self.config,self.db,self.client)
        second=self.publisher.process(duplicate)
        self.assertEqual(first['id'],second['id']); self.assertEqual(len(self.client.submissions),1)
    def test_pending_is_not_published(self):
        self.client.response=outcome(('published','pending'),False,'publishing')
        row=self.publisher.process(self.video)
        self.assertEqual(row['publishing_status'],'PUBLISHING'); self.assertIsNone(row['published_at'])
        self.assertEqual(row['youtube_status'],'PUBLISHED')
    def test_queue_waits_for_delivery(self):
        self.publisher.config=replace(self.config,mode='queue')
        self.client.response=outcome(('scheduled','scheduled'),False,'scheduled')
        row=self.publisher.process(self.video)
        self.assertEqual(row['publishing_status'],'QUEUED')
        self.assertEqual(self.client.submissions[0][0],'queue')
        self.assertEqual(self.client.submissions[0][1]['settings']['timezone'],'Africa/Lagos')
    def configure_schedule(self):
        self.publisher.config=replace(self.config,mode='schedule')
        self.video.with_suffix('.json').write_text(json.dumps({'platforms':['youtube'],
            'scheduled_for':'2099-11-04T19:30:00+01:00'}))
        self.client.response=outcome(('scheduled',),False,'scheduled')
        self.client.response['post']['scheduled_for']='2099-11-04T18:30:00Z'
    def test_exact_schedule_uses_utc_and_only_youtube(self):
        self.configure_schedule()
        row=self.publisher.process(self.video)
        kind,payload,key=self.client.submissions[0]
        self.assertEqual(kind,'schedule'); self.assertEqual(payload['scheduledFor'],'2099-11-04T18:30:00Z')
        self.assertEqual(payload['connectionIds'],[YT]); self.assertNotIn('settings',payload)
        self.assertNotIn('tiktokPrivacy',payload); self.assertNotIn('tiktokPostMode',payload)
        self.assertEqual(row['publishing_status'],'QUEUED'); self.assertIsNone(row['published_at'])
        self.assertEqual(row['tiktok_status'],'NOT_SELECTED')
        self.assertEqual(self.db.setting('scheduled_post:'+POST)['scheduled_for'],payload['scheduledFor'])
    def test_schedule_dry_run_records_time_without_upload(self):
        self.configure_schedule()
        row=self.publisher.process(self.video,dry_run=True)
        plan=json.loads((self.config.data/f'dry-run-{row["id"]}.json').read_text())
        self.assertEqual(plan['scheduledFor'],'2099-11-04T18:30:00Z')
        self.assertEqual(row['publishing_status'],'DRY_RUN')
        self.assertFalse(self.client.uploads); self.assertFalse(self.client.submissions)
    def test_missing_schedule_rejected_before_upload(self):
        self.publisher.config=replace(self.config,mode='schedule')
        row=self.publisher.process(self.video)
        self.assertEqual(row['publishing_status'],'FAILED')
        self.assertIn('requires scheduled_for',row['error_message'])
        self.assertFalse(self.client.uploads); self.assertFalse(self.client.submissions)
    def test_expired_schedule_rejected_before_upload(self):
        self.configure_schedule()
        self.video.with_suffix('.json').write_text('{"scheduled_for":"2000-01-01T00:00:00Z"}')
        row=self.publisher.process(self.video)
        self.assertEqual(row['publishing_status'],'FAILED'); self.assertIn('future',row['error_message'])
        self.assertFalse(self.client.uploads); self.assertFalse(self.client.submissions)
    def test_schedule_replay_keeps_original_time_target_and_key(self):
        self.configure_schedule(); self.client.submit_error=APIError('Response lost',retryable=True,ambiguous=True)
        row=self.publisher.process(self.video)
        self.video.with_suffix('.json').write_text('{"scheduled_for":"2000-01-01T00:00:00Z","caption":"Changed"}')
        self.db.close(); self.db=Database(self.config.data/'publisher.db')
        self.publisher=Publisher(replace(self.config,mode='immediate'),self.db,self.client)
        self.client.submit_error=None; self.due(); self.publisher.reconcile(allow_replay=True)
        self.assertEqual(self.client.submissions[0],self.client.submissions[1])
        self.assertEqual(len(self.client.uploads),1); self.assertEqual(len(self.db.operations(row['id'])),1)
        self.assertEqual(self.db.video(row['id'])['publishing_status'],'QUEUED')
    def test_changed_remote_schedule_requires_review_without_reposting(self):
        self.configure_schedule(); self.client.response['post']['scheduled_for']='2099-11-05T18:30:00Z'
        row=self.publisher.process(self.video)
        self.assertEqual(row['publishing_status'],'NEEDS_REVIEW')
        self.assertIsNone(self.db.setting('scheduled_post:'+POST))
        self.due(); self.publisher.reconcile(allow_replay=True)
        self.assertEqual(len(self.client.submissions),1)
    def test_scheduling_respects_live_kill_switch(self):
        self.configure_schedule(); (self.root/'.env').write_text('DRY_RUN=true\nAUTO_PUBLISH=false\n')
        row=self.publisher.process(self.video)
        self.assertEqual(row['publishing_status'],'FAILED')
        self.assertFalse(self.client.uploads); self.assertFalse(self.client.submissions)
    def test_failed_scheduled_delivery_recovery_removes_old_time(self):
        self.configure_schedule(); self.client.response=outcome(('failed',),True,'failed')
        row=self.publisher.process(self.video)
        self.client.response=outcome(('published',),True,'published')
        self.publisher.retry(row['id'],failed_only=True)
        kind,payload,key=self.client.submissions[-1]
        self.assertEqual(kind,'immediate'); self.assertNotIn('scheduledFor',payload)
        self.assertEqual(payload['connectionIds'],[YT]); self.assertEqual(self.db.video(row['id'])['publishing_status'],'PUBLISHED')
    def test_response_lost_replays_frozen_intent_after_restart(self):
        self.client.submit_error=APIError('Response lost',retryable=True,ambiguous=True)
        self.publisher.process(self.video)
        self.video.with_suffix('.json').write_text('{"caption":"Changed later"}')
        self.db.close(); self.db=Database(self.config.data/'publisher.db')
        self.publisher=Publisher(self.config,self.db,self.client); self.client.submit_error=None; self.due()
        self.publisher.reconcile(allow_replay=True)
        self.assertEqual(self.client.submissions[0],self.client.submissions[1]); self.assertEqual(len(self.client.uploads),1)
        self.assertEqual(self.db.get(self.digest)['publishing_status'],'PUBLISHED')
    def test_partial_recovery_targets_only_failed_channel(self):
        self.publisher.config=replace(self.config,mode='queue')
        self.client.response=outcome(('published','failed'),True,'partial')
        row=self.publisher.process(self.video); self.assertEqual(row['publishing_status'],'PARTIAL_SUCCESS')
        self.client.response=outcome(); self.client.response['results']=self.client.response['results'][1:]
        self.publisher.retry(row['id'],failed_only=True)
        kind,payload,key=self.client.submissions[-1]
        self.assertEqual(kind,'immediate'); self.assertNotIn('settings',payload); self.assertEqual(payload['connectionIds'],[TT])
        self.assertNotEqual(key,self.client.submissions[0][2]); self.assertEqual(self.db.video(row['id'])['publishing_status'],'PUBLISHED')
    def test_success_is_sticky(self):
        row=self.publisher.process(self.video)
        self.db.set_delivery(row['id'],YT,'youtube','FAILED',error='late stale response')
        self.assertEqual(self.db.deliveries(row['id'])[0]['status'],'PUBLISHED')
    def test_known_platform_id_blocks_new_retry(self):
        self.client.response=outcome(('published','failed'),True,'partial')
        self.client.response['results'][1]['platform_post_id']='maybe-created'
        row=self.publisher.process(self.video)
        with self.assertRaisesRegex(ValueError,'No server-confirmed'): self.publisher.retry(row['id'],failed_only=True)
    def test_incomplete_terminal_response_is_not_accepted(self):
        self.client.response['results']=self.client.response['results'][:1]
        row=self.publisher.process(self.video)
        self.assertEqual(row['publishing_status'],'PUBLISHING'); self.assertEqual(row['youtube_status'],'PENDING')
    def test_delivery_complete_false_cannot_claim_full_success(self):
        self.client.response['delivery_complete']=False
        row=self.publisher.process(self.video)
        self.assertEqual(row['publishing_status'],'PUBLISHING'); self.assertIsNone(row['published_at'])
    def test_auth_error_pauses_outcome_reads(self):
        self.client.read_error=APIError('Revoked key',status=401)
        row=self.publisher.process(self.video)
        self.assertEqual(row['publishing_status'],'NEEDS_REVIEW'); self.due(); self.publisher.reconcile(True)
        self.assertEqual(len(self.client.reads),1)
    def test_schema_errors_pause_after_bounded_retries(self):
        self.client.read_error=APIError('Invalid schema')
        self.publisher.process(self.video)
        for _ in range(10): self.due(); self.publisher.reconcile(True)
        self.assertEqual(len(self.client.reads),self.config.max_attempts)
        self.assertEqual(self.db.get(self.digest)['publishing_status'],'NEEDS_REVIEW')
    def test_kill_switch_prevents_external_writes(self):
        (self.root/'.env').write_text('DRY_RUN=true\nAUTO_PUBLISH=false\n')
        self.publisher.process(self.video)
        self.assertFalse(self.client.uploads); self.assertFalse(self.client.submissions)
    def test_changed_key_needs_verification(self):
        self.publisher.config=replace(self.config,api_key='sp_replacement')
        row=self.publisher.process(self.video)
        self.assertEqual(row['publishing_status'],'FAILED'); self.assertFalse(self.client.uploads)
    def test_failed_verify_clears_previous_verification(self):
        with patch.object(self.client,'presign',side_effect=APIError('insufficient_scope',status=403)):
            with self.assertRaises(APIError): self.publisher.verify(True)
        self.assertEqual(self.db.setting('verified_key'),'')
    def test_ambiguous_retry_limit_preserves_original_intent(self):
        self.client.submit_error=APIError('timeout',retryable=True,ambiguous=True)
        self.publisher.process(self.video)
        for _ in range(10): self.due(); self.publisher.reconcile(True)
        self.assertEqual(len(self.client.submissions),self.config.max_attempts)
        self.assertEqual(len(self.db.operations(1)),1); self.assertEqual(self.db.video(1)['publishing_status'],'NEEDS_REVIEW')
    def test_presend_auth_failure_can_replay_same_key_after_correction(self):
        self.client.submit_error=APIError('insufficient_scope',status=403)
        row=self.publisher.process(self.video); self.client.submit_error=None
        self.publisher.retry(row['id'])
        self.assertEqual(self.client.submissions[0],self.client.submissions[1])
    def test_wrong_privacy_account_rejected(self):
        with self.assertRaises(ValueError): privacy_options(self.config,YT)
    def test_database_rejects_changed_idempotent_payload(self):
        row=self.db.add(self.video,self.digest)
        self.db.create_operation(row['id'],'immediate','same',{'caption':'one'})
        with self.assertRaisesRegex(ValueError,'Idempotency conflict'):
            self.db.create_operation(row['id'],'immediate','same',{'caption':'two'})
    def test_watcher_waits_for_stability_and_skips_done_file(self):
        scanner=Scanner(self.config,self.publisher)
        self.publisher.config=replace(self.config,dry_run=True,auto_publish=False)
        with patch('watcher.time.monotonic',side_effect=[0,0.5,2,3]):
            scanner.scan(); self.assertIsNone(self.db.get(self.digest))
            scanner.scan(); self.assertIsNone(self.db.get(self.digest))
            scanner.scan(); self.assertEqual(self.db.get(self.digest)['publishing_status'],'DRY_RUN')
            scanner.scan()
    def test_watcher_requires_completion_marker(self):
        scanner=Scanner(replace(self.config,require_marker=True),self.publisher)
        scanner.scan(); self.assertFalse(scanner.stable)
    def test_single_instance_lock_released(self):
        with SingleInstance(self.config.data):
            with self.assertRaises(ValueError):
                with SingleInstance(self.config.data): pass
        with SingleInstance(self.config.data): pass


def response(status=200,data=None,headers=None):
    r=Mock(); r.status_code=status; r.headers=headers or {}
    r.iter_content.return_value=[json.dumps(data or {}).encode()]
    r.__enter__=Mock(return_value=r); r.__exit__=Mock(return_value=False)
    return r


class ClientTests(unittest.TestCase):
    def client(self,*responses):
        session=Mock(); session.request.side_effect=list(responses)
        return SchedulePostClient('sp_unit_test',session=session,sleep=Mock())
    def test_exact_v2_upload_request(self):
        client=self.client(response(data={'success':True,'uploadUrl':'https://bucket.r2.cloudflarestorage.com/file?X-Amz-Signature=secret','videoUrl':'https://media.example/file.mp4'}))
        client.presign('movie.mp4','video/mp4',5000)
        args,kw=client.session.request.call_args
        self.assertEqual(args,('POST',UPLOAD)); self.assertEqual(kw['json'],{'filename':'movie.mp4','contentType':'video/mp4','contentLength':5000})
        self.assertEqual(kw['headers']['x-api-key'],'sp_unit_test'); self.assertFalse(kw['allow_redirects'])
    def test_401_and_403_are_not_retried(self):
        for status in (401,403):
            client=self.client(response(status,{'error':'denied'}))
            with self.assertRaises(APIError): client.connections()
            self.assertEqual(client.session.request.call_count,1); client.sleep.assert_not_called()
    def test_retry_after_is_honored(self):
        client=self.client(response(429,{'error':'rate limited'},{'Retry-After':'5'}),response(data={'connections':[]}))
        self.assertEqual(client.connections(),[]); client.sleep.assert_called_once_with(5)
    def test_network_failure_retries_same_idempotency_key(self):
        client=self.client(requests.Timeout(),response(data={'postId':POST}))
        payload={'caption':'frozen'}; client.submit('immediate',payload,'same-key')
        calls=client.session.request.call_args_list
        self.assertEqual(calls[0].kwargs,calls[1].kwargs)
    def test_schedule_uses_documented_endpoint_and_idempotency_header(self):
        client=self.client(response(data={'postId':POST,'success':True,'scheduledFor':'2099-11-04T18:30:00Z'}))
        payload={'connectionIds':[YT],'scheduledFor':'2099-11-04T18:30:00Z'}
        client.submit('schedule',payload,'schedule-key')
        args,kwargs=client.session.request.call_args
        self.assertEqual(args,('POST',BASE+'/schedule')); self.assertEqual(kwargs['json'],payload)
        self.assertEqual(kwargs['headers']['Idempotency-Key'],'schedule-key')
    def test_write_guard_is_rechecked_before_network_retry(self):
        client=self.client(requests.Timeout(),response(data={'postId':POST}))
        client.write_guard=Mock(side_effect=[None,ValueError('Publishing disabled')])
        with self.assertRaises(ValueError): client.submit('immediate',{},'same')
        self.assertEqual(client.session.request.call_count,1)
    def test_invalid_post_id_is_ambiguous(self):
        client=self.client(response(data={'postId':'broken'}))
        with self.assertRaises(APIError) as error: client.submit('immediate',{},'same')
        self.assertTrue(error.exception.ambiguous)
    def test_invalid_connection_schema(self):
        client=self.client(response(data={'connections':[{'id':'broken','platform':'youtube'}]}))
        with self.assertRaises(APIError): client.connections()
    def test_account_selection_is_explicit_when_ambiguous(self):
        rows=list(ACCOUNTS.values())+[dict(ACCOUNTS['youtube'],id=POST)]
        client=self.client(response(data={'connections':rows}))
        with self.assertRaisesRegex(APIError,'Multiple youtube'): client.select_connections(Config(Path('.'),Path('.'),'test'))
    def test_put_has_no_api_credential_and_rewinds_on_retry(self):
        client=SchedulePostClient('sp_unit_test',sleep=Mock())
        client.presign=Mock(return_value={'uploadUrl':'https://bucket.r2.cloudflarestorage.com/x?secret','videoUrl':'https://media.example/v.mp4'})
        bodies=[]; headers=[]
        def put(*args,**kwargs):
            bodies.append(kwargs['data'].read()); headers.append(kwargs['headers'])
            return response(500 if len(bodies)==1 else 200)
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/'video.mp4'; path.write_bytes(b'abc'*1000)
            with patch('schedulepost_client.requests.put',side_effect=put): client.upload(path)
        self.assertEqual(bodies[0],bodies[1]); self.assertEqual(headers[0],{'Content-Type':'video/mp4','Content-Length':'3000'})
    def test_signed_media_url_rejected(self):
        client=self.client(response(data={'success':True,'uploadUrl':'https://bucket.r2.cloudflarestorage.com/x?s','videoUrl':'https://media.example/x?signature=secret'}))
        with self.assertRaises(APIError): client.presign('v.mp4','video/mp4',1000)
    def test_redaction(self):
        text=redact('sp_example_token https://example.com/a?X-Amz-Signature=abcdef Authorization: BearerToken')
        self.assertNotIn('abcdef',text); self.assertNotIn('sp_example',text); self.assertNotIn('BearerToken',text)


class MetadataTests(unittest.TestCase):
    def setUp(self): self.temp=tempfile.TemporaryDirectory(); self.video=Path(self.temp.name)/'TenThousandSteps-final.mp4'
    def tearDown(self): self.temp.cleanup()
    def test_neutral_filename_defaults(self):
        self.assertEqual(load_metadata(self.video)['youtube_title'],'Ten Thousand Steps')
    def test_renderer_metadata_is_separate(self):
        Path(str(self.video)+'.json').write_text('{"quality":"final"}')
        self.assertTrue(load_metadata(self.video)['publish'])
    def test_custom_metadata(self):
        self.video.with_suffix('.json').write_text('{"caption":"Hello","hashtags":"#shorts #fitness","publish":false}')
        value=load_metadata(self.video); self.assertEqual(value['caption'],'Hello'); self.assertFalse(value['publish'])
    def test_limits_and_types(self):
        for data in ({'youtube_title':'x'*101},{'youtube_description':'x'*5001},{'publish':'false'},{'hashtags':'not a hashtag'},{'caption':'😀'*1101}):
            self.video.with_suffix('.json').write_text(json.dumps(data))
            with self.assertRaises(ValueError): load_metadata(self.video)
    def test_platform_selection_validation(self):
        for platforms in ([],['youtube','youtube'],['unknown'],'youtube',[{}]):
            self.video.with_suffix('.json').write_text(json.dumps({'platforms':platforms}))
            with self.assertRaises(ValueError): load_metadata(self.video)
    def test_scheduled_time_normalizes_explicit_timezone(self):
        self.video.with_suffix('.json').write_text('{"scheduled_for":"2099-11-04T19:30:00+01:00"}')
        self.assertEqual(load_metadata(self.video)['scheduled_for'],'2099-11-04T18:30:00Z')
    def test_scheduled_time_rejects_invalid_or_ambiguous_values(self):
        for value in (None,42,'invalid','2099-11-04','2099-11-04T19:30:00'):
            self.video.with_suffix('.json').write_text(json.dumps({'scheduled_for':value}))
            with self.assertRaises(ValueError): load_metadata(self.video)
    def test_schedule_mode_keeps_safe_installation_defaults(self):
        root=Path(self.temp.name); (root/'.env').write_text('PUBLISH_MODE=schedule\n')
        with patch.dict(os.environ,{},clear=True): config=Config.load(root)
        self.assertEqual(config.mode,'schedule'); self.assertFalse(config.live)


class MediaTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory(); cls.root=Path(cls.temp.name)
        cls.fixture=cls.root/'fixture.mp4'
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=96x160:rate=12',
            '-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','1','-c:v','libx264','-pix_fmt','yuv420p',
            '-c:a','aac','-y',str(cls.fixture)],check=True,capture_output=True)
    @classmethod
    def tearDownClass(cls): cls.temp.cleanup()
    def setUp(self):
        self.temp_case=tempfile.TemporaryDirectory(); self.path=Path(self.temp_case.name)
        self.config=Config(self.path,self.path,'',stability=1)
        self.video=self.path/'test.mp4'; shutil.copyfile(self.fixture,self.video)
    def tearDown(self): self.temp_case.cleanup()
    def test_real_decode_marker_snapshot_and_hash(self):
        with patch('video_validator.wait_stable'): info=mark_ready(self.video,self.config,publish=True)
        self.assertEqual(marker(self.video)['sha256'],file_hash(self.video))
        snapshot,details=stage(self.video,info['sha256'],self.config,info)
        self.assertEqual(file_hash(snapshot),info['sha256']); self.assertEqual(details['height'],160)
    def test_changed_file_invalidates_marker(self):
        with patch('video_validator.wait_stable'): mark_ready(self.video,self.config)
        with self.video.open('ab') as stream: stream.write(b'changed')
        with self.assertRaisesRegex(ValueError,'Stale'): marker(self.video)
    def test_snapshot_detects_changed_bytes(self):
        with self.assertRaisesRegex(ValueError,'changed'): stage(self.video,'a'*64,self.config)
    def test_stability_detects_active_export(self):
        with patch('video_validator.fingerprint',side_effect=[(10,1),(20,2)]),patch('video_validator.time.sleep'):
            with self.assertRaises(ValueError): wait_stable(self.video,1)
    def test_temp_names_filtered(self):
        for name in ('x.part.mp4','x.tmp.mov','.hidden.webm','x.mp4.part','~export.mp4'):
            self.assertFalse(candidate(Path(name)))
    def test_landscape_not_accepted(self):
        landscape=self.path/'wide.mp4'
        subprocess.run(['ffmpeg','-v','error','-i',str(self.fixture),'-vf','transpose=1','-c:v','libx264','-y',str(landscape)],check=True,capture_output=True)
        with self.assertRaisesRegex(ValueError,'portrait'): probe(landscape,self.config)
    def test_mov_normalizes_to_mp4(self):
        mov=self.path/'input.mov'
        subprocess.run(['ffmpeg','-v','error','-i',str(self.fixture),'-c','copy','-y',str(mov)],check=True,capture_output=True)
        snapshot,details=stage(mov,file_hash(mov),self.config)
        self.assertEqual(snapshot.suffix,'.mp4'); self.assertEqual(details['codec'],'h264'); self.assertEqual(details['audio'],'aac')


if __name__=='__main__': unittest.main()
