// Lit billboard cast and contact shadows, using the template Pen/cardShade engine.
import * as THREE from 'three';
import { Pen, fxBurst } from './toon';
import { drawPerson, MARCUS, DAUGHTER, NEIGHBORS, blinkAt, walkStride, type Person, type PersonPose } from './character';
import { NOINK } from './ink';
import { cardShade, blobMaterial, CARD_K } from './cardshade';
import { SHOTS, smooth, clamp01, eventFrame, type V3 } from './story';

const SU=.00216;
const bodyGeo=new THREE.PlaneGeometry(600*SU,1000*SU);bodyGeo.translate(0,475*SU,0);
function texture(w:number,h:number){const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;return {canvas,tex};}
const contact=()=>{const {canvas,tex}=texture(256,128),g=canvas.getContext('2d')!;g.fillStyle='white';g.fillRect(0,0,256,128);g.save();g.scale(2,1);const gr=g.createRadialGradient(64,64,4,64,64,61);gr.addColorStop(0,'#8890a8');gr.addColorStop(.28,'#a6adc1');gr.addColorStop(1,'white');g.fillStyle=gr;g.fillRect(0,0,128,128);g.restore();tex.generateMipmaps=false;tex.minFilter=THREE.LinearFilter;return tex;};
let blobTex:THREE.Texture|null=null;
class Actor {
  mesh:THREE.Mesh; mat:THREE.MeshLambertMaterial; canvas:HTMLCanvasElement;tex:THREE.CanvasTexture;depth:THREE.MeshDepthMaterial;shadow:THREE.Mesh;tail:THREE.Mesh;key='';
  constructor(root:THREE.Group){const t=texture(1080,1800);this.canvas=t.canvas;this.tex=t.tex;this.mat=cardShade(new THREE.MeshLambertMaterial({map:this.tex,alphaTest:.5,side:THREE.DoubleSide}));this.depth=new THREE.MeshDepthMaterial({map:this.tex,alphaTest:.5,depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});this.mesh=new THREE.Mesh(bodyGeo,this.mat);this.mesh.customDepthMaterial=this.depth;this.mesh.layers.set(NOINK);this.mesh.receiveShadow=true;this.mesh.renderOrder=1;this.mesh.onBeforeRender=r=>{CARD_K.uPx.value=(r.getRenderTarget()?.height??r.domElement.height)/1920;};
    blobTex??=contact();this.shadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),blobMaterial(blobTex));this.tail=new THREE.Mesh(new THREE.PlaneGeometry(1,1),blobMaterial(blobTex));for(const b of [this.shadow,this.tail]){b.rotation.x=-Math.PI/2;b.layers.set(NOINK);b.renderOrder=.5;}root.add(this.mesh,this.shadow,this.tail);}
  paint(who:Person,o:PersonPose,detail:number){const k=detail,ww=Math.round(600*k),hh=Math.round(1000*k),key=JSON.stringify([who,o,k]);if(key===this.key)return;this.key=key;if(this.canvas.width!==ww){
    // WebGL texture storage has a fixed size. Reallocate it before resizing the
    // source canvas, otherwise sequential frames retain pieces of the old pose.
    this.tex.dispose();this.canvas.width=ww;this.canvas.height=hh;
  }const g=this.canvas.getContext('2d')!;g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,ww,hh);g.setTransform(k,0,0,k,0,0);drawPerson(new Pen(g),who,o);this.tex.needsUpdate=true;}
}
export type Place={who:Person;pos:V3;pose:PersonPose;mirror?:boolean};
function stage(id:number,f:number,right:THREE.Vector3):Place[]{
  const s=SHOTS[id-1],lf=Math.max(0,f-s.a),t=lf/30,u=clamp01(lf/(s.b-s.a)),a:Place[]=[];
  const add=(who:Person,pos:V3,pose:PersonPose={},mirror=false)=>a.push({who,pos,pose:{phase:t/1.05,blink:blinkAt(f,who.seed),breath:Math.sin(f*.12+who.seed),...pose},mirror});
  const walk=(who:Person,pos:V3,speed:number,pose:PersonPose={},mirror=false)=>add(who,pos,{side:true,walking:true,stride:walkStride(speed,1.05),...pose},mirror);
  switch(id){
    case 1:walk(MARCUS,[-2+1.02*t,.018,-.8],1.02,{watch:smooth((lf-20)/22)*.7,expr:lf<50?'stern':'neutral'});break;
    case 2:walk(MARCUS,[-3.9+.6*t,.018,.1-.12*t],.61,{expr:'smile',watch:.5});walk(NEIGHBORS[0],[3+t*.45,.018,-1.5],.45);break;
    case 3:walk(MARCUS,[-1.8+1.03*t,.018,-.5],1.03,{expr:'smile'});break;
    case 4:walk(MARCUS,[-.5+.58*t,.018,-1.92],.58,{watch:lf>65?smooth((lf-65)/20):0,expr:'neutral'});break;
    case 5:add(DAUGHTER,[.6,.028,-2.05],{prop:'backpack',expr:lf<35?'neutral':'stern',look:-.5,headTilt:Math.sin(t*2)*1.2});break;
    case 6:{const turn=eventFrame('turn')-s.a,dist=lf<turn?-1.8+.025*lf:-(lf-turn)*.028;walk(MARCUS,[dist,.018,-1.55],.78,{side:Math.abs(lf-turn)>5,watch:smooth((lf-26)/22)*(1-smooth((lf-87)/16)),expr:lf>turn?'neutral':'nervous'},lf>turn);add(DAUGHTER,[.62,.028,-2.08],{prop:'backpack',expr:'stern'});break;}
    case 7:add(MARCUS,[0,.018,-1.4],{watch:.86+.14*smooth(lf/15),watchProgress:.36+.64*smooth(lf/(eventFrame('watch-celebrate')-s.a)),expr:lf>33?'grin':'neutral'});break;
    case 8:walk(MARCUS,[100.85+.35*t,.018,-.45-.22*t],.41,{prop:'bowl',expr:'neutral'});break;
    case 9:walk(MARCUS,[9.1+.7*t,.018,-.5],.7,{watch:lf>120?.5:0,expr:'smile'});walk(NEIGHBORS[0],[7.8+.74*t,.018,-1.5],.74);walk(NEIGHBORS[1],[11.2+.52*t,.018,-1.3],.52);break;
    case 10:walk(NEIGHBORS[0],[22+.62*t,.018,-.3],.62,{expr:'smile'});walk(NEIGHBORS[1],[21+.76*t,.018,-1.2],.76,{expr:'smile_closed'});walk({...NEIGHBORS[0],name:'Neighbor C',seed:42,shirt:'#7c9d85',hair:'#90756a'},[24+.45*t,.018,-1.5],.45);break;
    case 11:add(MARCUS,[100.62,.018,.20],{watch:.5*(1-smooth(lf/45)),hands:{left:[158,655]},expr:lf<50?'neutral':'smile',look:-.5});break;
    case 14:walk(MARCUS,[11.6+.80*t,.018,-.5],.80,{prop:'bag',expr:'smile'});break;
    case 15:walk(MARCUS,[37.8+.68*t,.018,-1.1],.68,{expr:'smile'});walk(DAUGHTER,[38.65+.68*t,.018,-1.1],.68,{backpack:true,expr:'smile'});break;
    case 16:walk(MARCUS,[2.0-.48*t,.018,-.5-.15*t],.5,{expr:'smile'},true);walk(DAUGHTER,[2.6-.48*t,.018,-.4-.18*t],.51,{backpack:true,expr:'smile_closed'},true);walk(NEIGHBORS[0],[-1.5+.9*t,.018,.1],.9);break;
    case 17:add(MARCUS,[0,.018,-1.85],{watch:smooth((lf-14)/36),expr:'neutral'});add(DAUGHTER,[.72,.018,-1.9],{backpack:true,expr:'smile'});break;
    case 18:{const meet=eventFrame('hands-meet'),joined=smooth((f-meet+10)/10),travel=Math.max(0,(f-meet)/30)*.38,center=new THREE.Vector3(.1,.018,-1.7+travel);const x=center.clone().addScaledVector(right,-.3456),y=center.clone().addScaledVector(right,.3456);
      add(MARCUS,[x.x,x.y,x.z],{walking:travel>0,phase:t/1.18,hands:{right:[460,650]},watch:(1-joined)*.8,expr:f<meet?'neutral':'smile'});
      add(DAUGHTER,[y.x,y.y,y.z],{walking:travel>0,phase:t/1.18+.03,hands:{left:[140,650+(1-joined)*90]},backpack:true,expr:'smile_closed'});break;}
  }return a;
}

