import { Pen, INK, headBlob, blobPts, thickAngle, mul, mix, faceFront, faceSide, type Blob, type Expr } from './toon';

export type P2 = [number, number];
export type Person = { name: string; seed: number; build: 'stout' | 'kid' | 'adult'; skin: string; shirt: string; pants: string; shoes: string; hair: string; beard?: boolean; puffs?: boolean; watch?: boolean };
export const MARCUS: Person = { name: 'Marcus', seed: 17, build: 'stout', skin: '#c99069', shirt: '#90939a', pants: '#727955', shoes: '#ec8a3b', hair: '#30282b', beard: true, watch: true };
export const DAUGHTER: Person = { name: 'Daughter', seed: 29, build: 'kid', skin: '#d49a70', shirt: '#4baca4', pants: '#795479', shoes: '#f5e5c6', hair: '#35272c', puffs: true };
export const NEIGHBORS: Person[] = [
  { name: 'Neighbor A', seed: 33, build: 'adult', skin: '#edc3a1', shirt: '#bc706c', pants: '#485475', shoes: '#755843', hair: '#665045' },
  { name: 'Neighbor B', seed: 38, build: 'stout', skin: '#ae775c', shirt: '#d3ab62', pants: '#536b79', shoes: '#543d40', hair: '#40343c' },
];
export type PersonPose = { side?: boolean; phase?: number; walking?: boolean; stride?: number; expr?: Expr; blink?: number; breath?: number; watch?: number; watchProgress?: number; prop?: 'bag' | 'bowl' | 'backpack' | 'coin'; backpack?: boolean; hands?: { left?: P2; right?: P2 }; look?: number; headTilt?: number; light?: number };
const TAU = Math.PI * 2, SU = 0.00216;
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a: P2, b: P2, t: number): P2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const arcLine = (a: P2, e: P2, b: P2): P2[] => Array.from({ length: 13 }, (_, i) => { const t = i / 12, u = 1 - t; return [u*u*a[0] + 2*u*t*e[0] + t*t*b[0], u*u*a[1] + 2*u*t*e[1] + t*t*b[1]]; });
const knee = (a: P2, b: P2, len: number): P2 => { const dx = b[0]-a[0], dy=b[1]-a[1], d=clamp(Math.hypot(dx,dy),1,len*2-.01), q=Math.atan2(dy,dx)-Math.acos(d/(len*2)); return [a[0]+len*Math.cos(q),a[1]+len*Math.sin(q)]; };
const rounded = (x: number, y: number, w: number, h: number, r: number): P2[] => {
  const pts: P2[]=[]; for(const [cx,cy,st] of [[x+w-r,y+r,-90],[x+w-r,y+h-r,0],[x+r,y+h-r,90],[x+r,y+r,180]]) for(let i=0;i<=8;i++){const a=(st+i*90/8)*Math.PI/180;pts.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);} return pts;
};

/** Watch face has only an animated progress ring, never text, numerals or a logo. */
export const drawWatch = (p: Pen, wrist: P2, angle: number, progress = .7, size = 1) => {
  const pts=(q:P2[]):P2[]=>q.map(([x,y])=>[wrist[0]+size*(x*Math.cos(angle)-y*Math.sin(angle)),wrist[1]+size*(x*Math.sin(angle)+y*Math.cos(angle))]);
  p.poly(pts(rounded(-10,-17,20,34,6)), '#282a37', 3);
  p.poly(pts(rounded(-17,-14,34,28,7)), '#242735', 4);
  const old=p.rot; const [x,y]=p.P(...wrist); p.rot=null;
  p.ell(x,y,9*size,9*size,'#39444e',0);
  p.arc(x,y,8*size,8*size,-90,-90+360*clamp(progress),3*size,'#9fe4c7'); p.rot=old;
};

const held = (p: Pen, kind: NonNullable<PersonPose['prop']>, h: P2, u: number) => {
  const [x,y]=h;
  if(kind==='bag'||kind==='backpack') {
    p.arc(x,y+9*u,10*u,13*u,180,360,3*u,'#694936');
    p.poly(rounded(x-20*u,y+8*u,40*u,50*u,5*u),kind==='bag'?'#d3ad71':'#e68d79',2.2*u);
    p.stroke([[x-13*u,y+29*u],[x+13*u,y+29*u]],1.2*u,kind==='bag'?'#a48258':'#b9645e');
  } else if(kind==='bowl') {
    p.poly([[x-28*u,y-3*u],[x+27*u,y-3*u],[x+17*u,y+20*u],[x-15*u,y+20*u]],'#e9ddc3',2.2*u);
    p.ell(x,y-3*u,28*u,7*u,'#9a7246',2*u);
    for(let i=0;i<6;i++) p.dot(x+(i-2.5)*7*u,y-4*u+Math.sin(i)*2*u,3*u,i%2?'#749552':'#d99346');
  } else p.ell(x,y-7*u,8*u,8*u,'#d6ae51',1.5*u);
  p.dot(x,y,5.5*u);
};

