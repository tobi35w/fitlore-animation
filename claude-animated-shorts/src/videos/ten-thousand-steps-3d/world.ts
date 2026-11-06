// Residential street and home, lit and composited with the supplied template engine.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { staticFile } from 'remotion';
import { buildSets, type Kit, type Sets, V } from './build';
import { ctex, cloudHD } from './paint';
import { TONE, CHAR, untone } from './shade';
import { NOINK } from './ink';
import { Cast } from './cast';
import { SHOTS, camAt, eventFrame, smooth, type LightName } from './story';
import { lightFor, lookFor } from './look';
let pending:Promise<Kit>|null=null;
export function loadKit(){return pending??=Promise.all(['tree_oak','tree_default','plant_bushLarge','plant_bush'].map(async n=>[n,(await new GLTFLoader().loadAsync(staticFile('projects/ten-thousand-steps-3d/kit/'+n+'.glb'))).scene] as const)).then(p=>Object.fromEntries(p));}
const softDisc=(name:string)=>ctex(name,256,256,g=>{const r=g.createRadialGradient(128,128,0,128,128,128);r.addColorStop(0,'rgba(255,255,255,.65)');r.addColorStop(.25,'rgba(255,255,255,.35)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,256,256);});
export class World {
  root=new THREE.Group();private sets:Sets;private cast:Cast;private sun=new THREE.DirectionalLight();private hemi=new THREE.HemisphereLight();private fog=new THREE.Fog('#b8d0ec',25,300);private sky:THREE.Mesh;private skyMat:THREE.ShaderMaterial;private clouds:THREE.Mesh[]=[];private cloudMaps:Record<string,THREE.Texture[]>;private halo:THREE.Sprite;private steam:THREE.Sprite[]=[];
  constructor(kit:Kit){
    this.skyMat=new THREE.ShaderMaterial({uniforms:{c0:{value:new THREE.Color()},c1:{value:new THREE.Color()},c2:{value:new THREE.Color()},c3:{value:new THREE.Color()},c4:{value:new THREE.Color()},e:{value:new THREE.Vector4()}},vertexShader:'varying vec3 vP; void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform vec3 c0,c1,c2,c3,c4;uniform vec4 e;varying vec3 vP;void main(){float el=asin(clamp(normalize(vP).y,-1.0,1.0));vec3 c=mix(c0,c1,smoothstep(0.0,e.x,el));c=mix(c,c2,smoothstep(e.x,e.y,el));c=mix(c,c3,smoothstep(e.y,e.z,el));c=mix(c,c4,smoothstep(e.z,e.w,el));gl_FragColor=vec4(c,1.0);}',side:THREE.BackSide,depthWrite:false,fog:false});
    this.sky=new THREE.Mesh(new THREE.SphereGeometry(1100,48,24),this.skyMat);this.sky.renderOrder=-10;this.sky.frustumCulled=false;this.sky.layers.set(NOINK);this.root.add(this.sky);
    this.sun.castShadow=true;this.sun.shadow.mapSize.set(4096,4096);this.sun.shadow.camera.layers.enable(NOINK);this.root.add(this.sun,this.sun.target,this.hemi);
    this.cloudMaps={day:[0,1,2,3].map(i=>cloudHD(i,lookFor('day').cloud)),golden:[0,1,2,3].map(i=>cloudHD(i,lookFor('golden').cloud))};
    for(let i=0;i<9;i++){const a=i/9*Math.PI*2,d=620+i%3*40,m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:this.cloudMaps.day[i%4],transparent:true,depthWrite:false,fog:false,color:new THREE.Color(1.1,1.1,1.1)}));m.position.set(Math.cos(a)*d,90+i%4*35,Math.sin(a)*d);m.scale.set(140+i%4*20,70+i%4*10,1);m.layers.set(NOINK);this.clouds.push(m);this.root.add(m);}
    this.halo=new THREE.Sprite(new THREE.SpriteMaterial({map:softDisc('golden-halo-steps'),color:new THREE.Color(1.4,.85,.42),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));this.halo.layers.set(NOINK);this.root.add(this.halo);
    this.sets=buildSets(this.root,kit);this.cast=new Cast(this.root);
    for(let i=0;i<4;i++){const m=new THREE.Sprite(new THREE.SpriteMaterial({map:softDisc('dinner-steam'),color:'#ead8bb',transparent:true,depthWrite:false,opacity:.2}));m.layers.set(NOINK);this.root.add(m);this.steam.push(m);}
  }
  private setLighting(light:LightName){const l=lightFor(light),k=lookFor(light);TONE.uLitCol.value.set(...l.lit);TONE.uShadeCol.value.set(...l.shade);TONE.uShadeLift.value.set(...l.lift);TONE.uLambert.value=l.lambert;TONE.uSideK.value=l.sideK;TONE.uTerm.value=l.term;TONE.uBounce.value.set(...k.bounce);TONE.uSat.value=k.sat;CHAR.uCharTint.value.set(...l.charTint);CHAR.uCharShade.value=l.charShade;CHAR.uGrad.value=l.charGrad;CHAR.uBodyGrad.value=l.bodyGrad;CHAR.uSideTint.value.set(...l.sideTint);}
  update(id:number,f:number,cam:THREE.PerspectiveCamera,scene:THREE.Scene){const s=SHOTS[id-1],c=camAt(id,f),lf=f-s.a,l=lightFor(s.light),k=lookFor(s.light),focus=V(...c.look);
    cam.position.set(...c.pos);cam.up.set(0,1,0);cam.lookAt(focus);cam.rotateZ(c.roll);cam.fov=c.fov;cam.near=.12;cam.far=1500;cam.layers.enable(NOINK);cam.updateProjectionMatrix();cam.updateMatrixWorld();
    const forward=V(s.look[0]-s.pos[0],0,s.look[2]-s.pos[2]).normalize(),az=l.az*Math.PI/180,el=l.el*Math.PI/180;
    const sunDir=s.location==='home'?V(-.16,.66,-.735).normalize():s.light==='golden'?V(Math.cos(el)*.987,Math.sin(el),Math.cos(el)*.16):V((forward.x*Math.cos(az)-forward.z*Math.sin(az))*Math.cos(el),Math.sin(el),(forward.z*Math.cos(az)+forward.x*Math.sin(az))*Math.cos(el));
    this.sun.position.copy(focus).addScaledVector(sunDir,220);this.sun.target.position.copy(focus);this.sun.color.set(l.sunCol);this.sun.intensity=l.sunI;this.hemi.color.set(l.sky);this.hemi.groundColor.set(l.ground);this.hemi.intensity=l.hemiI;
    const r=Math.max(s.light==='golden'?28:12,cam.position.distanceTo(focus)*1.15+7),sc=this.sun.shadow.camera;sc.left=sc.bottom=-r;sc.top=sc.right=r;sc.near=20;sc.far=480;sc.updateProjectionMatrix();this.sun.shadow.bias=l.bias;this.sun.shadow.normalBias=l.normalBias*r/12;
    this.setLighting(s.light);this.sky.onBeforeRender=()=>this.setLighting(s.light);
    k.sky.c.forEach((v,i)=>untone(v,this.skyMat.uniforms['c'+i].value));this.skyMat.uniforms.e.value.set(...k.sky.e.slice(1).map(v=>v*Math.PI/180));this.sky.position.copy(cam.position);untone(l.fog,this.fog.color);this.fog.near=l.fogNear;this.fog.far=l.fogFar;scene.fog=this.fog;scene.background=null;
    this.halo.visible=s.light==='golden';this.halo.position.copy(cam.position).addScaledVector(sunDir,900);this.halo.scale.setScalar(760);
    this.clouds.forEach((m,i)=>{m.position.x=Math.cos(i/9*Math.PI*2)*(620+i%3*40)+f/30*.35;m.lookAt(cam.position.x,m.position.y,cam.position.z);(m.material as THREE.MeshBasicMaterial).map=this.cloudMaps[s.light==='golden'?'golden':'day'][i%4];});
    this.sets.street.visible=s.location==='street';this.sets.home.visible=s.location==='home';this.sets.study.visible=id===10;this.sets.porch.visible=id===4;
    this.sets.fridgeDoor.rotation.y=id===8?1.18+.12*smooth(lf/40):0;
    this.sets.jar.visible=id===12||id===13;this.sets.desk.visible=id===11;
    for(let i=0;i<this.sets.coins.length;i++){const coin=this.sets.coins[i];coin.visible=i<3;if(i>=3)continue;const impact=eventFrame(['coin-one','coin-two','coin-three'][i]),fall=18,age=f-impact;
      coin.visible=(i===0||f>=impact-fall)&&(id===12||id===13);const yEnd=.035+i*.029;
      let h=age<0?yEnd+.90*(1-smooth((age+fall)/fall)):yEnd+.065*Math.exp(-age/8)*Math.abs(Math.sin(age*.57));
      coin.position.set(i*.025-.025,h,i*.022-.023);coin.rotation.set(age<0?1.1+(age+18)*.14:Math.exp(-age/9)*.6,age*.2,age<0?.3:Math.sin(age*.4)*Math.exp(-age/10)*.3);}
    this.steam.forEach((m,i)=>{m.visible=id===4;const age=((f-s.a)/42+i/4)%1;m.position.set(1.95+.035*Math.sin(age*6+i),1.06+age*.54,-1.48);m.scale.set(.12+age*.2,.20+age*.24,1);(m.material as THREE.SpriteMaterial).opacity=.21*(1-age)*(1-smooth(lf/85));});
    this.cast.update(id,f,cam,sunDir);return focus;
  }
}
