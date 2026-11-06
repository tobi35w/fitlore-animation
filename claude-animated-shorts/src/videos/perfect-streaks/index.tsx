import React from 'react';
import {Audio,getInputProps,staticFile} from 'remotion';
import type {ShortProps} from '../../types';
import {CharacterSheet} from './CharacterSheet';
import {StreaksShort} from './Bridge';
import {Captions} from './Captions';
export const Video:React.FC<ShortProps>=({audioFile})=>{
  const study=(getInputProps() as {study?:string}).study;
  if(study==='marcus'||study==='builder')return <CharacterSheet who={study}/>;
  return <><StreaksShort/><Captions/>{audioFile?<Audio src={staticFile(audioFile)}/>:null}</>;
};
