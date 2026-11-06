import fs from 'node:fs';
import path from 'node:path';
import { ensureDir, projectPaths, python, readJson, resolve, run, writeJson } from './runtime.mjs';
import { defaultVoice, sha256, synthesize } from './elevenlabs.mjs';

export async function speech(slug, opts = {}) {
  const paths = projectPaths(slug);
  const config = readJson(paths.configPath);
  const provider = opts.provider || config.voiceProvider || defaultVoice.voiceProvider;
  const textFile = opts.text ? path.resolve(opts.text) : path.join(paths.directory, 'narration.txt');
  const text = fs.readFileSync(textFile, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
  if (!text) throw new Error('Write the spoken script in narration.txt before generating a voice.');
  const voiceDir = ensureDir(path.join(paths.directory, 'voice'));
  const timingFile = config.voiceTiming ? path.join(paths.directory, config.voiceTiming) : null;
  let voice;
  if (provider === 'elevenlabs') {
    const voiceId = opts.voice || config.voiceId || defaultVoice.voiceId;
    const modelId = opts.model || config.voiceModel || defaultVoice.voiceModel;
    const settings = { ...defaultVoice.voiceSettings, ...config.voiceSettings,
      ...(opts.speed ? { speed: Number(opts.speed) } : {}) };
    if (!Number.isFinite(settings.speed) || settings.speed < 0.7 || settings.speed > 1.2) throw new Error('ElevenLabs speed must be between 0.7 and 1.2.');
    const source = await synthesize({ text, voiceId, modelId, settings, refresh: opts.refresh });
    const keepDuration = opts['keep-duration'] || config.fixedDuration || timingFile;
    if (!timingFile && keepDuration && source.durationSeconds > config.durationInFrames / config.fps) {
      throw new Error('The voice is longer than the fixed picture. Extend the picture or adjust narration speed; the generated source is cached.');
    }
    let fitted = null;
    if (timingFile) {
      const plan = readJson(timingFile);
      if (Math.abs(plan.durationSeconds - config.durationInFrames / config.fps) > 0.001) throw new Error('Narration timing plan and picture duration differ.');
      const fittedDir = ensureDir(path.join(source.directory, 'fitted', sha256(fs.readFileSync(timingFile))));
      run(python, [resolve('scripts/fit-narration.py'), '--source', source.wav, '--words', source.wordsFile,
        '--text', textFile, '--plan', timingFile, '--out', fittedDir]);
      fitted = readJson(path.join(fittedDir, 'timing-report.json'));
      fs.copyFileSync(path.join(fittedDir, 'voice.wav'), path.join(voiceDir, 'voice.wav'));
      fs.copyFileSync(path.join(fittedDir, 'words.json'), path.join(voiceDir, 'words.json'));
    } else {
      fs.copyFileSync(source.wav, path.join(voiceDir, 'voice.wav'));
      writeJson(path.join(voiceDir, 'words.json'), source.words);
    }
    voice = { provider, voice: voiceId === defaultVoice.voiceId ? defaultVoice.voice : voiceId, voiceId, modelId, settings,
      durationSeconds: fitted?.durationSeconds ?? source.durationSeconds, sourceDurationSeconds: source.durationSeconds,
      sampleRate: 48000, channels: 1, wordCount: source.words.length, cached: source.cached,
      generatedAt: source.generatedAt, requestId: source.requestId, sourceFingerprint: source.fingerprint,
      alignmentMethod: fitted ? 'ElevenLabs character timestamps, remapped approximately through per-shot FFmpeg tempo changes' : 'ElevenLabs character timestamps',
      ...(fitted ? { timing: fitted, timingPath: timingFile, timingSha256: sha256(fs.readFileSync(timingFile)) } : {}) };
    config.voiceId = voiceId;
    config.voiceModel = modelId;
    config.voiceSettings = settings;
  } else if (provider === 'windows') {
    if (timingFile) throw new Error('Fixed shot narration currently uses ElevenLabs timestamps. Remove voiceTiming before using Windows narration.');
    if (process.platform !== 'win32') throw new Error('The offline fallback requires Windows speech voices.');
    run('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', resolve('scripts/speech.ps1'),
      '-TextPath', textFile, '-OutputWav', path.join(voiceDir, 'voice.wav'), '-WordsPath', path.join(voiceDir, 'words.json'),
      '-Voice', opts.voice || (config.voiceProvider === 'windows' ? config.voice : 'Microsoft David Desktop'), '-Rate', String(opts.rate ?? config.rate ?? 0)]);
    voice = { ...readJson(path.join(voiceDir, 'voice-info.json')), provider };
    config.rate = voice.rate;
  } else throw new Error('Voice provider must be elevenlabs or windows.');
  voice.scriptPath = textFile;
  voice.scriptSha256 = sha256(fs.readFileSync(textFile));
  writeJson(path.join(voiceDir, 'voice-info.json'), voice);
  config.audioFile = null;
  config.voiceProvider = provider;
  config.voice = voice.voice;
  writeJson(paths.configPath, config);
  if (opts['keep-duration'] || config.fixedDuration || timingFile) {
    if (voice.durationSeconds > config.durationInFrames / config.fps + 0.001) throw new Error('The voice is longer than the fixed project duration. Extend the picture before rendering.');
  } else config.durationInFrames = Math.ceil((voice.durationSeconds + 0.35) * config.fps);
  writeJson(paths.configPath, config);
  console.log(`${voice.voice} (${provider}): ${voice.durationSeconds.toFixed(2)} seconds. Run npm run audio -- ${slug} to refresh the soundtrack.`);
  return voice;
}
