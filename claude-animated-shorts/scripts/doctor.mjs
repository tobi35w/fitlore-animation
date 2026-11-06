import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { capture, findBrowser, python, readJson, resolve, skillDirectory, writeJson } from './runtime.mjs';
import { defaultVoice, listVoices } from './elevenlabs.mjs';

const results = [];
const warnings = [];
function check(name, fn) {
  try { const detail = fn(); results.push({ name, passed: true, detail }); console.log(`PASS ${name}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`); }
  catch (error) { results.push({ name, passed: false, detail: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
}
check('Node.js', () => {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Node 22 or later is required');
  return process.versions.node;
});
check('Python environment', () => JSON.parse(capture(python, ['-c',
  'import json,sys,numpy,scipy,PIL; print(json.dumps(dict(python=sys.version.split()[0],numpy=numpy.__version__,scipy=scipy.__version__,pillow=PIL.__version__)))'])));
for (const executable of ['ffmpeg', 'ffprobe']) check(executable, () => capture(executable, ['-version']).split('\n')[0]);
check('Browser', () => { const browser = findBrowser(); if (!browser) throw new Error('Install Chrome or Edge, or set REMOTION_BROWSER_EXECUTABLE'); return browser; });
check('Remotion versions', () => {
  const packages = ['remotion', '@remotion/three', '@remotion/cli', '@remotion/renderer', '@remotion/bundler', '@remotion/media'];
  const versions = packages.map((name) => readJson(resolve('node_modules', name, 'package.json')).version);
  if (new Set(versions).size !== 1) throw new Error('All Remotion packages must use the same version');
  return versions[0];
});
check('Native compiler', () => capture(process.execPath, ['-e', "require('esbuild').transformSync('const x: number = 1', {loader:'ts'}); console.log('esbuild ready')"]));
check('Kenney models', () => {
  const directory = resolve('public/bridge/kenney');
  const manifest = readJson(path.join(directory, 'manifest.json'));
  if (manifest.schemaVersion !== 2 || manifest.files.length !== 26) throw new Error('Run npm run assets to install all 26 self-contained models');
  for (const item of manifest.files) {
    const file = fs.readFileSync(path.join(directory, item.name + '.glb'));
    if (createHash('sha256').update(file).digest('hex') !== item.sha256) throw new Error(`Model checksum mismatch: ${item.name}`);
    const document = JSON.parse(file.subarray(20, 20 + file.readUInt32LE(12)).toString('utf8').trim());
    if ([...(document.images || []), ...(document.buffers || [])].some((entry) => entry.uri && !entry.uri.startsWith('data:'))) throw new Error(`External resource in ${item.name}`);
  }
  return '26 files, checksums and embedded textures verified';
});
check('Offline voices', () => {
  const voices = JSON.parse(capture('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', resolve('scripts/speech.ps1'), '-ListVoices']));
  if (!voices.some((voice) => voice.enabled)) throw new Error('No enabled Windows speech voice');
  return voices.filter((voice) => voice.enabled).map((voice) => voice.name);
});
try {
  const voices = await listVoices();
  check('ElevenLabs narration', () => {
    const voice = voices.find((entry) => entry.id === defaultVoice.voiceId);
    if (!voice) throw new Error('Configured ElevenLabs voice is not available. Use npm run voice -- --list.');
    return `${voice.name}; authenticated API access; ${defaultVoice.voiceModel}`;
  });
} catch (error) {
  check('ElevenLabs narration', () => { throw error; });
}
check('Workflow skill', () => {
  const file = path.join(skillDirectory(), 'SKILL.md');
  if (!fs.existsSync(file)) throw new Error('Run npm run skill:install');
  return file;
});
const passed = results.every((result) => result.passed);
try {
  const expectedZod = readJson(resolve('node_modules/@remotion/media/package.json')).dependencies.zod;
  const actualZod = readJson(resolve('node_modules/zod/package.json')).version;
  if (actualZod !== expectedZod) warnings.push(`Remotion requests Zod ${expectedZod}; the security-fixed ${actualZod} override triggers a Studio version warning. Validate the configured workflow when updating either dependency.`);
} catch { /* Missing packages have already been reported above. */ }
for (const warning of warnings) console.warn(`NOTE ${warning}`);
writeJson(resolve('out/setup-check/doctor.json'), { checkedAt: new Date().toISOString(), passed, results, warnings });
console.log(passed ? 'Environment checks passed.' : 'Fix the failed checks above.');
process.exitCode = passed ? 0 : 1;
