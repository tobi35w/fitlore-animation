import { Pen } from './toon';

export const TRACKER = {columns:5, rows:6, previous:22, missed:22, later:7};
export type TrackerState = {before?:number; after?:number; mark?:number};

/** Identical physical tracker artwork for the held paper and the 3D prop. */
export function drawCalendar(p:Pen,x:number,y:number,w:number,h:number,state:TrackerState={}) {
  const before=state.before??22,after=state.after??0,unit=w/150;
  const rect=(xx:number,yy:number,ww:number,hh:number,col:string,line=1)=>p.poly([[xx,yy],[xx+ww,yy],[xx+ww,yy+hh],[xx,yy+hh]],col,line*unit);
  rect(x,y,w,h,'#e9e0c9',2.2);
  rect(x,y,w,h*.13,'#bb8570',1.5);
  for(const k of [.16,.5,.84]) {p.stroke([[x+w*k,y-4*unit],[x+w*k,y+10*unit]],3.2*unit,'#493b42');}
  const pad=w*.085,gap=w*.032,cw=(w-2*pad-4*gap)/5,ch=(h*.76-5*gap)/6;
  for(let i=0;i<30;i++) {
    const xx=x+pad+(i%5)*(cw+gap),yy=y+h*.18+Math.floor(i/5)*(ch+gap);
    // Future cells are inactive gray; the one missed day remains a clear cream square.
    rect(xx,yy,cw,ch,i===22?'#fff2d8':i>22?'#c9c2b1':'#eee8d5',i===22?1.15:i>22?.2:.55);
    const fill=i<22?Math.max(0,Math.min(1,before-i)):i===22?0:Math.max(0,Math.min(1,after-(i-23)));
    if(fill>0) rect(xx+unit,yy+ch*(1-fill)+unit,cw-2*unit,(ch-2*unit)*fill,i<22?'#73a390':'#66a98d',0);
  }
}
