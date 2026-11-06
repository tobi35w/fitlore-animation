import timeline from '../../../projects/ten-thousand-steps-3d/timeline.json';
export type V3 = [number,number,number];
export type LightName = 'day' | 'golden' | 'blue';
export type ShotDef = {id:number;title:string;a:number;b:number;location:string;light:LightName;cameraType:string;pos:V3;end:V3;look:V3;lookEnd:V3;dof:number;action:string;props:string;travel:boolean;words:string};
export const FPS=timeline.fps,TOTAL=timeline.total,SHOTS=timeline.shots as ShotDef[],EVENTS=timeline.events;
export const clamp01=(t:number)=>Math.max(0,Math.min(1,t));
export const smooth=(t:number)=>{const x=clamp01(t);return x*x*x*(x*(x*6-15)+10);};
const lerp3=(a:V3,b:V3,t:number):V3=>a.map((v,i)=>v+(b[i]-v)*t) as V3;
export const eventFrame=(name:string)=>EVENTS.find(e=>e.name===name)!.frame;
export function shotAt(f:number){return SHOTS.find(s=>f>=s.a&&f<s.b)??SHOTS.at(-1)!;}
export function layersAt(f:number){const s=shotAt(f),fade=timeline.xfade.find(([a,b])=>f>=a&&f<b);return fade&&s.id>1?[{id:s.id-1,alpha:1},{id:s.id,alpha:(f-fade[0]+1)/(fade[1]-fade[0])}]:[{id:s.id,alpha:1}];}
export function camAt(id:number,f:number){
  const s=SHOTS[id-1],lf=Math.max(0,f-s.a),u=clamp01(lf/(s.b-s.a-1));
  const t=.9*u+.1*smooth(lf/30),look=lerp3(s.look,s.lookEnd,u),raw=lerp3(s.pos,s.end,t),push=Math.exp(-.0017*lf);
  const pos=raw.map((v,i)=>look[i]+(v-look[i])*push) as V3;
  let kick=0;for(const e of EVENTS)if(e.shot===id){const k=f-e.frame;if(k>=0&&k<7)kick+=.006*(1-k/7)*(k%2?1:-1);}
  pos[0]+=kick;pos[1]+=kick*.45;
  const roll=(id%3-1)*.022*(1-u)+.01*(u-.5);
  return {pos,look,roll,fov:id===12||id===13?42:40};
}
export const dofAt=(f:number)=>({cInf:shotAt(f).dof});
