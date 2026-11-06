import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { capture, ensureDir, findBrowser, prepareCache, projectPaths, python, readJson, resolve, root, run, skillDirectory, writeJson } from './runtime.mjs';
import { createProject, findProjectByComposition } from './projects.mjs';
import { render } from './render.mjs';
import { invalidateReady, exportFingerprint, writeReady } from './publish-ready.mjs';
import { speech } from './narration.mjs';
import { listVoices } from './elevenlabs.mjs';
import { strictGates } from './strict-gates.mjs';

const command = process.argv[2];
const { values: options, positionals } = parseArgs({ args: process.argv.slice(3), allowPositionals: true, options: {
  quality: { type: 'string', default: 'draft' }, frames: { type: 'string' }, out: { type: 'string' },
  voice: { type: 'string' }, rate: { type: 'string' }, text: { type: 'string' }, props: { type: 'string' },
  provider: { type: 'string' }, model: { type: 'string' }, speed: { type: 'string' }, refresh: { type: 'boolean' },
  port: { type: 'string', default: '3000' }, concurrency: { type: 'string', default: '1' },
  list: { type: 'boolean' }, 'keep-duration': { type: 'boolean' }, metadata: { type: 'string' }, help: { type: 'boolean' }
} });

function audio(slug) {
  const paths = projectPaths(slug);
  const config = readJson(paths.configPath);
  const audioDir = ensureDir(path.join(paths.directory, 'audio'));
  if (readJson(path.join(paths.directory, 'sound.json')).engine === 'steps') {
    run(python, [path.join(audioDir, 'mix.py')]);
  } else if (readJson(path.join(paths.directory, 'sound.json')).engine === 'bridge') {
    run(python, [resolve('scripts/bridge-audio.py'), '--project', paths.directory]);
  } else {
    run(python, [resolve('scripts/audio.py'), '--voice', path.join(paths.directory, 'voice/voice.wav'),
      '--words', path.join(paths.directory, 'voice/words.json'), '--cues', path.join(paths.directory, 'sound.json'),
      '--out', audioDir, '--duration', String(config.durationInFrames / config.fps)]);
  }
  const publicAudio = ensureDir(path.join(paths.publicDir, 'audio'));
  fs.copyFileSync(path.join(audioDir, 'mix.wav'), path.join(publicAudio, 'mix.wav'));
  config.audioFile = `projects/${slug}/audio/mix.wav`;
  writeJson(paths.configPath, config);
  return config;
}

async function qa(video, metadata, publishingMetadata) {
  const file = path.resolve(video);
  invalidateReady(file);
  const beforeQA = exportFingerprint(file);
  const args = [resolve('scripts/qa.py'), file, '--out', file.replace(/\.[^.]+$/, '') + '-qa'];
  if (fs.existsSync(file + '.json')) {
    const info = readJson(file + '.json');
    args.push('--expected', file + '.json', '--frame-offset', String(info.frameOffset || 0));
  }
  if (metadata) args.push('--metadata', path.resolve(metadata));
  run(python, args);
  const renderInfo = fs.existsSync(file + '.json') ? readJson(file + '.json') : {};
  const checked = strictGates(file, renderInfo, readJson(file.replace(/\.[^.]+$/, '') + '-qa/report.json'), metadata);
  if (!checked.ready) return { complete: false, output: file };
  return writeReady(file, { beforeQA, publishingMetadata, report: checked.report, renderInfo });
}

function verifyMix(project, quality) {
  if (!project) return;
  if (!project.config.audioFile) {
    const script = path.join(path.dirname(project.file), 'narration.txt');
    if (quality !== 'draft' && fs.readFileSync(script, 'utf8').trim()) throw new Error('This script has no current audio mix. Run the voice and audio commands before a delivery export.');
    return;
  }
  const directory = path.dirname(project.file);
  const info = readJson(path.join(directory, 'voice/voice-info.json'));
  const mix = readJson(path.join(directory, 'audio/audio-report.json'));
  const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (!info.scriptPath || hash(info.scriptPath) !== info.scriptSha256) throw new Error('Narration text changed. Regenerate the voice and audio before exporting.');
  if (info.timingPath && hash(info.timingPath) !== info.timingSha256) throw new Error('Narration timing changed. Regenerate the voice and audio before exporting.');
  if (hash(path.join(directory, 'voice/voice.wav')) !== mix.voiceSha256
      || hash(path.join(directory, 'voice/words.json')) !== mix.wordsSha256
      || hash(path.join(directory, 'sound.json')) !== mix.cuesSha256
      || Math.abs(mix.durationSeconds - project.config.durationInFrames / project.config.fps) > 0.001) {
    throw new Error('The mix is out of date. Run npm run audio -- ' + project.slug);
  }
  if (mix.timelineSha256 && hash(path.join(directory, 'timeline.json')) !== mix.timelineSha256) throw new Error('Shot timing changed. Regenerate the soundtrack.');
}

function installSkill() {
  const destination = ensureDir(skillDirectory());
  const file = path.join(destination, 'SKILL.md');
  const marker = '<!-- Managed by animated-shorts-workspace -->';
  if (fs.existsSync(file) && !fs.readFileSync(file, 'utf8').includes(marker)) {
    throw new Error(`An unrelated skill already exists at ${destination}. It was left intact.`);
  }
  const text = fs.readFileSync(resolve('workflow/SKILL.md'), 'utf8').replaceAll('{{PROJECT_ROOT}}', root.replaceAll('\\', '/'));
  fs.writeFileSync(file, text);
  console.log(`Installed workflow skill at ${destination}`);
}

