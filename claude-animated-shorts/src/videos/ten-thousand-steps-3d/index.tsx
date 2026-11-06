import React from 'react';
import { Audio, getInputProps, staticFile } from 'remotion';
import type { ShortProps } from '../../types';
import { CharacterSheet } from './CharacterSheet';
import { StepsShort } from './Bridge';
export const Video: React.FC<ShortProps> = ({ audioFile }) => {
  const study = (getInputProps() as { study?: string }).study;
  if (study === 'marcus' || study === 'daughter') return <CharacterSheet daughter={study === 'daughter'} />;
  return <><StepsShort />{audioFile ? <Audio src={staticFile(audioFile)} /> : null}</>;
};
