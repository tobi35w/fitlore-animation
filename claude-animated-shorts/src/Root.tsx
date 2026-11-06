import React from 'react';
import { Composition, Folder, staticFile } from 'remotion';
import { Audio } from '@remotion/media';
import { BridgeShort, BRIDGE_FRAMES } from './videos/bridge/Bridge';
import { projects } from './project-registry';
import type { ShortProps } from './types';
import bridgeConfig from '../projects/bridge/project.json';
import setupConfig from '../projects/setup-check/project.json';

const BridgeWithAudio: React.FC<ShortProps> = ({ audioFile }) => (
  <>
    <BridgeShort />
    {audioFile ? <Audio src={staticFile(audioFile)} /> : null}
  </>
);

export const RemotionRoot: React.FC = () => (
  <>
    <Folder name="Examples">
      <Composition id="BridgeShort" component={BridgeWithAudio} durationInFrames={BRIDGE_FRAMES}
        fps={30} width={1080} height={1920} defaultProps={{ audioFile: bridgeConfig.audioFile }} />
    </Folder>
    <Folder name="Checks">
      <Composition id="WorkflowCheck" component={BridgeWithAudio} durationInFrames={120}
        fps={30} width={1080} height={1920} defaultProps={{ audioFile: setupConfig.audioFile }} />
    </Folder>
    <Folder name="Projects">
      {projects.map(({ component, audioFile, ...settings }) => (
        <Composition key={settings.id} {...settings} component={component} defaultProps={{ audioFile }} />
      ))}
    </Folder>
  </>
);
