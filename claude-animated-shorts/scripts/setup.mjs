import fs from 'node:fs';
import { capture, ensureDir, prepareCache, python, resolve, run, runNpm } from './runtime.mjs';

try {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Node.js 22 or later is required.');
  for (const tool of ['ffmpeg', 'ffprobe']) capture(tool, ['-version']);
  prepareCache();
  ensureDir(resolve('projects'));
  console.log('Installing the locked JavaScript dependencies...');
  runNpm([fs.existsSync(resolve('package-lock.json')) ? 'ci' : 'install', '--no-fund']);
  let hasUv = true;
  try { capture('uv', ['--version']); } catch { hasUv = false; }
  if (!fs.existsSync(python)) {
    if (hasUv) run('uv', ['venv', '--python', 'python', '.venv']);
    else run('python', ['-m', 'venv', '.venv']);
  }
  console.log('Installing the locked Python dependencies...');
  if (hasUv) run('uv', ['pip', 'sync', '--python', python, 'requirements.txt']);
  else run(python, ['-m', 'pip', 'install', '-r', 'requirements.txt']);
  run(python, [resolve('scripts/assets.py')]);
  run(process.execPath, [resolve('scripts/cli.mjs'), 'install-skill']);
  run(process.execPath, [resolve('scripts/doctor.mjs')]);
  if (!process.argv.includes('--skip-render')) run(process.execPath, [resolve('scripts/cli.mjs'), 'smoke']);
  console.log('Setup complete. Start the preview with npm run studio.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
