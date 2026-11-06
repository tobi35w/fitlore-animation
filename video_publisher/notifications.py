"""Local terminal/file notifications; credentials and URLs never enter logs."""
import json
import logging
from logging.handlers import RotatingFileHandler
import re
import sys
from datetime import datetime, timezone

def redact(value):
    text = str(value)
    text = re.sub(r'sp_[A-Za-z0-9_-]+', '[API KEY REDACTED]', text)
    text = re.sub(r'https?://[^\s\"\'<>]+', '[URL REDACTED]', text)
    text = re.sub(r'(?i)(x-api-key|authorization|x-amz-signature)\s*[:=]\s*\S+', r'\1=[REDACTED]', text)
    return text

class SafeFormatter(logging.Formatter):
    def format(self, record): return redact(super().format(record))

def setup(root):
    directory = root / 'logs'
    directory.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger('blur')
    logger.setLevel(logging.INFO)
    logger.handlers.clear()
    formatter = SafeFormatter('%(asctime)s [BLUR PUBLISHER] %(message)s')
    handlers = [RotatingFileHandler(directory / 'publisher.log', maxBytes=2_000_000, backupCount=4, encoding='utf-8')]
    if sys.stdout is not None: handlers.append(logging.StreamHandler(sys.stdout))
    for handler in handlers:
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    logging.getLogger('urllib3').setLevel(logging.WARNING)
    return logger

def notify(config, message, level='info'):
    safe = redact(message)
    getattr(logging.getLogger('blur'), level)(safe)
    config.data.mkdir(parents=True, exist_ok=True)
    with (config.data / 'notifications.jsonl').open('a', encoding='utf-8') as stream:
        stream.write(json.dumps({'at': datetime.now(timezone.utc).isoformat(), 'level': level, 'message': safe}) + '\n')

