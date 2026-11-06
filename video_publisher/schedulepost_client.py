"""SchedulePost's published REST contract, checked against /api-docs.

v1 JSON /upload is retired. Presigning uses v2 with an exact byte count.
No undocumented creator-info endpoint is assumed.
"""
import email.utils
import json
import time
from urllib.parse import urlparse, quote
import uuid
import requests
from notifications import redact

BASE = 'https://schedulepost.fulinlabs.com/api/v1'
UPLOAD = 'https://schedulepost.fulinlabs.com/api/v2/upload'

class APIError(RuntimeError):
    def __init__(self, message, status=None, retryable=False, ambiguous=False):
        super().__init__(redact(message))
        self.status, self.retryable, self.ambiguous = status, retryable, ambiguous

def retry_delay(attempt, header=None):
    delay = min(60, 2 ** attempt)
    if header:
        try: delay = max(delay, float(header))
        except ValueError:
            try: delay = max(delay, email.utils.parsedate_to_datetime(header).timestamp() - time.time())
            except (ValueError, TypeError): pass
    return min(60, max(0, delay))

def https_url(value, signed=False):
    if not isinstance(value, str): raise APIError('Upload response is missing a URL')
    p = urlparse(value)
    if p.scheme != 'https' or not p.hostname or p.username or p.password or p.port not in (None,443):
        raise APIError('API returned an unsafe upload/media URL')
    if signed and not p.hostname.endswith('.r2.cloudflarestorage.com'):
        raise APIError('Unexpected upload host; review the official upload contract before allowing it')
    if not signed and (p.query or p.fragment or p.hostname in ('localhost','127.0.0.1','::1')):
        raise APIError('The public media URL must not contain signed query parameters')
    return value

def valid_uuid(value, context, ambiguous=False):
    try:
        if not isinstance(value, str): raise ValueError()
        uuid.UUID(value)
    except (ValueError, TypeError, AttributeError):
        raise APIError(f'Invalid {context} identifier', ambiguous=ambiguous) from None
    return value

