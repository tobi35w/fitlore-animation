import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { ensureDir, python, pythonEnv, readJson, resolve, writeJson } from './runtime.mjs';

export const fileHash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

export function validateVisualReview(review, sha256, sheets) {
  if (!review || review.status !== 'pass' || review.videoSha256 !== sha256) return false;
  const inspected = new Set(review.inspectedSheets || []);
  return sheets.length > 0 && sheets.every((name) => inspected.has(name))
    && review.audioReviewed === true && review.shotChecklistReviewed === true
    && Array.isArray(review.unresolvedDefects) && review.unresolvedDefects.length === 0;
}

/** Run the user's unchanged checker. A visual review is bound to the exact MP4 bytes. */
export function strictGates(video, info, report, metadata) {
  if (!info.requiredPictureGate && !info.requiredVisualReview) return { ready: true, report };
  if (!info.completeExport || !['hd', 'final'].includes(info.quality)) {
    console.log('Preview/chunk saved; no completion marker is issued for this project.');
    return { ready: false, report };
  }
  const base = ensureDir(resolve('out', info.projectSlug));
  const qaDir = ensureDir(path.join(base, 'qa', path.basename(video, '.mp4')));
  const checker = resolve('scripts/picture_gate.py');
  const supplied = resolve('../picture_gate.py');
  if (fs.existsSync(supplied) && fileHash(checker) !== fileHash(supplied)) {
    throw new Error('The installed picture gate differs from the supplied checker. Restore the unchanged checker.');
  }
  const sha256 = fileHash(video);
  const invoke = (args) => {
    const result = spawnSync(python, args, { encoding: 'utf8', env: pythonEnv, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
    if (result.error) throw result.error;
    return { output: (result.stdout || '') + (result.stderr || ''), code: result.status };
  };
  const gate = invoke([checker, video]);
  const diagnostic = invoke([resolve('scripts/short_qa.py'), video, qaDir, metadata || resolve('projects', info.projectSlug, 'shots.json')]);
  fs.writeFileSync(path.join(qaDir, 'picture-gate.txt'), gate.output);
  fs.writeFileSync(path.join(qaDir, 'short-qa.txt'), diagnostic.output);
  const picturePassed = gate.code === 0 && /^RESULT: PASS\s*$/m.test(gate.output);
  const sheets = fs.readdirSync(qaDir).filter((name) => /^sheet_\d+\.jpg$/.test(name)).sort();
  const reviewPath = path.join(qaDir, 'visual-review.json');
  const review = fs.existsSync(reviewPath) ? readJson(reviewPath) : null;
  const visualPassed = validateVisualReview(review, sha256, sheets);
  const checks = { ...report, pictureGate: { passed: picturePassed, sha256, checkerSha256: fileHash(checker), output: path.join(qaDir, 'picture-gate.txt') },
    visualReview: { passed: visualPassed, sha256, path: reviewPath, sheets: sheets.length } };
  const text = `# Ten Thousand Steps — export QA\n\nVideo: ${video}\n\nSHA-256: ${sha256}\n\n## Unmodified picture gate\n\n\`\`\`text\n${gate.output}\`\`\`\n\n## Every-frame diagnostics\n\n\`\`\`text\n${diagnostic.output}\`\`\`\n\n## Human-style visual and audio review\n\n${visualPassed ? 'PASS — every generated sheet and the audio reviewed; no unresolved defects.' : 'PENDING — the export is not complete.'}\n\nReview: ${reviewPath}\n`;
  fs.writeFileSync(path.join(qaDir, 'QA_REPORT.md'), text);
  fs.writeFileSync(path.join(base, 'QA_REPORT.md'), text);
  writeJson(path.join(qaDir, 'gate-summary.json'), checks);
  console.log(gate.output.trim());
  console.log(diagnostic.output.trim());
  if (!picturePassed || diagnostic.code !== 0) throw new Error('Required picture QA failed. Fix and render a new version; no completion marker was written.');
  if (!visualPassed) console.log(`Picture gate passed; visual/audio review is pending at ${reviewPath}. No completion marker written.`);
  return { ready: visualPassed, report: checks };
}
