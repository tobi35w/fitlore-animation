import React from 'react';
import {Audio, getInputProps, staticFile} from 'remotion';
import type {ShortProps} from '../../types';
import {CharacterSheet} from './CharacterSheet';
import {TenThousandOriginShort} from './Bridge';
import {Captions} from './Captions';

export const Video: React.FC<ShortProps> = ({audioFile}) => {
  const study = (getInputProps() as {study?: string}).study;
  if (study === 'marcus' || study === 'neighbour') return <CharacterSheet who={study}/>;
  return (
    <>
      <TenThousandOriginShort/>
      <Captions/>
      {audioFile ? <Audio src={staticFile(audioFile)}/> : null}
    </>
  );
};
