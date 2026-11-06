import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export function invalidateReady(video) {
  fs.rmSync(video + '.ready.json', { force: true });
}

export function exportFingerprint(video) {
  const stat = fs.statSync(video, { bigint: true });
  return `${stat.size}:${stat.mtimeNs}`;
}

export async function writeReady(video, { report, renderInfo, beforeQA, publishingMetadata } = {}) {
  if (report?.passed !== true) throw new Error('A passing QA report is required before export completion.');
  if (!beforeQA || exportFingerprint(video) !== beforeQA) throw new Error('Video changed during QA. Run QA again.');
  if (renderInfo?.browserErrors?.length) throw new Error('Browser errors prevent export completion.');
  if (renderInfo?.requiredPictureGate && report?.pictureGate?.passed !== true) throw new Error('The required picture gate has not passed.');
  if (renderInfo?.requiredVisualReview && report?.visualReview?.passed !== true) throw new Error('The required visual/audio review has not passed.');
  const publish = renderInfo?.publish !== false && renderInfo?.completeExport === true && ['hd', 'final'].includes(renderInfo.quality);
  if (renderInfo?.frames && report.decodedFrames !== renderInfo.frames) throw new Error('QA frame count does not match the render.');
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(video)) hash.update(chunk);
  if (exportFingerprint(video) !== beforeQA) throw new Error('Video changed while hashing. Run QA again.');
  // User-authored metadata wins. A project may provide an optional publishing.json template.
  const metadataFile = video.replace(/\.[^.]+$/, '.json');
  if (publishingMetadata && fs.existsSync(publishingMetadata) && !fs.existsSync(metadataFile)) {
    const text = fs.readFileSync(publishingMetadata, 'utf8');
    const data = JSON.parse(text);
    if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('publishing.json must be an object');
    fs.writeFileSync(metadataFile, text, { flag: 'wx' });
  }
  const sha256 = hash.digest('hex');
  if (renderInfo?.requiredPictureGate && report.pictureGate.sha256 !== sha256) throw new Error('The picture gate was run on different video bytes.');
  if (renderInfo?.requiredVisualReview && report.visualReview.sha256 !== sha256) throw new Error('The visual review was for different video bytes.');
  const info = { schema: 1, complete: true, filename: path.basename(video), size: fs.statSync(video).size,
    sha256, publish, source: 'remotion-render-and-qa', completedAt: new Date().toISOString() };
  const marker = video + '.ready.json';
  const temporary = `${marker}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(info, null, 2) + '\n');
  fs.renameSync(temporary, marker);
  console.log(`Export complete: ${path.basename(video)}; publish=${publish}`);
  return info;
}