/** Stance leg moves backwards at the same speed that the actor travels through the world. */
export function drawPerson(p: Pen, who: Person, o: PersonPose = {}) {
  const side=!!o.side, phase=o.phase??0, walk=!!o.walking, light=o.light??-2.1;
  const cfg=who.build==='kid'?{a:112,t:.85,l:1,tw:.72}:who.build==='stout'?{a:118,t:1.15,l:1.32,tw:.92}:{a:118,t:1.1,l:1.4,tw:.8};
  const H=headBlob(who.seed,cfg.a,side?1:0), W=2*H.a, HH=2*H.b, u=W/100;
  if(side){H.asym=.12;H.rot=.04;}
  const sole=975, ank=sole-4*u, L=(cfg.l+.12)*HH-4*u;
  let hipY=ank-L*.995+(o.breath??0)*2.2;
  const feet:{x:number;y:number;near:boolean}[]=[];
  if(side&&walk){
    const S=(o.stride??.64)*370;
    const at=(ph:number)=>{const q=((phase+ph)%1+1)%1;if(q<.5)return{x:S/2-S*q*2,h:0,s:q*2,stance:true};const s=(q-.5)*2;return{x:-S/2+S*s-S/Math.PI*Math.sin(TAU*s),h:38*Math.sin(Math.PI*s),s,stance:false};};
    const n=at(0),f=at(.5),st=n.stance?n:f,Le=L*(1-.035*Math.sin(Math.PI*st.s));
    hipY=ank-Math.sqrt(Math.max(1,Le*Le-st.x*st.x));
    feet.push({x:300+f.x,y:ank-f.h,near:false},{x:300+n.x,y:ank-n.h,near:true});
  }else{for(const s of [-1,1])feet.push({x:300+s*(side?4:22)*u,y:ank-(walk?Math.max(0,Math.sin(TAU*(phase+(s<0?0:.5))))*35:0),near:s>0});if(walk)hipY+=.015*(1+cfg.t+cfg.l)*HH*Math.cos(2*TAU*phase);}
  const torsoBottom=hipY+.12*HH,chin=torsoBottom-cfg.t*HH,hc=chin-H.b;
  p.rot=null;
  for(const f of feet){const h:P2=[300+(side?0:(f.near?15:-15)*u),hipY],a:P2=[f.x,f.y];const k=side?knee(h,a,L/2):lerp(h,a,.5);p.stroke([h,k,a],5.8*u,mix(who.pants,INK,f.near?.43:.65));
    p.stroke([[a[0]-3*u,a[1]],[a[0]+13*u,a[1]+.5*u]],9*u,INK);p.stroke([[a[0]-3*u,a[1]],[a[0]+13*u,a[1]+.5*u]],7.4*u,who.shoes);p.stroke([[a[0]-3*u,a[1]+2.7*u],[a[0]+13*u,a[1]+3.2*u]],2.3*u,'#f2dabb');}
  const lean=walk?(side?4+3*Math.cos(2*TAU*phase):Math.sin(TAU*phase)):0;
  p.rot=lean?[lean*Math.PI/180,300,hipY]:null;
  const T:Blob={a:(side?(who.build==='stout'?.36:.31):cfg.tw/2/1.06)*W,b:(torsoBottom-chin+.25*HH)/2,nTop:2.2,nBot:2.6,egg:who.build==='stout'?.17:.12,asym:side?.06:0,rot:0,noise:.006,seed:who.seed+7};
  const tcx=300+(side?2*u:0),tp=blobPts(tcx,torsoBottom-T.b,T),thick=thickAngle(light);
  if(o.backpack){p.poly(rounded(tcx-(side?T.a+20*u:25*u),chin+.07*HH,side?34*u:50*u,.9*HH,12), '#df8c76',3*u);}
  const shoulder=(s:number):P2=>[side?tcx:tcx+s*.85*T.a,chin+.12*HH];
  const arms=([-1,1] as const).map(s=>{const a=shoulder(s),sw=walk?Math.sin(TAU*phase)*(side?44:9)*u*s:0;
    let h:P2=side?[a[0]+sw,a[1]+.91*HH-Math.abs(sw)*.12]:[tcx+s*(T.a+12*u),chin+1.04*HH-Math.abs(sw)*.3];
    let e:P2=side?[(a[0]+h[0])/2-8*u,(a[1]+h[1])/2]:[tcx+s*(T.a+10*u),a[1]+.46*HH];
    if(s===1&&(o.watch??0)>0){h=lerp(h,[tcx+(side?25:-6)*u,chin+.62*HH],o.watch!);e=lerp(e,[tcx+(side?38:53)*u,chin+.64*HH],o.watch!);}
    if(s===1&&o.prop){h=[tcx+(side?46:39)*u,chin+.85*HH];e=[tcx+(side?18:55)*u,chin+.55*HH];}
    const goal=s===1?o.hands?.right:o.hands?.left;
    if(goal){const r=-lean*Math.PI/180,dx=goal[0]-300,dy=goal[1]-hipY;h=[300+dx*Math.cos(r)-dy*Math.sin(r),hipY+dx*Math.sin(r)+dy*Math.cos(r)];e=[(a[0]+h[0])/2+s*8*u,(a[1]+h[1])/2];}
    return {s,a,e,h};});
  const drawArm=(arm:typeof arms[number])=>{p.stroke(arcLine(arm.a,arm.e,arm.h),5.2*u,mix(who.shirt,INK,arm.s<0?.6:.42));p.dot(...arm.h,5.5*u);};
  for(const a of arms) if(a.s<0)drawArm(a);
  p.gradFill(tp,who.shirt,mul(who.shirt,[.64,.66,.74]),light);p.inkRing(tp,5*u,thick);
  p.arc(tcx,chin-.06*HH,.18*W,.10*HH,0,180,2*u,mix(who.shirt,INK,.45));
  if(o.backpack){for(const s of side?[-1]:[-1,1])p.band([[tcx+s*.62*T.a,chin-.03*HH],[tcx+s*.56*T.a,torsoBottom-.19*HH]],'#d87568',4*u,1*u,'round');}
  drawArm(arms[1]);
  if(who.watch){const a=arms[1],wr=lerp(a.e,a.h,.77);drawWatch(p,wr,Math.atan2(a.h[1]-a.e[1],a.h[0]-a.e[0]),o.watchProgress??(.62+.25*Math.sin(phase*TAU)),u*.64);}
  if(o.prop)held(p,o.prop,arms[1].h,u);
  const hcX=300+(side?4*u:0),hp=blobPts(hcX,hc,H);
  if(o.headTilt){const base=p.rot??[0,300,hipY];p.rot=[base[0]+o.headTilt*Math.PI/180,300,chin];}
  if(who.puffs){for(const s of [-1,1])p.ell(hcX+s*.9*H.a,hc-.54*H.b,.36*H.a,.35*H.a,who.hair,3*u);}
  p.shadedFill(hp,who.skin,mul(who.skin,[.96,.86,.84]),light,H.a);p.inkRing(hp,5*u,thick);
  p.clip(hp,()=>{
    if(who.beard){p.ell(hcX,hc+.75*H.b,H.a*1.05,H.b*.32,who.hair,0);p.ell(hcX+(side?20*u:0),hc+.43*H.b,H.a*.56,H.b*.27,who.skin,0);}
    p.poly([[hcX-H.a*1.2,hc-H.b*1.2],[hcX+H.a*1.2,hc-H.b*1.2],[hcX+H.a*1.1,hc-H.b*.56],[hcX-H.a*1.1,hc-H.b*.4]],who.hair,0);
    for(let j=0;j<12;j++){const x=hcX-H.a+j*2*H.a/11;p.ell(x,hc-H.b*(.55+.07*Math.sin(j*1.8)),.13*H.a,.15*H.a,who.hair,0);}
  });
  const expr=o.expr??'neutral';
  if(side)faceSide(p,hcX,hc,W,expr,o.blink??0,false,who.skin,undefined,who.build==='stout');else faceFront(p,hcX,hc,W,expr,0,o.look??0,o.blink??0,false,who.skin,undefined,who.build==='stout');
  p.rot=null;
}

export const walkStride = (speed: number, cycle: number, scale = 1) => speed*cycle/2/SU/370/scale;
export function blinkAt(frame: number, seed: number) {let at=seed%17;for(let n=0;at<=frame;n++){const k=frame-at;if(k<4)return [.5,1,1,.5][k];at+=18+Math.floor(48*((Math.sin((n+seed)*17.43)*43758.5453)%1+1)%48);}return 0;}
