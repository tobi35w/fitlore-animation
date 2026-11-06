import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileHash, validateVisualReview } from './strict-gates.mjs';
import { exportFingerprint, writeReady } from './publish-ready.mjs';

test('completion requires every sheet, audio and shot review for the exact export', () => {
  const sheets = ['sheet_0000.jpg', 'sheet_0060.jpg'];
  const review = { status: 'pass', videoSha256: 'current', inspectedSheets: sheets,
    audioReviewed: true, shotChecklistReviewed: true, unresolvedDefects: [] };
  assert.equal(validateVisualReview(review, 'current', sheets), true);
  for (const patch of [{ videoSha256: 'old' }, { inspectedSheets: sheets.slice(0, 1) },
    { audioReviewed: false }, { shotChecklistReviewed: false },
    { unresolvedDefects: ['Visible clipping'] }, { status: 'pending' }]) {
    assert.equal(validateVisualReview({ ...review, ...patch }, 'current', sheets), false);
  }
  assert.equal(validateVisualReview(review, 'current', []), false);
});

test('missing, failing or stale required gates cannot write a ready marker', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'steps-gates-'));
  const file = path.join(directory, 'export.mp4');
  try {
    fs.writeFileSync(file, 'render fixture');
    const sha256 = fileHash(file);
    const renderInfo = { requiredPictureGate: true, requiredVisualReview: true,
      quality: 'final', completeExport: true, publish: false, frames: 24 };
    const good = { passed: true, decodedFrames: 24,
      pictureGate: { passed: true, sha256 }, visualReview: { passed: true, sha256 } };
    for (const patch of [{ pictureGate: undefined }, { visualReview: undefined },
      { pictureGate: { passed: false, sha256 } }, { visualReview: { passed: false, sha256 } },
      { pictureGate: { passed: true, sha256: 'old' } },
      { visualReview: { passed: true, sha256: 'old' } }]) {
      await assert.rejects(writeReady(file, { report: { ...good, ...patch }, renderInfo,
        beforeQA: exportFingerprint(file) }));
      assert.equal(fs.existsSync(file + '.ready.json'), false);
    }
    const ready = await writeReady(file, { report: good, renderInfo, beforeQA: exportFingerprint(file) });
    assert.equal(ready.publish, false);
    assert.equal(ready.sha256, sha256);
  } finally {
    // Only remove this test's known files; no recursive deletion is needed.
    for (const name of ['export.mp4', 'export.mp4.ready.json']) {
      fs.rmSync(path.join(directory, name), { force: true });
    }
    fs.rmdirSync(directory);
  }
});
