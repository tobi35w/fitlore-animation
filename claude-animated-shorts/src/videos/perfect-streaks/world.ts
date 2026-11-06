import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { staticFile } from 'remotion';
import { buildSets,type Kit,type Sets,V } from './build';
import { ctex,cloudHD } from './paint';
import { TONE,CHAR,untone } from './shade';
import { NOINK } from './ink';
import { Cast } from './cast';
import { SHOTS,camAt,smooth,clamp01,eventFrame,type LightName } from './story';
import { lightFor,lookFor } from './look';
import { miniBrickPose,paperweightPose,shoePose,shoeGrip } from './propMotion';

let kitPromise:Promise<Kit>|null=null;
export function loadKit(){return kitPromise??=Promise.all(['tree_oak','tree_default','plant_bushLarge','plant_bush'].map(async name=>[name,(await new GLTFLoader().loadAsync(staticFile('projects/perfect-streaks/kit/'+name+'.glb'))).scene] as const)).then(rows=>Object.fromEntries(rows));}
const haloTexture=()=>ctex('streaks-sun-halo',256,256,g=>{const r=g.createRadialGradient(128,128,0,128,128,128);r.addColorStop(0,'rgba(255,255,255,.66)');r.addColorStop(.25,'rgba(255,255,255,.34)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,256,256);});
const discTexture=()=>ctex('streaks-sun-disc',128,128,g=>{const r=g.createRadialGradient(64,64,56,64,64,64);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,128,128);});

export class World {
  root=new THREE.Group();private sets:Sets;private cast:Cast;private sun=new THREE.DirectionalLight();private hemi=new THREE.HemisphereLight();private fog=new THREE.Fog('#b8d0ec',25,300);private sky:THREE.Mesh;private skyMat:THREE.ShaderMaterial;private clouds:THREE.Mesh[]=[];private cloudMaps:Record<LightName,THREE.Texture[]>;private halo:THREE.Sprite;private disc:THREE.Sprite;
  constructor(kit:Kit){
    this.skyMat=new THREE.ShaderMaterial({uniforms:{c0:{value:new THREE.Color()},c1:{value:new THREE.Color()},c2:{value:new THREE.Color()},c3:{value:new THREE.Color()},c4:{value:new THREE.Color()},e:{value:new THREE.Vector4()}},vertexShader:'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform vec3 c0,c1,c2,c3,c4;uniform vec4 e;varying vec3 vP;void main(){float el=asin(clamp(normalize(vP).y,-1.0,1.0));vec3 c=mix(c0,c1,smoothstep(0.0,e.x,el));c=mix(c,c2,smoothstep(e.x,e.y,el));c=mix(c,c3,smoothstep(e.y,e.z,el));c=mix(c,c4,smoothstep(e.z,e.w,el));gl_FragColor=vec4(c,1.0);}',side:THREE.BackSide,depthWrite:false,fog:false});
    this.sky=new THREE.Mesh(new THREE.SphereGeometry(1100,48,24),this.skyMat);this.sky.renderOrder=-10;this.sky.frustumCulled=false;this.sky.layers.set(NOINK);this.root.add(this.sky);
    this.sun.castShadow=true;this.sun.shadow.mapSize.set(4096,4096);this.sun.shadow.camera.layers.enable(NOINK);this.root.add(this.sun,this.sun.target,this.hemi);
    const cloudSet=(light:LightName)=>[0,1,2,3].map(i=>cloudHD(i,lookFor(light).cloud));
    this.cloudMaps={day:cloudSet('day'),golden:cloudSet('golden'),blue:cloudSet('blue'),storm:cloudSet('storm')};
    for(let i=0;i<9;i++){const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:this.cloudMaps.day[i%4],transparent:true,depthWrite:false,fog:false,color:new THREE.Color(1.1,1.1,1.1)}));m.scale.set(140+i%4*20,70+i%4*10,1);m.layers.set(NOINK);this.clouds.push(m);this.root.add(m);}
    this.halo=new THREE.Sprite(new THREE.SpriteMaterial({map:haloTexture(),color:new THREE.Color(1.4,.85,.42),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));this.halo.layers.set(NOINK);this.root.add(this.halo);
    this.disc=new THREE.Sprite(new THREE.SpriteMaterial({map:discTexture(),color:new THREE.Color(6,4.4,2.4),depthWrite:false,fog:false}));this.disc.layers.set(NOINK);this.root.add(this.disc);
    this.sets=buildSets(this.root,kit);this.cast=new Cast(this.root);
  }
  private lighting(light:LightName,flash=1){
    const l=lightFor(light),k=lookFor(light);TONE.uLitCol.value.set(...l.lit).multiplyScalar(flash);TONE.uShadeCol.value.set(...l.shade);TONE.uShadeLift.value.set(...l.lift);TONE.uLambert.value=l.lambert;TONE.uSideK.value=l.sideK;TONE.uTerm.value=l.term;TONE.uBounce.value.set(...k.bounce);TONE.uSat.value=k.sat;
    CHAR.uCharTint.value.set(...l.charTint);CHAR.uCharShade.value=l.charShade;CHAR.uGrad.value=l.charGrad;CHAR.uBodyGrad.value=l.bodyGrad;CHAR.uSideTint.value.set(...l.sideTint);
  }
  update(id:number,f:number,cam:THREE.PerspectiveCamera,scene:THREE.Scene){
    const s=SHOTS[id-1],c=camAt(id,f),lf=f-s.a,u=clamp01(lf/Math.max(1,s.b-s.a-1)),l=lightFor(s.light),k=lookFor(s.light),focus=V(...c.look);
    cam.position.set(...c.pos);cam.up.set(0,1,0);cam.lookAt(focus);cam.rotateZ(c.roll);cam.fov=c.fov;cam.near=.10;cam.far=1500;cam.layers.enable(NOINK);cam.updateProjectionMatrix();cam.updateMatrixWorld();
    const forward=V(s.look[0]-s.pos[0],0,s.look[2]-s.pos[2]).normalize(),az=l.az*Math.PI/180,el=l.el*Math.PI/180;
    const sunDir=V((forward.x*Math.cos(az)-forward.z*Math.sin(az))*Math.cos(el),Math.sin(el),(forward.z*Math.cos(az)+forward.x*Math.sin(az))*Math.cos(el));
    this.sun.position.copy(focus).addScaledVector(sunDir,220);this.sun.target.position.copy(focus);this.sun.color.set(l.sunCol);this.sun.intensity=l.sunI;this.hemi.color.set(l.sky);this.hemi.groundColor.set(l.ground);this.hemi.intensity=l.hemiI;
    const radius=Math.max(s.light==='golden'?30:12,Math.min(95,cam.position.distanceTo(focus)*1.15+7)),sc=this.sun.shadow.camera;sc.left=sc.bottom=-radius;sc.right=sc.top=radius;sc.near=20;sc.far=480;sc.updateProjectionMatrix();this.sun.shadow.bias=l.bias;this.sun.shadow.normalBias=l.normalBias*radius/12;
    const thunderAge=id===4?f-eventFrame('thunder'):99,flash=thunderAge>=0&&thunderAge<4?1+.13*(1-thunderAge/4):1;
    this.lighting(s.light,flash);this.sky.onBeforeRender=()=>this.lighting(s.light,flash);
    k.sky.c.forEach((color,i)=>untone(color,this.skyMat.uniforms['c'+i].value));this.skyMat.uniforms.e.value.set(...k.sky.e.slice(1).map(v=>v*Math.PI/180));this.sky.position.copy(cam.position);untone(l.fog,this.fog.color);this.fog.near=l.fogNear;this.fog.far=l.fogFar;scene.fog=this.fog;scene.background=null;
    this.halo.visible=this.disc.visible=s.light==='golden';this.halo.position.copy(cam.position).addScaledVector(sunDir,900);this.halo.scale.setScalar(760);this.disc.position.copy(this.halo.position);this.disc.scale.setScalar(2*900*Math.tan(1.7*Math.PI/180));
    this.clouds.forEach((cloud,i)=>{const angle=i/9*Math.PI*2,distance=620+i%3*40;cloud.position.set(Math.cos(angle)*distance+f/30*(s.light==='storm'?1.15:.35),90+i%4*35,Math.sin(angle)*distance);cloud.lookAt(cam.position.x,cloud.position.y,cam.position.z);(cloud.material as THREE.MeshBasicMaterial).map=this.cloudMaps[s.light][i%4];});
    this.sets.court.visible=s.location==='court';this.sets.workshop.visible=s.location==='workshop';this.sets.analogy.visible=s.location==='analogy';

    const tracker=this.sets.courtCalendar;tracker.mesh.visible=[5,16,17,18].includes(id);this.sets.calendarStand.visible=id===5||id===16;
    if(id===5){tracker.draw(22,0);tracker.pose('stand',u,.011*Math.sin(f*.1));}
    if(id===16){tracker.draw(22,7*smooth((f-eventFrame('seven-green')+28)/28));tracker.pose('stand',u,.004*Math.sin(f*.09));}
    if(id===17){tracker.draw(22,7);tracker.pose('unroll',smooth((f-s.a)/Math.max(10,eventFrame('calendar-flat')-s.a)));}
    if(id===18){tracker.draw(22,7);tracker.pose('flat',1,.004*Math.sin(f*.083));}
    this.sets.shoes.forEach((shoe,i)=>{shoe.visible=id===14;const pose=shoePose(f,i);shoe.position.set(...pose.pos);shoe.rotation.set(...pose.rot);});
    const grip=V(...shoeGrip(f));
    this.sets.shoeLaces.forEach((lace,i)=>{lace.visible=id===14;const shoe=this.sets.shoes[i],start=shoe.position.clone().add(V(0,.255,0)),direction=grip.clone().sub(start);lace.position.copy(start).add(grip).multiplyScalar(.5);lace.quaternion.setFromUnitVectors(V(0,1,0),direction.clone().normalize());lace.scale.set(1,direction.length(),1);});
    this.sets.binLid.rotation.x=id===6?-1.28*smooth(u*2):0;
    this.sets.puddle.visible=id===4;
    this.sets.rain.forEach((drop,i)=>{drop.visible=id===4;const phase=((lf*.048+i*.618033)%1+1)%1;drop.position.set(-6+(i*1.837)%12+phase*.55,4.3*(1-phase),-2.7+(i*.727)%6.1);});
    this.sets.ripples.forEach((ripple,i)=>{ripple.visible=id===4;const phase=((lf/25+i*.21)%1+1)%1;ripple.position.set(.45+Math.sin(i*2.3)*1.6,.018,.32+Math.cos(i*1.7)*.45);ripple.scale.setScalar(.25+phase*.60);(ripple.material as THREE.MeshBasicMaterial).opacity=.32*(1-phase);});
    this.sets.windLeaves.forEach((leaf,i)=>{leaf.visible=id===4;const phase=((lf/83+i*.18)%1+1)%1;leaf.position.set(-4.2+phase*8.4,.12+Math.sin(phase*Math.PI)*(.5+i*.09),.9-i*.29);leaf.rotation.set(f*.035+i,f*.025,f*.06+i);});

    const study=this.sets.researchCalendar;study.mesh.visible=[10,11,12,13].includes(id);study.draw(22,0);study.pose('flat',1,.012+.007*Math.sin(f*.083));this.sets.magnifier.visible=id===11;
    this.sets.magnifier.position.set(-.65+.16*Math.sin(u*Math.PI*1.2),1.008,.24+.18*(u-.5));this.sets.magnifier.rotation.y=-.2+.32*u;
    this.sets.studyLamp.visible=id===10||id===11;
    const brick=this.sets.flyingBrick;brick.visible=id===12||id===13;const brickPose=miniBrickPose(f);brick.position.set(brickPose.pos[0]-120,brickPose.pos[1],brickPose.pos[2]);brick.rotation.set(...brickPose.rot);
    this.sets.looseBrick.visible=id===12||id===13;
    const paperweight=this.sets.paperweight;paperweight.visible=id===18||(id===17&&f>=eventFrame('brick-ready'));const weightPose=paperweightPose(f);paperweight.position.set(...weightPose.pos);paperweight.rotation.set(...weightPose.rot);
    this.cast.update(id,f,cam,sunDir);return focus;
  }
}
