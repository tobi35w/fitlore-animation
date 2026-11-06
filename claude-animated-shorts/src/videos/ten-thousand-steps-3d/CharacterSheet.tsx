import React, { useEffect, useRef, useState } from 'react';
import { continueRender, delayRender } from 'remotion';
import { Pen, type Expr } from './toon';
import { MARCUS, DAUGHTER, drawPerson, type PersonPose } from './character';

/** Production study only; this canvas is never used in the film. */
export const CharacterSheet: React.FC<{ daughter?: boolean }> = ({ daughter=false }) => {
  const ref=useRef<HTMLCanvasElement>(null),[wait]=useState(()=>delayRender('character construction sheet'));
  useEffect(()=>{
    const g=ref.current!.getContext('2d')!,who=daughter?DAUGHTER:MARCUS;
    g.fillStyle='#ece6dc';g.fillRect(0,0,1080,1920);
    g.fillStyle='#30252f';g.font='bold 42px Arial';g.fillText(who.name+' · character construction',36,63);
    g.font='22px Arial';g.fillText('Bean proportions · connected joints · planted soles · prop contact',36,103);
    const items:[string,PersonPose][]=[['Front',{}],['Side',{side:true}],...([0,.25,.5,.75].map(v=>['Walk '+v,{side:true,walking:true,phase:v,stride:.58}] as [string,PersonPose])),
      ...(['neutral','stern','nervous','shock','relief','smile'] as Expr[]).map(expr=>[expr,{expr}] as [string,PersonPose]),
      ...(daughter?[['Pack in hand',{prop:'backpack'}],['Pack worn',{side:true,backpack:true}],['Coin',{prop:'coin'}],['Joined hand',{hands:{left:[140,650]},backpack:true}]] as [string,PersonPose][]:[['Watch raised',{watch:1}],['Grocery bag',{prop:'bag',walking:true,phase:.1}],['Dinner bowl',{prop:'bowl'}],['Coin',{prop:'coin'}]] as [string,PersonPose][]),
      ['Side with prop',{side:true,prop:daughter?'backpack':'bag'}],['Blink',{blink:1}],['Front walk',{walking:true,phase:.25}],['Reach',{hands:{right:[460,650]}}]];
    items.forEach(([label,pose],i)=>{const x=28+(i%4)*263,y=143+Math.floor(i/4)*348;
      g.fillStyle='#f7f1e7';g.fillRect(x,y,246,330);g.strokeStyle='#d2c8bd';g.strokeRect(x,y,246,330);
      g.fillStyle='#4b3c44';g.font='20px Arial';g.fillText(label,x+12,y+29);
      g.save();g.translate(x+23,y-18);g.scale(.335,.335);drawPerson(new Pen(g),who,pose);g.restore();
      g.strokeStyle='#b1a092';g.lineWidth=1;g.beginPath();g.moveTo(x+55,y+309);g.lineTo(x+190,y+309);g.stroke();
    });continueRender(wait);
  },[daughter,wait]);
  return <canvas ref={ref} width={1080} height={1920} style={{width:1080,height:1920}}/>;
};
