import * as THREE from 'three';
import {Pen,fxBurst} from './toon';
import {drawPerson,MARCUS,BUILDER,blinkAt,walkStride,type Person,type PersonPose,type P2} from './character';
import {NOINK} from './ink';
import {cardShade,blobMaterial,CARD_K} from './cardshade';
import {SHOTS,smooth,clamp01,eventFrame,type V3} from './story';
import {miniBrickPose,paperweightPose,shoeGrip,PROP_ANCHORS} from './propMotion';

const SU=.00216;
const bodyGeo=new THREE.PlaneGeometry(600*SU,1000*SU);bodyGeo.translate(0,475*SU,0);
function texture(w:number,h:number){const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;return{canvas,tex};}
function contact(){const{canvas,tex}=texture(256,128),g=canvas.getContext('2d')!;g.fillStyle='white';g.fillRect(0,0,256,128);g.save();g.scale(2,1);const a=g.createRadialGradient(64,64,4,64,64,61);a.addColorStop(0,'#8890a8');a.addColorStop(.28,'#a6adc1');a.addColorStop(1,'white');g.fillStyle=a;g.fillRect(0,0,128,128);g.restore();tex.generateMipmaps=false;tex.minFilter=THREE.LinearFilter;return tex;}
let blobTex:THREE.Texture|null=null;
class Actor{
  mesh:THREE.Mesh;mat:THREE.MeshLambertMaterial;canvas:HTMLCanvasElement;tex:THREE.CanvasTexture;shadow:THREE.Mesh;tail:THREE.Mesh;key='';
  constructor(root:THREE.Group){const t=texture(1080,1800);this.canvas=t.canvas;this.tex=t.tex;this.mat=cardShade(new THREE.MeshLambertMaterial({map:this.tex,alphaTest:.5,side:THREE.DoubleSide}));this.mesh=new THREE.Mesh(bodyGeo,this.mat);this.mesh.customDepthMaterial=new THREE.MeshDepthMaterial({map:this.tex,alphaTest:.5,depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});this.mesh.layers.set(NOINK);this.mesh.receiveShadow=true;this.mesh.renderOrder=1;this.mesh.onBeforeRender=r=>{CARD_K.uPx.value=(r.getRenderTarget()?.height??r.domElement.height)/1920;};blobTex??=contact();this.shadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),blobMaterial(blobTex));this.tail=new THREE.Mesh(new THREE.PlaneGeometry(1,1),blobMaterial(blobTex));for(const m of[this.shadow,this.tail]){m.rotation.x=-Math.PI/2;m.layers.set(NOINK);m.renderOrder=.5;}root.add(this.mesh,this.shadow,this.tail);}
  paint(who:Person,pose:PersonPose,detail:number){const w=Math.round(600*detail),h=Math.round(1000*detail),key=JSON.stringify([who,pose,detail]);if(key===this.key)return;this.key=key;if(this.canvas.width!==w){this.tex.dispose();this.canvas.width=w;this.canvas.height=h;}const g=this.canvas.getContext('2d')!;g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,w,h);g.setTransform(detail,0,0,detail,0,0);drawPerson(new Pen(g),who,pose);this.tex.needsUpdate=true;}
}

