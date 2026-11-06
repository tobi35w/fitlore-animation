"""Replace this provider to add AI captions later; publishing code stays unchanged."""
import json
import re
from datetime import datetime, timezone


def normalize_scheduled_for(value):
    if not isinstance(value, str): raise ValueError('scheduled_for must be an ISO 8601 datetime with a timezone')
    try:
        scheduled = datetime.fromisoformat(value.strip().replace('Z', '+00:00'))
    except ValueError:
        raise ValueError('scheduled_for must be an ISO 8601 datetime with a timezone') from None
    if scheduled.utcoffset() is None: raise ValueError('scheduled_for must include a timezone')
    return scheduled.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')

def load_metadata(video, default_hashtags='#shorts'):
    file = video.with_suffix('.json')  # Publishing metadata; .mp4.json is renderer metadata.
    if file.exists() and file.stat().st_size > 65536: raise ValueError('Publishing metadata exceeds 64 KB')
    data = json.loads(file.read_text(encoding='utf-8-sig')) if file.exists() else {}
    if not isinstance(data, dict): raise ValueError('Metadata must be a JSON object')
    if 'publish' in data and not isinstance(data['publish'], bool): raise ValueError('publish must be a JSON boolean')
    platforms = data.get('platforms', ['youtube','tiktok'])
    if (not isinstance(platforms,list) or not platforms or
            any(p not in ('youtube','tiktok') for p in platforms) or len(set(platforms)) != len(platforms)):
        raise ValueError('platforms must be a nonempty list of unique youtube/tiktok targets')
    name = re.sub(r'([a-z])([A-Z])', r'\1 \2', video.stem)
    name = re.sub(r'(?i)[_-](final|draft|preview|hd|v\d+)(?=$|[_-])', '', name)
    name = re.sub(r'[_-]+', ' ', name).strip() or 'New video'
    generated = ' '.join(name.split())
    def text(key, default):
        val = data.get(key, default)
        if not isinstance(val, str): raise ValueError(f'{key} must be text')
        return val.strip()
    title = text('youtube_title', generated[:100])
    caption = text('caption', generated)
    hashtags = text('hashtags', default_hashtags)
    description = text('youtube_description', caption + ('\n\n'+hashtags if hashtags else ''))
    if not title or len(title) > 100 or any(c in title for c in '<>'): raise ValueError('YouTube title must be 1–100 characters without < or >')
    if len(description) > 5000: raise ValueError('YouTube description exceeds 5,000 characters')
    if len((caption+' '+hashtags).encode('utf-16-le')) // 2 > 2200: raise ValueError('Caption and hashtags exceed 2,200 characters')
    if hashtags and any(not re.fullmatch(r'#[\w]+', h) for h in hashtags.split()): raise ValueError('hashtags must contain space-separated #tags')
    result = {'caption':caption,'hashtags':hashtags,'youtube_title':title,'youtube_description':description,
        'publish':data.get('publish',True),'platforms':platforms}
    if 'scheduled_for' in data: result['scheduled_for'] = normalize_scheduled_for(data['scheduled_for'])
    return result

