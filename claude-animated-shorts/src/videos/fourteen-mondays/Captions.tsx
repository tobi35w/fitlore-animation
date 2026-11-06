import React from 'react';
import {useCurrentFrame,useVideoConfig} from 'remotion';
import {createTikTokStyleCaptions,type Caption} from '@remotion/captions';
import data from '../../../projects/fourteen-mondays/captions.json';
import {smooth} from './story';

const sentences:Caption[][]=[];
let words:Caption[]=[];
for(const word of data as Caption[]){words.push(word);if(/[.!?]$/.test(word.text.trim())){sentences.push(words);words=[];}}
if(words.length)sentences.push(words);
const pages=sentences.flatMap(captions=>createTikTokStyleCaptions({captions,combineTokensWithinMilliseconds:900}).pages);
export const Captions:React.FC=()=>{
  const frame=useCurrentFrame(),{fps}=useVideoConfig(),now=frame/fps*1000;
  const index=pages.findIndex((p,i)=>now>=p.startMs&&now<(pages[i+1]?.startMs??p.startMs+p.durationMs));
  if(index<0)return null;
  const page=pages[index],last=page.tokens.at(-1)!;
  if(now>last.toMs+180)return null;
  const appear=smooth((frame-page.startMs/1000*fps)/4);
  return <div style={{position:'absolute',left:62,right:170,top:1430,display:'flex',justifyContent:'center',pointerEvents:'none',transform:`translateY(${5*(1-appear)}px)`}}>
    <div style={{maxWidth:'100%',padding:'13px 23px 16px',borderRadius:18,background:'rgba(30,22,33,.89)',fontFamily:'Arial, sans-serif',fontSize:58,fontWeight:800,lineHeight:1.12,textAlign:'center',color:'#fff7e9',boxShadow:'0 4px 10px rgba(22,16,22,.20)',whiteSpace:'normal'}}>
      {page.tokens.map((token,i)=><span key={i} style={{color:now>=token.fromMs&&now<token.toMs?'#ffdc91':'#fff7e9'}}>{token.text}</span>)}
    </div>
  </div>;
};
