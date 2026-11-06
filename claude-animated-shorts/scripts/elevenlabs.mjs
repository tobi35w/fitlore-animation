import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { capture, ensureDir, readJson, resolve, writeJson } from './runtime.mjs';

export const defaultVoice = readJson(resolve('workflow/voice.json'));
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export function apiKey() {
  const file = resolve('.secrets/elevenlabs-api-key');
  const key = process.env.ELEVENLABS_API_KEY?.trim() || (fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : '');
  if (!key) throw new Error('ElevenLabs is not configured. Set ELEVENLABS_API_KEY or save it in .secrets/elevenlabs-api-key.');
  return key;
}

async function request(endpoint, body) {
  const key = apiKey();
  const response = await fetch(`https://api.elevenlabs.io${endpoint}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    const message = typeof detail.detail === 'string' ? detail.detail : detail.detail?.message || response.statusText;
    throw new Error(`ElevenLabs ${response.status}: ${String(message).replaceAll(key, '[redacted]')}`);
  }
  return response;
}

export async function listVoices() {
  const response = await request('/v1/voices');
  return (await response.json()).voices.map((v) => ({ id: v.voice_id, name: v.name, labels: v.labels }));
}

export function alignmentWords(alignment) {
  const { characters, character_start_times_seconds: starts, character_end_times_seconds: ends } = alignment || {};
  if (!Array.isArray(characters) || !characters.length || starts?.length !== characters.length || ends?.length !== characters.length) {
    throw new Error('ElevenLabs did not return complete character timestamps. The original response is cached.');
  }
  const words = [];
  let word = null;
  for (let i = 0; i < characters.length; i++) {
    if (!Number.isFinite(starts[i]) || !Number.isFinite(ends[i]) || starts[i] < 0 || ends[i] < starts[i]) throw new Error('Invalid character timestamps.');
    if (/^\s+$/u.test(characters[i])) {
      if (word) words.push(word);
      word = null;
    } else {
      if (!word) word = { w: '', s: starts[i], e: ends[i] };
      word.w += characters[i];
      word.e = Math.max(word.e, ends[i]);
    }
  }
  if (word) words.push(word);
  if (!words.length) throw new Error('ElevenLabs returned no word timestamps.');
  return words;
}

export async function synthesize({ text, voiceId, modelId, settings, refresh = false }) {
  if (!text.trim()) throw new Error('The narration script is empty.');
  if (!/^[a-zA-Z0-9_-]+$/.test(voiceId)) throw new Error('Supply an ElevenLabs voice ID from npm run voice -- --list.');
  const outputFormat = 'mp3_44100_128';
  const body = { text, model_id: modelId, voice_settings: settings, seed: 1831 };
  const fingerprint = sha256(JSON.stringify({ voiceId, outputFormat, body }));
  const directory = ensureDir(resolve('.cache/elevenlabs', fingerprint));
  const mp3 = path.join(directory, 'source.mp3');
  const alignmentFile = path.join(directory, 'alignment.json');
  const infoFile = path.join(directory, 'response-info.json');
  let cached = !refresh && [mp3, alignmentFile, infoFile].every(fs.existsSync);
  if (!cached) {
    console.log(`Generating ElevenLabs narration (${text.length} characters, ${modelId})...`);
    // Do not automatically retry a paid generation after an ambiguous network failure.
    const response = await request(`/v1/text-to-speech/${voiceId}/with-timestamps?output_format=${outputFormat}`, body);
    const result = await response.json();
    if (!result.audio_base64) throw new Error('ElevenLabs returned no audio.');
    fs.writeFileSync(mp3, Buffer.from(result.audio_base64, 'base64'));
    writeJson(alignmentFile, { alignment: result.alignment, normalized_alignment: result.normalized_alignment });
    writeJson(infoFile, { generatedAt: new Date().toISOString(), requestId: response.headers.get('request-id'),
      characters: text.length, fingerprint, voiceId, modelId, settings, outputFormat });
  } else console.log('Using cached ElevenLabs narration (no generation credits used).');
  const alignments = readJson(alignmentFile);
  const alignment = alignments.alignment || alignments.normalized_alignment;
  const words = alignmentWords(alignment);
  const wordsFile = path.join(directory, 'source-words.json');
  writeJson(wordsFile, words);
  const wav = path.join(directory, 'source.wav');
  capture('ffmpeg', ['-v', 'error', '-y', '-i', mp3, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', wav]);
  const durationSeconds = Number(capture('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', wav]));
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || words.at(-1).e > durationSeconds + 0.1) throw new Error('Generated audio and timestamps do not agree.');
  return { directory, wav, wordsFile, words, durationSeconds, cached, ...readJson(infoFile) };
}