export class Cast {
  private actors:Actor[]=[];private fx:THREE.Mesh[]=[];private fxCanvas:HTMLCanvasElement[]=[];private fxTex:THREE.CanvasTexture[]=[];private hand:THREE.Mesh;private handTex:THREE.CanvasTexture;private handCanvas:HTMLCanvasElement;
  constructor(private root:THREE.Group){const t=texture(1000,600);this.handTex=t.tex;this.handCanvas=t.canvas;this.hand=new THREE.Mesh(new THREE.PlaneGeometry(1.6,.96),cardShade(new THREE.MeshLambertMaterial({map:t.tex,alphaTest:.5,side:THREE.DoubleSide})));this.hand.layers.set(NOINK);this.hand.renderOrder=2;this.root.add(this.hand);}
  private effect(i:number){while(this.fx.length<=i){const t=texture(500,500),m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:t.tex,transparent:true,depthWrite:false}));m.layers.set(NOINK);m.renderOrder=2;this.root.add(m);this.fx.push(m);this.fxCanvas.push(t.canvas);this.fxTex.push(t.tex);}return this.fx[i];}
  update(id:number,f:number,cam:THREE.PerspectiveCamera,sun:THREE.Vector3){
    const right=new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld,0);right.y=0;right.normalize();const poses=stage(id,f,right),shot=SHOTS[id-1];
    poses.forEach((a,i)=>{while(this.actors.length<=i)this.actors.push(new Actor(this.root));const actor=this.actors[i],pos=new THREE.Vector3(...a.pos),dist=cam.position.distanceTo(pos.clone().add(new THREE.Vector3(0,1,0)));
      actor.paint(a.who,{...a.pose,light:Math.atan2(-sun.y,sun.dot(right))},dist<2.1?3:dist<7?1.8:.85);
      actor.mesh.visible=true;actor.mesh.position.copy(pos);actor.mesh.rotation.set(0,Math.atan2(-right.z,right.x),0);actor.mesh.scale.set(a.mirror?-1:1,1,1);actor.mesh.castShadow=shot.light==='golden';
      actor.shadow.visible=true;actor.shadow.position.set(pos.x,pos.y+.003,pos.z);actor.shadow.scale.set(a.who.build==='kid'?.62:.88,.38,1);
      actor.tail.visible=shot.light==='day';actor.tail.position.set(pos.x-sun.x*.4,pos.y+.002,pos.z-sun.z*.4);actor.tail.rotation.set(-Math.PI/2,0,Math.atan2(-sun.x,-sun.z));actor.tail.scale.set(.6,1.4,1);
    });
    for(let i=poses.length;i<this.actors.length;i++){const a=this.actors[i];a.mesh.visible=a.shadow.visible=a.tail.visible=false;}
    let ei=0;const burst=(pos:V3,start:number,size:number)=>{const age=f-start;if(age<0||age>15)return;const e=this.effect(ei),g=this.fxCanvas[ei].getContext('2d')!;g.clearRect(0,0,500,500);fxBurst(new Pen(g),age/16,'#efd6a0',7,25,180);this.fxTex[ei].needsUpdate=true;e.visible=true;e.position.set(...pos);e.quaternion.copy(cam.quaternion);e.scale.setScalar(size*(1+.15*age/16));(e.material as THREE.MeshBasicMaterial).opacity=1-age/16;ei++;};
    if(id===7)burst([.10,.97,-1.33],eventFrame('watch-celebrate'),.30);
    if(id===12||id===13){for(const name of ['coin-one','coin-two','coin-three'])burst([99.6,1.02,.25],eventFrame(name),.25);}
    if([1,3,4,6,9,14,15,16,18].includes(id)){const p=poses[0];if(p){const last=Math.floor((f-shot.a)/16)*16+shot.a;burst([p.pos[0]-.13,.05,p.pos[2]+.04],last,.16);}}
    for(let i=ei;i<this.fx.length;i++)this.fx[i].visible=false;
    this.hand.visible=id===12&&f<eventFrame('coin-one')+2;
    if(this.hand.visible){const age=f-(eventFrame('coin-one')-18),ret=smooth(age/16),g=this.handCanvas.getContext('2d')!;g.clearRect(0,0,1000,600);const p=new Pen(g);p.stroke([[950,45],[670,180],[215+ret*100,350-ret*120]],17,'#4c3434');p.dot(210+ret*100,352-ret*120,22,'#4c3434');if(ret>.1){p.stroke([[205+ret*100,350-ret*120],[170+ret*100,338-ret*120]],9,'#4c3434');}this.handTex.needsUpdate=true;this.hand.position.set(100.08,1.90,.25);this.hand.rotation.set(0,0,0);}
  }
}