type Place={who:Person;pos:V3;pose:PersonPose;mirror:boolean};
const mix2=(a:P2,b:P2,t:number):P2=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
function stage(id:number,f:number,right:THREE.Vector3):Place[]{
  const s=SHOTS[id-1],lf=Math.max(0,Math.min(s.b-s.a-1,f-s.a)),t=lf/30,u=clamp01(lf/(s.b-s.a-1)),out:Place[]=[];
  const add=(who:Person,pos:V3,pose:PersonPose={},mirror=false)=>out.push({who,pos,pose:{phase:t,blink:blinkAt(f,who.seed),breath:Math.sin(f*.12+who.seed),...pose},mirror});
  const walk=(who:Person,pos:V3,velocity:V3,pose:PersonPose={},cycle=1,offset=0)=>{const projected=velocity[0]*right.x+velocity[2]*right.z,mirror=projected<0;add(who,pos,{side:true,walking:true,stride:walkStride(Math.abs(projected),cycle),phase:(lf-offset)/(30*cycle),...pose},mirror);};
  switch(id){
    case 1:{const q=smooth((f-eventFrame('failure')+7)/7);add(MARCUS,[0,.018,.25],{prop:'calendar',hands:{right:[443,643-q*39],left:[170,645+q*30]},expr:f>=eventFrame('failure')?'shock':'nervous',headTilt:-3*smooth(lf/30)});break;}
    case 2:{const moving=lf<45,pt=Math.min(t,1.5),reach=smooth((lf-38)/17),mark=smooth((f-eventFrame('green-stamp')+5)/5);const pose:PersonPose={leftProp:'calendar',prop:'marker',calendarBefore:21+mark,expr:'smile',hands:{left:mix2([190,650],[382,580],reach),right:mix2([410,650],[308,635],reach)}};if(moving)walk(MARCUS,[-2.4+.8*pt,.018,0],[.8,0,0],pose);else add(MARCUS,[-1.2,.018,0],{side:true,...pose});break;}
    case 3:add(MARCUS,[-.3,.018,-.1],{leftProp:'calendar',hands:{left:[402,594],right:[428-12*Math.sin(t*2),545]},expr:'stern',headTilt:-2+3*smooth(lf/35),look:.5});break;
    case 4:walk(MARCUS,[-.1-.75*t,.018,.75],[-.75,0,0],{expr:f<eventFrame('thunder')?'nervous':'shock',hands:{right:[425,500],left:[200,590]},headTilt:-3});break;
    case 6:walk({...MARCUS,shoes:'#887467'},[1.0+.58*t,.018,.9],[.58,0,0],{leftProp:'roll',prop:'shoes',expr:'stern'});break;
    case 7:walk({...MARCUS,shoes:'#887467'},[58.9+.18*t,.018,.6],[.18,0,0],{leftProp:'roll',expr:'neutral'});walk(BUILDER,[61.65-.15*t,.018,.45],[-.15,0,0],{prop:'brick',expr:'neutral'});break;
    case 8:add({...MARCUS,shoes:'#887467'},[59.6,.018,.5],{leftProp:'roll',hands:{right:[446,585-20*Math.sin(t*2)]},expr:'stern',look:.7,headTilt:-2});add(BUILDER,[61.2,.018,.38],{prop:'brick',expr:lf<38?'stern':'neutral',look:-.7,headTilt:3});break;
    case 9:{const q=smooth((f-eventFrame('wall-gap'))/40),done=f>=eventFrame('wall-standing');add({...MARCUS,shoes:'#887467'},[59.7,.018,.7],{leftProp:'roll',hands:{right:[458,625+30*q]},expr:done?'relief':'nervous',look:.8,headTilt:-2+3*q});add(BUILDER,[61.2,.018,.5],{prop:'brick',hands:{left:[158+85*q,646-40*q]},expr:done?'smile':'neutral',look:.75-1.5*q,headTilt:3-5*q});break;}
    case 10:walk(BUILDER,[118.7+.28*t,.018,1.25],[.28,0,0],{prop:'brick',expr:'smile'});break;
    case 13:walk(BUILDER,[119.7-.38*t,.018,1.25],[-.38,0,0],{expr:'neutral'});break;
    case 15:{const gesture=smooth((lf-63)/12)*(1-smooth((lf-109)/16));walk(MARCUS,[-.85+.52*t,.018,.4],[.52,0,0],{expr:'smile',hands:gesture>.005?{right:mix2([408,650],[437,536],gesture)}:undefined,headTilt:2*Math.sin(t*.7)},1.1,2);break;}
  }
  return out;
}

/** A cropped forearm in an insert. Its hand anchor follows the actual 3D prop. */
class HandCard{
  mesh:THREE.Mesh;canvas:HTMLCanvasElement;tex:THREE.CanvasTexture;key='';
  constructor(root:THREE.Group){const t=texture(1000,600);this.canvas=t.canvas;this.tex=t.tex;this.mesh=new THREE.Mesh(new THREE.PlaneGeometry(2.4,1.44),cardShade(new THREE.MeshLambertMaterial({map:t.tex,alphaTest:.5,side:THREE.DoubleSide})));this.mesh.layers.set(NOINK);this.mesh.renderOrder=3;root.add(this.mesh);}
  place(target:THREE.Vector3,cam:THREE.PerspectiveCamera,point=false,builder=false,opening=0){
    const key=[point,builder,opening.toFixed(3)].join(',');if(key!==this.key){this.key=key;const g=this.canvas.getContext('2d')!;g.clearRect(0,0,1000,600);const p=new Pen(g),shirt=builder?'#b87963':'#90939a';p.poly([[1010,-20],[844,3],[745,114],[806,180],[1010,119]],shirt,13);p.stroke([[806,137],[590,242],[200,450]],14,'#4b3638');p.dot(200,450,15,'#3c2a33');if(point){p.stroke([[200,450],[116,450]],13,'#3c2a33');p.dot(116,450,7,'#3c2a33');}else{p.stroke([[193,450],[178-15*opening,473+10*opening],[204-4*opening,480+13*opening]],10,'#3c2a33');p.stroke([[208,448],[231+17*opening,463],[235+22*opening,446-6*opening]],10,'#3c2a33');}this.tex.needsUpdate=true;}
    const right=new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld,1),forward=new THREE.Vector3();cam.getWorldDirection(forward);
    this.mesh.visible=true;this.mesh.position.copy(target).addScaledVector(right,.72).addScaledVector(up,.36).addScaledVector(forward,-.025);this.mesh.quaternion.copy(cam.quaternion);
  }
}

