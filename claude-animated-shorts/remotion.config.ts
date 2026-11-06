import { Config } from '@remotion/cli/config';
import path from 'node:path';

process.env.TEMP = process.env.TMP = process.env.REMOTION_TMP || path.resolve('.cache/remotion');
Config.setVideoImageFormat('jpeg');
Config.setCodec('h264');
Config.setCrf(18);
Config.setConcurrency(1);
Config.setChromiumOpenGlRenderer('angle');
Config.setDelayRenderTimeoutInMilliseconds(180000);
