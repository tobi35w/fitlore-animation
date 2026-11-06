import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const python = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
export const pythonEnv = { ...process.env, PYTHONUTF8: '1', PYTHONUNBUFFERED: '1' };
export const resolve = (...parts) => path.resolve(root, ...parts);
export function ensureDir(directory) { fs.mkdirSync(directory, { recursive: true }); return directory; }
export function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }
export function writeJson(file, value) { ensureDir(path.dirname(file)); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
export function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, { cwd: root, stdio: 'inherit', windowsHide: true, env: pythonEnv, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(executable)} exited with ${result.status ?? result.signal}`);
  return result;
}
export function capture(executable, args) {
  const result = spawnSync(executable, args, { cwd: root, encoding: 'utf8', windowsHide: true, env: pythonEnv, timeout: 30000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error((result.stderr || `${executable} failed`).trim());
  return result.stdout.trim();
}
export function findBrowser() {
  const candidates = [process.env.CHROME_PATH, process.env.REMOTION_BROWSER_EXECUTABLE,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  return candidates.find((file) => file && fs.existsSync(file));
}
export function prepareCache() {
  const tmp = ensureDir(process.env.REMOTION_TMP || resolve('.cache/remotion'));
  process.env.TEMP = process.env.TMP = process.env.TMPDIR = tmp;
  return tmp;
}
export function safeSlug(value) {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value || '')) throw new Error('Use a project name such as my-first-short (lowercase letters, digits and hyphens).');
  return value;
}
export function projectPaths(slug) {
  safeSlug(slug);
  const directory = resolve('projects', slug);
  if (!fs.existsSync(path.join(directory, 'project.json'))) throw new Error(`Project ${slug} does not exist. Run npm run new -- ${slug}`);
  return { directory, configPath: path.join(directory, 'project.json'), publicDir: resolve('public/projects', slug), output: resolve('out', slug) };
}
export function skillDirectory() {
  return path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'skills', 'animated-shorts-workflow');
}
export function runNpm(args) {
  const candidates = [process.env.npm_execpath,
    path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    '/usr/lib/node_modules/npm/bin/npm-cli.js', '/usr/local/lib/node_modules/npm/bin/npm-cli.js'];
  const cli = candidates.find((file) => file && fs.existsSync(file));
  if (!cli) throw new Error('Cannot locate npm-cli.js. Run this command through npm.');
  return run(process.execPath, [cli, ...args]);
}