class SchedulePostClient:
    def __init__(self, api_key, attempts=4, session=None, sleep=time.sleep):
        self.key, self.attempts = api_key, attempts
        self.session, self.sleep = session or requests.Session(), sleep
        self.write_guard = lambda: None

    def request(self, method, endpoint, payload=None, key=None, before_write=None):
        if not self.key: raise APIError('SCHEDULEPOST_API_KEY is missing', status=401)
        url = UPLOAD if endpoint == 'upload-v2' else BASE + endpoint
        headers = {'x-api-key':self.key,'Accept':'application/json','User-Agent':'BLUR-Publisher/1.0'}
        if key: headers['Idempotency-Key'] = key
        for attempt in range(self.attempts):
            if method=='POST':
                if before_write: before_write()
                elif endpoint != 'upload-v2': self.write_guard()
            try:
                with self.session.request(method,url,json=payload,headers=headers,timeout=(15,90),allow_redirects=False,stream=True) as r:
                    chunks, count = [], 0
                    for chunk in r.iter_content(65536):
                        count += len(chunk)
                        if count > 2_000_000: raise APIError('API response exceeded the size limit', ambiguous=method=='POST')
                        chunks.append(chunk)
                    try: data = json.loads(b''.join(chunks))
                    except ValueError: data = {}
                    if not isinstance(data, dict): data = {}
                    if 200 <= r.status_code < 300:
                        if not data: raise APIError('API returned invalid JSON', ambiguous=method=='POST')
                        return data
                    retryable = r.status_code in (408,429) or r.status_code >= 500
                    detail = data.get('code') or data.get('error') or 'Request rejected'
                    error = APIError(f'SchedulePost HTTP {r.status_code}: {detail}',r.status_code,retryable,
                        method=='POST' and retryable)
                    if not retryable or attempt+1 == self.attempts: raise error
                    self.sleep(retry_delay(attempt,r.headers.get('Retry-After')))
            except requests.RequestException:
                if attempt+1 == self.attempts:
                    raise APIError('SchedulePost network request failed after bounded retries',retryable=True,ambiguous=method=='POST') from None
                self.sleep(retry_delay(attempt))

    def connections(self):
        data = self.request('GET','/connections')
        items = data.get('connections')
        if not isinstance(items,list): raise APIError('Invalid connections response')
        result = []
        for item in items:
            if not isinstance(item,dict) or not isinstance(item.get('platform'),str) or not isinstance(item.get('id'),str):
                raise APIError('Invalid connection entry')
            valid_uuid(item['id'], 'connection')
            result.append({'id':item['id'],'platform':item['platform'].lower(),'account_name':str(item.get('account_name',''))})
        return result

    def select_connections(self, config):
        all_accounts = self.connections()
        selected = {}
        for platform, explicit in [('youtube',config.youtube_id),('tiktok',config.tiktok_id)]:
            candidates = [a for a in all_accounts if a['platform']==platform]
            if explicit: candidates = [a for a in candidates if a['id']==explicit]
            if not candidates: raise APIError(f'Missing {platform} connection: connect the account or correct its configured ID')
            if len(candidates)>1: raise APIError(f'Multiple {platform} accounts: set {platform.upper()}_CONNECTION_ID explicitly')
            selected[platform] = candidates[0]
        return selected

    def presign(self, filename, mime, size, before_write=None):
        if not 0 < size <= 512*1024*1024: raise ValueError('Upload must be between 1 byte and 512 MB')
        data = self.request('POST','upload-v2',{'filename':filename,'contentType':mime,'contentLength':size},before_write=before_write)
        if data.get('success') is not True: raise APIError('Upload target request was not confirmed')
        return {'uploadUrl':https_url(data.get('uploadUrl'),signed=True), 'videoUrl':https_url(data.get('videoUrl'))}

    def upload(self, path, before_write=lambda: None):
        size = path.stat().st_size
        mime = 'video/mp4'
        for renewal in range(2):
            before_write()
            target = self.presign(path.name,mime,size,before_write=before_write)
            for attempt in range(self.attempts):
                before_write()
                retry_after = None
                try:
                    # A separate request prevents x-api-key/cookies from reaching the storage host.
                    with path.open('rb') as body:
                        r = requests.put(target['uploadUrl'],data=body,headers={'Content-Type':mime,'Content-Length':str(size)},
                            timeout=(30,900),allow_redirects=False)
                    status = r.status_code
                    retry_after = r.headers.get('Retry-After')
                    r.close()
                    if 200 <= status < 300: return target['videoUrl']
                    if status == 403 and renewal == 0: break  # Refresh an expired signed target once.
                    retryable = status in (408,429) or status >= 500
                    if not retryable or attempt+1 == self.attempts: raise APIError(f'Storage upload failed (HTTP {status})',status,retryable)
                except requests.RequestException:
                    if attempt+1 == self.attempts: raise APIError('Storage upload network failure',retryable=True) from None
                self.sleep(retry_delay(attempt, retry_after))
        raise APIError('Signed upload target could not be renewed')

    def submit(self, kind, payload, key):
        endpoints = {'immediate':'/publish', 'queue':'/queue', 'schedule':'/schedule'}
        if kind not in endpoints: raise ValueError('Invalid publication mode')
        data = self.request('POST',endpoints[kind],payload,key)
        if not isinstance(data.get('postId'),str): raise APIError('Publish response missing postId; replay the same intent',ambiguous=True)
        valid_uuid(data['postId'], 'post', ambiguous=True)
        return data

    def post(self, post_id):
        valid_uuid(post_id, 'post')
        data = self.request('GET','/posts/'+quote(post_id,safe=''))
        if not isinstance(data.get('post'),dict) or not isinstance(data.get('results'),list) or not isinstance(data.get('delivery_complete'),bool):
            raise APIError('Invalid post outcome response')
        if data['post'].get('id') != post_id: raise APIError('Post outcome ID mismatch')
        return data

