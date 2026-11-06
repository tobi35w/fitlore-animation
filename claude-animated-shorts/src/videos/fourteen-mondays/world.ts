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
export function loadKit(){return kitPromise??=Promise.all(['tree_oak','tree_default','plant_bushLarge','plant_bush'].map(async name=>[name,(await new GLTFLoader().loadAsync(staticFile('projects/fourteen-mondays/kit/'+name+'.glb'))).scene] as const)).then(rows=>Object.fromEntries(rows));}
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
    const stormAge = s.light === 'storm' ? f - s.a : 99, flash = 1;
    this.lighting(s.light, flash); this.sky.onBeforeRender = () => this.lighting(s.light, flash);
    k.sky.c.forEach((color, i) => untone(color, this.skyMat.uniforms['c' + i].value));
    this.skyMat.uniforms.e.value.set(...k.sky.e.slice(1).map(v => v * Math.PI / 180));
    this.sky.position.copy(cam.position); untone(l.fog, this.fog.color);
    this.fog.near = l.fogNear; this.fog.far = l.fogFar; scene.fog = this.fog; scene.background = null;
    this.halo.visible = this.disc.visible = s.light === 'golden';
    this.halo.position.copy(cam.position).addScaledVector(sunDir, 900); this.halo.scale.setScalar(760);
    this.disc.position.copy(this.halo.position); this.disc.scale.setScalar(2 * 900 * Math.tan(1.7 * Math.PI / 180));
    this.clouds.forEach((cloud, i) => {
      const angle = i / 9 * Math.PI * 2, distance = 620 + i % 3 * 40;
      cloud.position.set(Math.cos(angle) * distance + f / 30 * (s.light === 'storm' ? 1.15 : .35), 90 + i % 4 * 35, Math.sin(angle) * distance);
      cloud.lookAt(cam.position.x, cloud.position.y, cam.position.z);
      (cloud.material as THREE.MeshBasicMaterial).map = this.cloudMaps[s.light][i % 4];
    });

    const loc = s.location;
    this.sets.court.visible = loc === 'kitchen' || loc === 'living';
    this.sets.workshop.visible = loc === 'hall';
    this.sets.analogy.visible = loc === 'street';

    const tracker = this.sets.courtCalendar;
    tracker.mesh.visible = [1, 2, 7, 9, 14, 21].includes(id);
    this.sets.calendarStand.visible = [1, 2, 9, 21].includes(id);
    if ([1, 2, 7, 9, 14, 21].includes(id)) {
      tracker.draw(22, 0);
      tracker.pose('stand', u, .008 * Math.sin(f * .1));
    }

    this.sets.shoes.forEach((shoe) => { shoe.visible = false; });
    this.sets.shoeLaces.forEach((lace) => { lace.visible = false; });
    this.sets.binLid.rotation.x = 0;
    this.sets.puddle.visible = false;
    this.sets.rain.forEach((drop) => { drop.visible = false; });
    this.sets.ripples.forEach((ripple) => { ripple.visible = false; });
    this.sets.windLeaves.forEach((leaf) => { leaf.visible = false; });

    const study = this.sets.researchCalendar;
    study.mesh.visible = false;
    this.sets.magnifier.visible = false;
    this.sets.studyLamp.visible = false;
    this.sets.flyingBrick.visible = false;
    this.sets.looseBrick.visible = false;
    this.sets.paperweight.visible = false;

    this.cast.update(id, f, cam, sunDir);
    return focus;
  }
}