async function smoke() {
  const slug = 'setup-check';
  const configFile = resolve('projects', slug, 'project.json');
  if (!fs.existsSync(configFile)) createProject(slug, { setupTest: true });
  if (!readJson(configFile).setupTest) throw new Error('The setup-check name belongs to a user project. It was left intact.');
  writeJson(resolve('out/setup-check/verification.json'), { checkedAt: new Date().toISOString(), status: 'running', passed: false });
  const config = readJson(configFile);
  config.durationInFrames = 120;
  writeJson(configFile, config);
  fs.writeFileSync(resolve('projects', slug, 'narration.txt'), 'Animation workflow ready.\n');
  writeJson(resolve('projects', slug, 'sound.json'), { targetLufs: -16,
    music: { enabled: true, bpm: 96, gainDb: -10, duckDb: -7 },
    sfx: [{ type: 'pop', at: 0.65, gainDb: -12 }, { type: 'chime', at: 2.7, duration: 0.7, gainDb: -12 }] });
  await speech(slug, { 'keep-duration': true });
  const mixed = audio(slug);
  run(process.execPath, [resolve('node_modules/typescript/bin/tsc'), '--noEmit']);
  const output = resolve('out/setup-check/workflow-check.mp4');
  const result = await render({ compositionId: 'WorkflowCheck', quality: 'draft', output,
    inputProps: { audioFile: mixed.audioFile } });
  await qa(output);
  await render({ compositionId: mixed.id, quality: 'draft', output: resolve('out/setup-check/starter-stills'), stillFrames: [30] });
  await render({ compositionId: 'BridgeShort', quality: 'final', output: resolve('out/setup-check/final-resolution'), stillFrames: [100] });
  for (const file of ['starter-stills/frame-0030.png', 'final-resolution/frame-0100.png']) {
    run(python, [resolve('scripts/qa.py'), resolve('out/setup-check', file), '--still', '--out', resolve('out/setup-check/still-qa')]);
  }
  writeJson(resolve('out/setup-check/verification.json'), { checkedAt: new Date().toISOString(), status: 'passed', passed: true,
    checks: ['ElevenLabs narration and word timestamps', 'music, effects and normalized stereo mix', 'TypeScript',
      '4-second H.264/AAC render', 'every-frame QA', 'new-project starter still', '1440x2560 bridge still'], ...result });
  console.log(`Workflow verification passed. ${output}`);
}

async function main() {
  if (options.help || !command) {
    console.log('Commands: studio | new <slug> | voice <slug> [--provider elevenlabs|windows] [--voice ID] [--speed 1.1] [--refresh] | audio <slug> | render <composition> [--quality draft|hd|final] [--frames 0-119] | stills <composition> --frames 100,500 | qa <video> | assets | smoke | install-skill');
    return;
  }
  if (command === 'new') return createProject(positionals[0]);
  if (command === 'assets') return run(python, [resolve('scripts/assets.py')]);
  if (command === 'install-skill') return installSkill();
  if (command === 'voice') {
    if (options.list) {
      if (options.provider === 'windows') return run('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', resolve('scripts/speech.ps1'), '-ListVoices']);
      for (const voice of await listVoices()) console.log(`${voice.id}  ${voice.name}`);
      return;
    }
    return await speech(positionals[0], options);
  }
  if (command === 'audio') return audio(positionals[0]);
  if (command === 'smoke') return smoke();
  if (command === 'qa') {
    if (!positionals[0]) throw new Error('Supply the video path.');
    return qa(positionals[0], options.metadata);
  }
  if (command === 'studio') {
    prepareCache();
    const browser = findBrowser();
    const args = [resolve('node_modules/@remotion/cli/remotion-cli.js'), 'studio', 'src/index.ts', '--port', options.port, '--no-open'];
    if (browser) args.push('--browser-executable', browser);
    return run(process.execPath, args);
  }
  if (command === 'render' || command === 'stills') {
    const compositionId = positionals[0] || 'BridgeShort';
    const project = findProjectByComposition(compositionId);
    if (command === 'render') verifyMix(project, options.quality);
    const outputBase = project?.slug || compositionId.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    const inputProps = options.props ? readJson(path.resolve(options.props)) : {};
    if (command === 'stills') {
      const stillFrames = (options.frames || '0').split(',').map(Number);
      return render({ compositionId, quality: options.quality, stillFrames, inputProps,
        output: options.out ? path.resolve(options.out) : resolve('out', outputBase, 'stills') });
    }
    if (options.frames && !/^\d+-\d+$/.test(options.frames)) throw new Error('Use --frames 0-119 (inclusive).');
    const frames = options.frames?.split('-').map(Number);
    const output = options.out ? path.resolve(options.out) : resolve('..', 'Rendered Videos', `${outputBase}-${options.quality}.mp4`);
    const result = await render({ compositionId, quality: options.quality, frames, inputProps, output, concurrency: Number(options.concurrency) });
    const metadata = options.metadata || (project ? resolve('projects', project.slug, 'shots.json') : undefined);
    await qa(output, metadata, project ? resolve('projects', project.slug, 'publishing.json') : undefined);
    return result;
  }
  throw new Error(`Unknown command ${command}. Use --help.`);
}

main().catch((error) => {
  if (command === 'smoke') writeJson(resolve('out/setup-check/verification.json'), {
    checkedAt: new Date().toISOString(), status: 'failed', passed: false, error: error.message });
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