export class Cast{
  private actors:Actor[]=[];private hands:HandCard[]=[];private effects:THREE.Mesh[]=[];private effectCanvases:HTMLCanvasElement[]=[];private effectTextures:THREE.CanvasTexture[]=[];
  constructor(private root:THREE.Group){}
  private hand(i:number){while(this.hands.length<=i)this.hands.push(new HandCard(this.root));return this.hands[i];}
  private effect(i:number){while(this.effects.length<=i){const t=texture(500,500),m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:t.tex,transparent:true,depthWrite:false}));m.layers.set(NOINK);m.renderOrder=4;this.root.add(m);this.effects.push(m);this.effectCanvases.push(t.canvas);this.effectTextures.push(t.tex);}return this.effects[i];}
  update(id:number,f:number,cam:THREE.PerspectiveCamera,sun:THREE.Vector3){
    const right=new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld,0);right.y=0;right.normalize();const poses=stage(id,f,right),s=SHOTS[id-1];
    poses.forEach((a,i)=>{while(this.actors.length<=i)this.actors.push(new Actor(this.root));const actor=this.actors[i],pos=new THREE.Vector3(...a.pos),dist=cam.position.distanceTo(pos.clone().add(new THREE.Vector3(0,1,0)));actor.paint(a.who,{...a.pose,light:Math.atan2(-sun.y,sun.dot(right)*(a.mirror?-1:1))},dist<2.1?3:dist<7?1.8:1.1);actor.mesh.visible=true;actor.mesh.position.copy(pos);actor.mesh.rotation.set(0,Math.atan2(-right.z,right.x),0);actor.mesh.scale.set(a.mirror?-1:1,1,1);actor.mesh.castShadow=s.light==='golden';actor.shadow.visible=true;actor.shadow.position.set(pos.x,pos.y+.003,pos.z);actor.shadow.scale.set(.88,.38,1);actor.tail.visible=s.light==='day';actor.tail.position.set(pos.x-sun.x*.4,pos.y+.002,pos.z-sun.z*.4);actor.tail.rotation.set(-Math.PI/2,0,Math.atan2(-sun.x,-sun.z));actor.tail.scale.set(.6,1.4,1);});
    for(let i=poses.length;i<this.actors.length;i++){const a=this.actors[i];a.mesh.visible=a.shadow.visible=a.tail.visible=false;}
    for(const h of this.hands)h.mesh.visible=false;
    const withdraw=(v:THREE.Vector3,age:number,duration=22)=>v.addScaledVector(right,1.9*smooth(age/duration)).add(new THREE.Vector3(0,.48*smooth(age/duration),0));
    if(id===5){const q=smooth((f-s.a)/16),v=new THREE.Vector3(1.59+.24*(1-q),1.235,-.89);this.hand(0).place(v,cam,true);}
    if(id===11){const u=clamp01((f-s.a)/(s.b-s.a-1));this.hand(0).place(new THREE.Vector3(119.65+.16*Math.sin(u*Math.PI*1.2),1.045,.24+.18*(u-.5)),cam,false,true);}
    if(id===12){const age=f-eventFrame('brick-land');if(age<24){const pose=miniBrickPose(Math.min(f,eventFrame('brick-land'))),v=new THREE.Vector3(...pose.pos).add(new THREE.Vector3(0,.075,.13));this.hand(0).place(withdraw(v,Math.max(0,age)),cam,false,true,smooth(age/5));}}
    if(id===14){const age=f-eventFrame('shoes-set');if(age<24){const v=new THREE.Vector3(...shoeGrip(Math.min(f,eventFrame('shoes-set'))));this.hand(0).place(withdraw(v,Math.max(0,age)),cam,false,false,smooth(age/5));}}
    if((id===17&&f>=eventFrame('brick-ready'))||id===18){const age=f-eventFrame('paperweight');if(age<24){const pose=paperweightPose(Math.min(f,eventFrame('paperweight'))),v=new THREE.Vector3(...pose.pos).add(new THREE.Vector3(.02,.065,.10));this.hand(0).place(withdraw(v,Math.max(0,age)),cam,false,false,smooth(age/5));}}
    let ei=0;
    const burst=(pos:V3,start:number,size:number,col='#efd6a0')=>{const age=f-start;if(age<0||age>=12)return;const m=this.effect(ei),g=this.effectCanvases[ei].getContext('2d')!;g.clearRect(0,0,500,500);fxBurst(new Pen(g),age/12,col,6,24,160);this.effectTextures[ei].needsUpdate=true;m.visible=true;m.position.set(...pos);m.quaternion.copy(cam.quaternion);m.scale.setScalar(size*(1+.15*age/12));(m.material as THREE.MeshBasicMaterial).opacity=1-age/12;ei++;};
    if(id===1)burst([.35,1.06,.30],eventFrame('failure'),.24);
    if(id===4)burst([-.32,.22,.85],eventFrame('thunder'),.32,'#c5d9e2');
    if(id===12)burst([120.814,1.36,-.1],eventFrame('brick-land'),.23);
    if(id===14)burst([-.72,.14,-2.13],eventFrame('shoes-set'),.22);
    if(id===18)burst([PROP_ANCHORS.paperweight[0],PROP_ANCHORS.paperweight[1]+.05,PROP_ANCHORS.paperweight[2]+.12],eventFrame('paperweight'),.19);
    for(let i=ei;i<this.effects.length;i++)this.effects[i].visible=false;
  }
}
