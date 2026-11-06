import fs from 'node:fs';
import path from 'node:path';
import { invalidateReady } from './publish-ready.mjs';
import { findProjectByComposition } from './projects.mjs';
import { ensureDir, findBrowser, prepareCache, readJson, resolve, root, writeJson } from './runtime.mjs';

export const qualities = { draft: { scale: 0.5, crf: 23 }, hd: { scale: 1, crf: 18 }, final: { scale: 4 / 3, crf: 16 } };

export async function render({ compositionId, quality = 'draft', frames, output, stillFrames, inputProps = {}, concurrency = 1 }) {
  if (!qualities[quality]) throw new Error('Quality must be draft, hd or final.');
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error('Concurrency must be a positive integer.');
  const preset = qualities[quality];
  prepareCache();
  const browserExecutable = findBrowser();
  if (!browserExecutable) throw new Error('Chrome or Edge was not found. Set REMOTION_BROWSER_EXECUTABLE to a browser executable.');
  const { bundle } = await import('@remotion/bundler');
  const { selectComposition, renderMedia, renderStill } = await import('@remotion/renderer');
  console.log('Bundling animation source...');
  const serveUrl = await bundle({ entryPoint: resolve('src/index.ts'), publicDir: resolve('public'), outDir: resolve('.cache/bundle') });
  const props = { ...inputProps, ...(quality === 'draft' ? { post: { ...inputProps.post, dpr: 0.5 } } : {}) };
  const chromiumOptions = { gl: process.env.REMOTION_GL || 'angle' };
  const common = { serveUrl, browserExecutable, chromiumOptions, inputProps: props, timeoutInMilliseconds: 180000, logLevel: 'error' };
  const composition = await selectComposition({ ...common, id: compositionId });
  const frameRange = frames || [0, composition.durationInFrames - 1];
  if (frameRange.length !== 2 || frameRange.some((frame) => !Number.isInteger(frame) || frame < 0)
      || frameRange[0] > frameRange[1] || frameRange[1] >= composition.durationInFrames) {
    throw new Error(`Frame range must be within 0-${composition.durationInFrames - 1}.`);
  }
  const consoleErrors = new Set();
  const onBrowserLog = (entry) => {
    if (entry.type === 'error') consoleErrors.add(entry.text);
  };
  if (stillFrames) {
    ensureDir(output);
    for (const frame of stillFrames) {
      if (!Number.isInteger(frame) || frame < 0 || frame >= composition.durationInFrames) throw new Error(`Invalid still frame ${frame}`);
      const file = path.join(output, `frame-${String(frame).padStart(4, '0')}.png`);
      await renderStill({ ...common, composition, frame, output: file, imageFormat: 'png', scale: preset.scale, onBrowserLog });
      console.log(`Rendered ${file}`);
    }
    if (consoleErrors.size) throw new Error(`Browser errors: ${[...consoleErrors].join('\n')}`);
    return { output, composition };
  }
  ensureDir(path.dirname(output));
  invalidateReady(output);
  fs.rmSync(output + '.json', { force: true });
  let lastProgress = -1;
  const started = Date.now();
  await renderMedia({ ...common, composition, codec: 'h264', outputLocation: output, scale: preset.scale,
    frameRange, crf: preset.crf, pixelFormat: 'yuv420p', audioCodec: 'aac', audioBitrate: '192k',
    imageFormat: 'jpeg', jpegQuality: 90, concurrency, overwrite: true, onBrowserLog,
    onProgress: ({ progress }) => {
      const percent = Math.floor(progress * 10) * 10;
      if (percent !== lastProgress) { console.log(`Render ${percent}%`); lastProgress = percent; }
    } });
  const project = findProjectByComposition(compositionId);
  const report = { compositionId, quality, output, width: Math.round(composition.width * preset.scale),
    height: Math.round(composition.height * preset.scale), fps: composition.fps,
    frames: frameRange[1] - frameRange[0] + 1, frameOffset: frameRange[0],
    completeExport: !frames && compositionId !== 'WorkflowCheck',
    audio: Boolean(props.audioFile || composition.props.audioFile), secondsToRender: (Date.now() - started) / 1000,
    browser: browserExecutable, browserErrors: [...consoleErrors], sourceProject: root,
    projectSlug: project?.slug, requiredPictureGate: project?.config.pictureGate === true,
    requiredVisualReview: project?.config.visualReviewRequired === true, publish: project?.config.publish !== false };
  writeJson(output + '.json', report);
  if (consoleErrors.size) throw new Error(`Rendered with browser errors: ${[...consoleErrors].join('\n')}`);
  console.log(`Rendered ${output}`);
  return report;
}
