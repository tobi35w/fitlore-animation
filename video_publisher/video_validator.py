"""Export-completion checks, full decode, and an immutable upload snapshot."""
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import time
import uuid

FORMATS = {'.mp4','.mov','.webm'}

def fingerprint(path):
    s = path.stat()
    return s.st_size, s.st_mtime_ns

def file_hash(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024*1024),b''): digest.update(block)
    return digest.hexdigest()

def candidate(path):
    name = path.name.lower()
    return path.suffix.lower() in FORMATS and not name.startswith(('.', '~')) and not any(x in name for x in ('.part.', '.tmp.', '.partial.', 'pre-encode'))

def marker_path(path): return Path(str(path)+'.ready.json')

def marker(path, required=True):
    file = marker_path(path)
    if not file.exists():
        if required: raise ValueError('Waiting for the export-completion .ready.json marker')
        return None
    if file.stat().st_size > 65536: raise ValueError('Completion marker too large')
    info = json.loads(file.read_text(encoding='utf-8-sig'))
    if not isinstance(info,dict) or info.get('schema') != 1 or info.get('complete') is not True:
        raise ValueError('Invalid completion marker')
    if info.get('filename') != path.name or info.get('size') != path.stat().st_size:
        raise ValueError('Stale completion marker: filename or byte count changed')
    digest = info.get('sha256')
    if not isinstance(digest,str) or len(digest)!=64 or any(c not in '0123456789abcdef' for c in digest):
        raise ValueError('Completion marker requires a SHA-256 digest')
    if not isinstance(info.get('publish'),bool): raise ValueError('Completion marker requires a publish boolean')
    return info

def wait_stable(path, seconds):
    first = fingerprint(path)
    time.sleep(seconds)
    if fingerprint(path) != first: raise ValueError('Video is still changing; retry when exporting finishes')
    return first

def run_media(args, timeout=600):
    try:
        return subprocess.run(args,check=True,capture_output=True,timeout=timeout,
            creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    except FileNotFoundError: raise ValueError('FFmpeg/FFprobe is missing from PATH') from None
    except subprocess.TimeoutExpired: raise ValueError('Video validation/conversion timed out') from None
    except subprocess.CalledProcessError: raise ValueError('FFmpeg could not decode or convert this video') from None

def probe(path, config):
    if not candidate(path): raise ValueError('Unsupported or temporary video file')
    if not 1024 <= path.stat().st_size <= config.max_bytes: raise ValueError('Video is empty, too small or exceeds the upload limit')
    data = json.loads(run_media(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(path)]).stdout)
    streams = data.get('streams',[])
    video = next((s for s in streams if s.get('codec_type')=='video' and not s.get('disposition',{}).get('attached_pic')),None)
    if not video: raise ValueError('No usable video stream')
    duration = float(data.get('format',{}).get('duration',0))
    width,height = int(video.get('width',0)),int(video.get('height',0))
    rotation = next((s.get('rotation',0) for s in video.get('side_data_list',[]) if 'rotation' in s),0)
    if abs(int(rotation)) % 180: width,height = height,width
    if not math.isfinite(duration) or not 0.5 <= duration <= config.max_seconds: raise ValueError('Video duration must be 0.5–180 seconds for this Shorts pipeline')
    if width <= 0 or height < width: raise ValueError('YouTube Shorts output must be portrait or square')
    return {'duration':duration,'width':width,'height':height,'codec':video.get('codec_name'),
        'pixel_format':video.get('pix_fmt'),'rotation':rotation,
        'audio':next((s.get('codec_name') for s in streams if s.get('codec_type')=='audio'),None)}

def full_decode(path):
    run_media(['ffmpeg','-nostdin','-v','error','-xerror','-i',str(path),'-map','0:v:0','-map','0:a:0?', '-f','null','-'])

def stage(path, digest, config, info=None):
    before = fingerprint(path)
    if not candidate(path) or not 1024 <= before[0] <= config.max_bytes:
        raise ValueError('Unsupported, temporary, empty or oversized video')
    if info and info['sha256'] != digest: raise ValueError('Completion marker hash does not match the video')
    directory = config.data / 'spool'
    directory.mkdir(parents=True,exist_ok=True)
    original = directory / (digest+'.source'+path.suffix.lower())
    final = directory / (digest+'.mp4')
    try:
        shutil.copyfile(path, original)
        if fingerprint(path)!=before or file_hash(original)!=digest: raise ValueError('Video changed while creating the upload snapshot')
        details = probe(original,config)
        full_decode(original)
        if (path.suffix.lower()=='.mp4' and details['codec']=='h264' and details['audio'] in (None,'aac')
                and details['pixel_format']=='yuv420p' and not details['rotation']):
            os.replace(original,final)
        else:
            temporary = directory / (digest+'.converting.mp4')
            run_media(['ffmpeg','-nostdin','-v','error','-y','-i',str(original),'-map','0:v:0','-map','0:a:0?',
                '-vf','pad=ceil(iw/2)*2:ceil(ih/2)*2','-c:v','libx264','-preset','medium','-crf','20',
                '-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart',str(temporary)],timeout=1800)
            os.replace(temporary,final)
            original.unlink(missing_ok=True)
            full_decode(final)
        details = probe(final,config)
        return final, details
    except Exception:
        original.unlink(missing_ok=True)
        (directory / (digest+'.converting.mp4')).unlink(missing_ok=True)
        raise

def mark_ready(path, config, publish=False):
    path = Path(path).resolve()
    wait_stable(path,config.stability)
    before = fingerprint(path)
    details = probe(path,config)
    full_decode(path)
    digest = file_hash(path)
    if fingerprint(path)!=before: raise ValueError('Video changed during validation')
    data = {'schema':1,'complete':True,'filename':path.name,'size':before[0],'sha256':digest,
        'publish':publish,'source':'blur-publisher-local-validation','validation':details}
    file = marker_path(path)
    temporary = file.with_name(file.name+'.'+uuid.uuid4().hex+'.tmp')
    temporary.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
    os.replace(temporary,file)
    return data

