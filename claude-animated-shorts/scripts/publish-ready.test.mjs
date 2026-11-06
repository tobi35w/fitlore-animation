import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { exportFingerprint, invalidateReady, writeReady } from './publish-ready.mjs';

test('only complete delivery exports are publishable, and invalidation removes the marker', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blur-ready-'));
  try {
    const file = path.join(directory, 'test.mp4');
    fs.writeFileSync(file, 'test bytes');
    for (const [quality, completeExport, expected] of [['final',true,true],['hd',true,true],['draft',true,false],['final',false,false]]) {
      invalidateReady(file);
      const result = await writeReady(file, { report: {passed:true,decodedFrames:24},
        renderInfo:{quality,completeExport,frames:24},beforeQA:exportFingerprint(file) });
      assert.equal(result.publish, expected);
      assert.equal(result.sha256,createHash('sha256').update('test bytes').digest('hex'));
      assert.deepEqual(JSON.parse(fs.readFileSync(file+'.ready.json')),result);
    }
    invalidateReady(file);
    assert.equal(fs.existsSync(file+'.ready.json'),false);
    await assert.rejects(writeReady(file,{report:{passed:false},beforeQA:exportFingerprint(file)}));
    await assert.rejects(writeReady(file,{report:{passed:true},beforeQA:'stale'}));
    assert.equal(fs.existsSync(file+'.ready.json'),false);
  } finally { fs.rmSync(directory,{recursive:true,force:true}); }
});

test('project publishing metadata is copied once and user edits survive', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'blur-metadata-'));
  try {
    const file = path.join(directory,'video.mp4'); fs.writeFileSync(file,'test bytes');
    const template=path.join(directory,'publishing.json'); fs.writeFileSync(template,'{"caption":"Template"}');
    const options={report:{passed:true},beforeQA:exportFingerprint(file),publishingMetadata:template};
    await writeReady(file,options);
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory,'video.json'))).caption,'Template');
    fs.writeFileSync(path.join(directory,'video.json'),'{"caption":"User edit"}');
    invalidateReady(file); await writeReady(file,options);
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory,'video.json'))).caption,'User edit');
  } finally { fs.rmSync(directory,{recursive:true,force:true}); }
});
