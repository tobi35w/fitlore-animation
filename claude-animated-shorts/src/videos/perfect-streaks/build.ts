import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { beam, ctex, cobbleHD, facadeHD, grassHD, roofHD, stoneHD } from './paint';
import { twoTone } from './shade';
import { NOINK } from './ink';
import { Pen } from './toon';
import { drawCalendar } from './props';
import { PROP_ANCHORS } from './propMotion';

export type Kit = Record<string, THREE.Object3D>;
export const V = (x:number,y:number,z:number) => new THREE.Vector3(x,y,z);
const materials = new Map<string, THREE.MeshLambertMaterial>();
const lam = (key:string,make:()=>THREE.MeshLambertMaterialParameters) => {
  let material=materials.get(key);
  if(!material){material=twoTone(new THREE.MeshLambertMaterial(make()));materials.set(key,material);}
  return material;
};
const mat=(key:string,color:string)=>lam(key,()=>({color}));
const mm=(x:number,y:number,z:number,sx=1,sy=sx,sz=sx,ry=0)=>new THREE.Matrix4().compose(V(x,y,z),new THREE.Quaternion().setFromAxisAngle(V(0,1,0),ry),V(sx,sy,sz));

const f32=(attribute:THREE.BufferAttribute|THREE.InterleavedBufferAttribute)=>{
  const data=new Float32Array(attribute.count*attribute.itemSize);
  for(let i=0;i<attribute.count;i++)for(let k=0;k<attribute.itemSize;k++)data[i*attribute.itemSize+k]=attribute.getComponent(i,k);
  return new THREE.Float32BufferAttribute(data,attribute.itemSize);
};
export const quad=(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,d:THREE.Vector3,u=1,v=1)=>{
  const geometry=new THREE.BufferGeometry(),normal=b.clone().sub(a).cross(d.clone().sub(a)).normalize();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([a,b,c,a,c,d].flatMap(p=>[p.x,p.y,p.z]),3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(Array.from({length:6},()=>[normal.x,normal.y,normal.z]).flat(),3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,u,0,u,v,0,0,u,v,0,v],2));return geometry;
};
export const boxGeo=(min:THREE.Vector3,max:THREE.Vector3,tile=0)=>{
  const w=max.x-min.x,h=max.y-min.y,d=max.z-min.z,t=(n:number)=>tile?n/tile:1;
  return mergeGeometries([
    quad(V(min.x,min.y,max.z),V(max.x,min.y,max.z),V(max.x,max.y,max.z),V(min.x,max.y,max.z),t(w),t(h)),
    quad(V(max.x,min.y,min.z),V(min.x,min.y,min.z),V(min.x,max.y,min.z),V(max.x,max.y,min.z),t(w),t(h)),
    quad(V(min.x,min.y,min.z),V(min.x,min.y,max.z),V(min.x,max.y,max.z),V(min.x,max.y,min.z),t(d),t(h)),
    quad(V(max.x,min.y,max.z),V(max.x,min.y,min.z),V(max.x,max.y,min.z),V(max.x,max.y,max.z),t(d),t(h)),
    quad(V(min.x,max.y,max.z),V(max.x,max.y,max.z),V(max.x,max.y,min.z),V(min.x,max.y,min.z),t(w),t(d)),
    quad(V(min.x,min.y,min.z),V(max.x,min.y,min.z),V(max.x,min.y,max.z),V(min.x,min.y,max.z),t(w),t(d)),
  ],false);
};

export class Batch {
  private geometry=new Map<THREE.Material,THREE.BufferGeometry[]>();
  add(geometry:THREE.BufferGeometry,material:THREE.Material,matrix?:THREE.Matrix4){
    const src=geometry.index?geometry.toNonIndexed():geometry,g=new THREE.BufferGeometry();
    g.setAttribute('position',f32(src.attributes.position));
    if(src.attributes.normal)g.setAttribute('normal',f32(src.attributes.normal));else g.computeVertexNormals();
    g.setAttribute('uv',src.attributes.uv?f32(src.attributes.uv):new THREE.Float32BufferAttribute(new Float32Array(src.attributes.position.count*2),2));
    if(matrix)g.applyMatrix4(matrix);
    const list=this.geometry.get(material);if(list)list.push(g);else this.geometry.set(material,[g]);
  }
  addObject(object:THREE.Object3D,matrix:THREE.Matrix4){
    object.updateMatrixWorld(true);
    object.traverse(child=>{
      const mesh=child as THREE.Mesh;if(!mesh.isMesh)return;
      const source=(Array.isArray(mesh.material)?mesh.material[0]:mesh.material) as THREE.MeshStandardMaterial;
      const recolor:Record<string,string>={leafsGreen:'#709d57',leafsDark:'#507949',grass:'#789c62',woodBark:'#947052',woodInner:'#c7ae81',wood:'#a28061',woodDark:'#796449',dirt:'#aa9478',stone:'#b9b3a5'};
      const material=lam('kit-'+source.uuid,()=>({color:recolor[source.name]??source.color?.clone()??'#ffffff',map:source.map??null,side:source.side,alphaTest:source.alphaTest}));
      this.add(mesh.geometry,material,matrix.clone().multiply(mesh.matrixWorld));
    });
  }
  build(parent:THREE.Object3D,castShadow=true){
    for(const [material,list] of this.geometry){const mesh=new THREE.Mesh(mergeGeometries(list,false),material);mesh.castShadow=castShadow;mesh.receiveShadow=true;mesh.matrixAutoUpdate=false;parent.add(mesh);}
    this.geometry.clear();
  }
}
const box=(b:Batch,m:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number,tile=0)=>b.add(boxGeo(V(x-w/2,y,z-d/2),V(x+w/2,y+h,z+d/2),tile),m);
const round=(b:Batch,m:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number,r=.018)=>b.add(new RoundedBoxGeometry(w,h,d,2,r),m,mm(x,y+h/2,z));
const wood=()=>lam('warm-wood',()=>({map:beam()}));
const plaster=(key:string,color:string)=>lam(key,()=>({map:ctex(key+'-paint',768,768,(g,r)=>{g.fillStyle=color;g.fillRect(0,0,768,768);for(let i=0;i<28;i++){g.fillStyle=i%2?'rgba(244,234,210,.10)':'rgba(137,106,75,.06)';g.beginPath();g.ellipse(r()*768,r()*768,45+r()*100,30+r()*70,0,0,Math.PI*2);g.fill();}})}));
const terra=()=>mat('terracotta','#c6967b');
const ivory=()=>mat('warm-ivory','#e4d9bf');

function addKit(b:Batch,kit:Kit,name:string,x:number,y:number,z:number,h:number,angle=0){
  const object=kit[name];if(!object)return;const bounds=new THREE.Box3().setFromObject(object),s=h/Math.max(.01,bounds.max.y-bounds.min.y);
  b.addObject(object,mm(x,y,z,s,s,s,angle).multiply(new THREE.Matrix4().makeTranslation(-(bounds.min.x+bounds.max.x)/2,-bounds.min.y,-(bounds.min.z+bounds.max.z)/2)));
}
function pot(b:Batch,kit:Kit,x:number,z:number,h=.55){
  b.add(new THREE.CylinderGeometry(h*.43,h*.3,h,16),terra(),mm(x,h/2,z));
  b.add(new THREE.TorusGeometry(h*.41,.035,8,24).rotateX(Math.PI/2),terra(),mm(x,h,z));
  addKit(b,kit,'plant_bushLarge',x,h-.05,z,h*.95,x+z);
}
function table(b:Batch,x:number,z:number,width:number,depth:number){
  box(b,wood(),x,.81,z,width,.09,depth,1);
  for(const sx of [-1,1])for(const sz of [-1,1])box(b,wood(),x+sx*(width/2-.12),0,z+sz*(depth/2-.12),.095,.82,.095);
  for(const sx of [-1,1])box(b,wood(),x+sx*(width/2-.12),.35,z,.07,.09,depth-.1);
}
function windowFrame(b:Batch,x:number,y:number,z:number,w:number,h:number){
  box(b,mat('window-blue','#8d9ab3'),x,y,z,w,h,.04);
  const trim=ivory();for(const sx of [-1,1])box(b,trim,x+sx*w/2,y-.05,z+.035,.075,h+.1,.08);
  for(const yy of [y-.05,y+h*.5,y+h])box(b,trim,x,yy,z+.035,w+.1,.07,.09);
  box(b,trim,x,y,z+.05,.065,h,.08);box(b,trim,x,y-.13,z+.1,w+.27,.095,.22);
  for(const sx of [-1,1])box(b,mat('shutter-sage','#79978e'),x+sx*(w/2+.22),y,z,.32,h,.07);
}
function backdropHouse(b:Batch,x:number,z:number,w:number,h:number,key:string,color:string){
  const front=lam('facade-'+key,()=>({map:facadeHD(key,w,h,{wall:color,shutter:'#738b91',door:true})}));
  b.add(quad(V(x-w/2,0,z),V(x+w/2,0,z),V(x+w/2,h,z),V(x-w/2,h,z)),front);
  box(b,plaster('side-'+key,color),x-w/2,0,z-2,.14,h,4,3);
  box(b,plaster('side-'+key,color),x+w/2,0,z-2,.14,h,4,3);
  const roof=lam('roof-muted',()=>({map:roofHD('#b68c7e')}));
  b.add(quad(V(x-w/2-.15,h,z+.2),V(x+w/2+.15,h,z+.2),V(x+w/2+.15,h+1.4,z-2),V(x-w/2-.15,h+1.4,z-2),w/4,1),roof);
  box(b,ivory(),x,h-.14,z+.02,w+.2,.14,.18);box(b,terra(),x+w*.24,h+.5,z-1.2,.43,1.35,.43);
}
function landscape(b:Batch,kit:Kit,variant:number){
  box(b,lam('grass',()=>({map:grassHD()})),0,-.21,0,260,.18,260,4);
  for(let i=0;i<8;i++){const x=-65+i*19,z=-52-(i%3)*12;b.add(new THREE.SphereGeometry(1,20,12),mat('hill-'+(i%3),['#93b188','#839e89','#90aa91'][i%3]),mm(x,-.8,z,16+i%3*5,4+i%3*2,13));}
  for(const [x,z,h] of [[-7.6,-7.8,4.6],[9.5,-7.5,4.1],[-12,-15,6.2],[12,-18,5.8],[-19,-24,6],[22,-27,7.4],[-30,-38,8],[34,-40,8.5]])addKit(b,kit,'tree_oak',x,0,z,h,x+variant);
  backdropHouse(b,-10,-15,7,4.7,'back-a-'+variant,'#d5c6ab');backdropHouse(b,8.9,-18,7.8,5.1,'back-b-'+variant,'#cba18b');
}

const brickMaterials=new Map<number,THREE.Material>();
function brickMaterial(i:number){
  const k=((i%4)+4)%4;let material=brickMaterials.get(k);if(material)return material;
  material=lam('story-brick-'+k,()=>({map:ctex('story-brick-paint-'+k,512,256,(g,r)=>{g.fillStyle=['#ba7d60','#c28c69','#b78068','#cf9879'][k];g.fillRect(0,0,512,256);g.fillStyle='rgba(243,210,168,.18)';g.fillRect(0,0,512,16);g.fillStyle='rgba(111,66,48,.12)';g.fillRect(0,232,512,24);for(let n=0;n<28;n++){g.fillStyle=n%2?'rgba(240,210,177,.16)':'rgba(110,72,53,.13)';g.fillRect(r()*512,r()*256,2+r()*6,2+r()*4);}})}));brickMaterials.set(k,material);return material;
}
const brickMesh=(w:number,h:number,d:number,i=0)=>{const m=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,.013),brickMaterial(i));m.castShadow=true;m.receiveShadow=true;return m;};
function lowWall(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,cols:number,rows:number){
  const b=new Batch(),gap=.016;
  box(b,mat('pale-mortar','#c9bea4'),x,y,z,cols*(w+gap)-gap,.025,d+.035);
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    if(row===rows-1&&col>=cols-2)continue;
    const xx=x-(cols*(w+gap)-gap)/2+w/2+col*(w+gap),yy=y+.025+row*(h+gap);
    round(b,brickMaterial(row+col),xx,yy,z,w,h,d,.012);
    if(row<rows-1)box(b,mat('pale-mortar','#c9bea4'),xx,yy+h,z,w+.01,gap,d-.015);
  }
  b.build(parent);
}

export type CalendarProp={mesh:THREE.Mesh;canvas:HTMLCanvasElement;texture:THREE.CanvasTexture;draw:(before:number,after:number)=>void;pose:(kind:'stand'|'flat'|'unroll',progress?:number,flutter?:number)=>void};
function calendarProp(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number):CalendarProp{
  const canvas=document.createElement('canvas');canvas.width=600;canvas.height=800;const context=canvas.getContext('2d')!,texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
  texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;
  const geometry=new THREE.PlaneGeometry(w,h,8,32),original=new Float32Array(geometry.attributes.position.array as Float32Array);
  // The tracker face remains readable under the blue study light; its backing and surrounding objects carry the key.
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,alphaTest:.4}));mesh.layers.set(NOINK);mesh.position.set(x,y,z);mesh.renderOrder=1;parent.add(mesh);
  let previous='',poseKey='';
  const draw=(before:number,after:number)=>{const key=before.toFixed(3)+','+after.toFixed(3);if(key===previous)return;previous=key;context.clearRect(0,0,600,800);drawCalendar(new Pen(context),10,30,580,748,{before,after});texture.needsUpdate=true;};
  const pose=(kind:'stand'|'flat'|'unroll',progress=1,flutter=0)=>{
    const key=kind+','+progress.toFixed(4)+','+flutter.toFixed(4);if(key===poseKey)return;poseKey=key;
    const position=geometry.attributes.position as THREE.BufferAttribute;
    for(let i=0;i<position.count;i++){
      const xx=original[i*3],yy=original[i*3+1],t=(h/2-yy)/h;
      if(kind==='stand')position.setXYZ(i,xx,yy+h/2+.012,-yy*.10+flutter*Math.sin(t*Math.PI)*Math.sin(xx*5+progress));
      else if(kind==='flat')position.setXYZ(i,xx,.008+flutter*Math.max(0,(t-.2)/.8)**3*(.5+.5*Math.sin(xx*4)),-yy);
      else {const q=Math.max(0,Math.min(1,progress)),length=Math.max(0,(t-q)*h),radius=.11,theta=length/radius;position.setXYZ(i,xx,.008+(t>q?radius*(1-Math.cos(theta)):0),-h/2+Math.min(t,q)*h+(t>q?radius*Math.sin(theta):0));}
    }
    position.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
  };
  draw(22,0);pose('stand');return{mesh,canvas,texture,draw,pose};
}

function shoe():THREE.Group{
  const group=new THREE.Group(),shape=new THREE.Shape();shape.moveTo(-.24,.045);shape.lineTo(.23,.045);shape.quadraticCurveTo(.31,.055,.28,.13);shape.quadraticCurveTo(.19,.18,.075,.17);shape.lineTo(-.045,.29);shape.lineTo(-.20,.29);shape.quadraticCurveTo(-.27,.20,-.24,.045);
  const upper=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.205,bevelEnabled:true,bevelSize:.015,bevelThickness:.014,bevelSegments:2,steps:1}),mat('shoe-upper','#ec8a3b'));upper.rotation.y=-Math.PI/2;upper.position.x=.1025;upper.castShadow=true;upper.receiveShadow=true;group.add(upper);
  const sole=new THREE.Mesh(new RoundedBoxGeometry(.255,.047,.585,2,.02),mat('shoe-sole','#dfd8c7'));sole.position.set(0,.035,.015);sole.castShadow=true;sole.receiveShadow=true;group.add(sole);
  for(let i=0;i<3;i++){const lace=new THREE.Mesh(new THREE.CylinderGeometry(.009,.009,.18,8),ivory());lace.rotation.z=Math.PI/2;lace.position.set(0,.247-i*.025,-.037+i*.035);group.add(lace);}
  return group;
}
function boundNotebook(parent:THREE.Object3D,x:number,y:number,z:number){
  const b=new Batch();round(b,mat('notebook-cover','#758c95'),x,y,z,.98,.065,.72,.024);round(b,ivory(),x,y+.06,z,.90,.025,.66,.012);
  box(b,mat('notebook-binding','#60727d'),x,y+.063,z,.033,.034,.67);
  // A physical page curl, with blank pages rather than pseudo-scientific graphics.
  b.add(new THREE.CylinderGeometry(.027,.027,.65,12,1,true,0,Math.PI).rotateX(Math.PI/2),ivory(),mm(x+.029,y+.087,z));b.build(parent);
}
function magnifier(parent:THREE.Object3D){
  const group=new THREE.Group(),metal=twoTone(new THREE.MeshPhongMaterial({color:'#77868b',specular:'#b7c1bd',shininess:35}));
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.18,.023,10,36).rotateX(-Math.PI/2),metal);ring.castShadow=true;group.add(ring);
  const glass=new THREE.Mesh(new THREE.CircleGeometry(.156,36).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:'#c4e5dd',transparent:true,opacity:.17,depthWrite:false,side:THREE.DoubleSide}));glass.position.y=.004;glass.layers.set(NOINK);group.add(glass);
  const handle=new THREE.Mesh(new THREE.CylinderGeometry(.026,.034,.27,10).rotateZ(-Math.PI/2),wood());handle.position.x=.304;handle.castShadow=true;group.add(handle);parent.add(group);return group;
}

export type Sets={court:THREE.Group;workshop:THREE.Group;analogy:THREE.Group;courtCalendar:CalendarProp;researchCalendar:CalendarProp;binLid:THREE.Group;shoes:THREE.Group[];shoeLaces:THREE.Mesh[];puddle:THREE.Mesh;ripples:THREE.Mesh[];rain:THREE.Mesh[];windLeaves:THREE.Mesh[];magnifier:THREE.Group;flyingBrick:THREE.Mesh;looseBrick:THREE.Mesh;paperweight:THREE.Mesh;calendarStand:THREE.Group;studyLamp:THREE.Mesh;wallTarget:THREE.Vector3};

export function buildSets(parent:THREE.Object3D,kit:Kit):Sets{
  const court=new THREE.Group(),workshop=new THREE.Group(),analogy=new THREE.Group();workshop.position.x=60;analogy.position.x=120;parent.add(court,workshop,analogy);
  const paving=lam('courtyard-paving',()=>({map:cobbleHD()})),stone=lam('light-stone',()=>({map:stoneHD('copeHD')}));
  const courtGround=new Batch();landscape(courtGround,kit,0);box(courtGround,paving,0,-.018,.4,14,.025,13,4);courtGround.build(court);
  const facade=new Batch(),wall=plaster('court-plaster','#d5c2a3');
  box(facade,wall,-3.73,0,-3.64,4.54,3.8,.20,3);box(facade,wall,2.98,0,-3.64,6.04,3.8,.20,3);box(facade,wall,-.75,2.35,-3.64,1.44,1.45,.20,3);
  box(facade,stone,0,0,-3.49,12,.25,.28,2);box(facade,wood(),0,3.73,-3.4,12.25,.16,.40,2);
  const roof=lam('court-roof',()=>({map:roofHD('#b68c7e')}));facade.add(quad(V(-6.3,3.84,-3.25),V(6.3,3.84,-3.25),V(6.3,5.3,-5.1),V(-6.3,5.3,-5.1),3.15,1),roof);
  const door=lam('court-door',()=>({map:ctex('court-door-paint',512,1024,g=>{g.fillStyle='#70968e';g.fillRect(0,0,512,1024);g.lineWidth=8;g.strokeStyle='#50756e';for(const y of [80,545])g.strokeRect(48,y,416,380);g.fillStyle='rgba(233,221,184,.1)';g.fillRect(48,80,10,845);})}));
  box(facade,door,-.75,.035,-3.49,1.26,2.3,.08);box(facade,mat('brass','#bba16b'),-.31,1.12,-3.421,.047,.19,.052);windowFrame(facade,-3.7,1.36,-3.49,1.3,1.42);windowFrame(facade,3.9,1.36,-3.49,1.3,1.42);
  // Distant scenic walls use form shading; hero props below retain real cast shadows.
  facade.build(court,false);
  const cb=new Batch();table(cb,1.4,-1,2.0,1.3);box(cb,mat('desk-pad','#a79373'),1.4,.9,-1,1.20,.025,1.22);
  box(cb,lam('mat-weave',()=>({map:ctex('woven-entry-mat',384,256,g=>{g.fillStyle='#998b6d';g.fillRect(0,0,384,256);g.strokeStyle='rgba(232,218,178,.30)';g.lineWidth=3;for(let y=8;y<256;y+=13){g.beginPath();g.moveTo(0,y);g.lineTo(384,y);g.stroke();}})})),-.72,.012,-2.24,1.3,.055,.95);
  for(const [x,z] of [[-2.1,-2.85],[5.1,-2.5],[-5.3,-2.6]])pot(cb,kit,x,z,.54);
  box(cb,wood(),-5.0,0,-2.3,.10,2.5,.10);cb.add(new THREE.TorusGeometry(.36,.055,8,24).rotateY(Math.PI/2),mat('hose','#779387'),mm(-5.0,1.32,-2.25));
  box(cb,mat('gutter','#8b9192'),5.4,.04,-3.33,.10,3.7,.10);box(cb,mat('gutter','#8b9192'),0,3.68,-3.29,11,.075,.12);
  // A closed umbrella waits at the doorway; the tapered fabric and curved handle give it a distinct silhouette.
  cb.add(new THREE.ConeGeometry(.11,.76,12),mat('umbrella-cloth','#a77974'),mm(-1.61,.71,-3.18));
  cb.add(new THREE.CylinderGeometry(.012,.012,1.30,8),mat('umbrella-shaft','#626e6d'),mm(-1.61,.66,-3.18));
  cb.add(new THREE.TorusGeometry(.075,.013,8,20,Math.PI),mat('umbrella-shaft','#626e6d'),mm(-1.535,1.285,-3.18));
  const bin=new THREE.Mesh(new THREE.CylinderGeometry(.34,.29,.78,20,1,true),mat('bin-sage','#8c9b8a'));bin.position.set(3.1,.43,.4);bin.castShadow=true;bin.receiveShadow=true;court.add(bin);
  cb.add(new THREE.CircleGeometry(.325,28).rotateX(-Math.PI/2),mat('bin-inside','#52615a'),mm(3.1,.755,.4));
  cb.add(new THREE.TorusGeometry(.34,.033,8,28).rotateX(Math.PI/2),mat('bin-rim','#758575'),mm(3.1,.83,.4));
  for(const sx of [-1,1])cb.add(new THREE.TorusGeometry(.075,.018,8,18).rotateY(Math.PI/2),mat('bin-rim','#758575'),mm(3.1+sx*.34,.64,.4));
  const binLid=new THREE.Group();binLid.position.set(3.1,.85,.15);court.add(binLid);const lid=new THREE.Mesh(new THREE.CylinderGeometry(.365,.345,.055,24),mat('bin-sage','#8c9b8a'));lid.position.z=.24;lid.castShadow=true;binLid.add(lid);
  const lidHandle=new THREE.Mesh(new THREE.TorusGeometry(.065,.016,8,18,Math.PI),mat('bin-rim','#758575'));lidHandle.position.set(0,.034,.24);binLid.add(lidHandle);
  cb.build(court);
  const courtCalendar=calendarProp(court,1.4,.925,-1,.92,1.16),calendarStand=new THREE.Group();court.add(calendarStand);const stand=new Batch();
  box(stand,wood(),1.4,.92,-1.12,.69,.045,.19);stand.build(calendarStand);
  const rearSupports=new THREE.Group(),rearStand=new Batch();calendarStand.add(rearSupports);
  for(const sx of [-1,1])box(rearStand,wood(),1.4+sx*.25,.94,-1.10,.045,.84,.06);rearStand.build(rearSupports);
  // Keep the physical supports and their shadows; nearby rear edges must not ink through the drawn paper.
  rearSupports.traverse(object=>{if((object as THREE.Mesh).isMesh)object.layers.set(NOINK);});
  const shoes=[shoe(),shoe()];shoes.forEach((s,i)=>{s.position.set(-.72+(i? .18:-.18),.0555,-2.24+(i?.025:-.025));s.rotation.y=i?.08:-.12;court.add(s);});
  const shoeLaces=Array.from({length:2},()=>{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.009,.009,1,8),ivory());mesh.castShadow=true;court.add(mesh);return mesh;});
  const paperweight=brickMesh(.32,.13,.22,1);paperweight.position.set(...PROP_ANCHORS.paperweight);court.add(paperweight);
  const puddleShape=new THREE.Shape();for(let i=0;i<=28;i++){const a=i/28*Math.PI*2,r=1+.07*Math.sin(i*2.7);const x=Math.cos(a)*r,z=Math.sin(a)*r*.63;if(i)puddleShape.lineTo(x,z);else puddleShape.moveTo(x,z);}
  const puddle=new THREE.Mesh(new THREE.ShapeGeometry(puddleShape),new THREE.MeshPhongMaterial({color:'#8199a7',transparent:true,opacity:.66,shininess:36,specular:'#b9cfdb',side:THREE.DoubleSide,depthWrite:false}));puddle.rotation.x=-Math.PI/2;puddle.position.set(.45,.013,.32);puddle.scale.set(2.8,1.45,1);puddle.layers.set(NOINK);court.add(puddle);
  const ripples=Array.from({length:5},(_,i)=>{const m=new THREE.Mesh(new THREE.RingGeometry(.28,.291,32),new THREE.MeshBasicMaterial({color:'#d3dfe2',transparent:true,opacity:.32,depthWrite:false,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.layers.set(NOINK);court.add(m);return m;});
  const rain=Array.from({length:86},(_,i)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(.004,.004,.24+(i%4)*.04,4),new THREE.MeshBasicMaterial({color:'#bacddd',transparent:true,opacity:.52,depthWrite:false}));m.rotation.z=-.15;m.layers.set(NOINK);court.add(m);return m;});
  const windLeaves=Array.from({length:5},(_,i)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(1,10,6),mat('wind-leaf-'+i,['#ba9b62','#b9a675','#8f9e72','#c1a273','#a59367'][i]));m.scale.set(.065,.016,.11);m.castShadow=true;court.add(m);return m;});

  const wb=new Batch();landscape(wb,kit,1);box(wb,paving,0,-.018,0,15,.026,14,4);wb.build(workshop);
  const back=new Batch(),workWall=plaster('workshop-plaster','#cdb89b');box(back,workWall,0,0,-4.1,11,3.7,.20,3);windowFrame(back,-3.3,1.48,-3.96,1.25,1.35);
  for(const y of [1.18,2.12])box(back,wood(),2.1,y,-3.78,3.8,.095,.47);for(const x of [.75,3.45])box(back,wood(),x,.05,-3.96,.10,2.18,.10);back.build(workshop,false);
  lowWall(workshop,.8,.005,-.3,.45,.195,.31,6,3);
  const wm=new Batch();for(let row=0;row<3;row++)for(let col=0;col<2;col++)round(wm,brickMaterial(row+col),3.8+col*.47,row*.211,-1.3,.45,.195,.31);
  wm.add(new THREE.CylinderGeometry(.26,.19,.47,20,1,true),mat('mortar-bucket','#969e9a'),mm(2.75,.25,-.9));wm.add(new THREE.CircleGeometry(.236,24).rotateX(-Math.PI/2),mat('mortar','#c9c1ae'),mm(2.75,.415,-.9));
  wm.add(new THREE.TorusGeometry(.26,.016,8,20,Math.PI),mat('tool-metal','#78858a'),mm(2.75,.51,-.9));
  box(wm,wood(),-2.6,.43,-1.0,.66,.07,.53);for(const sx of [-1,1])box(wm,wood(),-2.6+sx*.24,0,-1,.085,.44,.41);
  box(wm,mat('mortar-tray','#8d9690'),-.1,.015,-1.05,1.03,.06,.62);box(wm,mat('mortar','#c9c1ae'),-.1,.074,-1.05,.90,.035,.52);
  for(let i=0;i<3;i++)round(wm,brickMaterial(i),1.1+i*.72,1.29,-3.76,.45,.195,.31);
  const trowel=new THREE.Shape();trowel.moveTo(0,.0);trowel.lineTo(.17,.38);trowel.lineTo(-.17,.38);trowel.closePath();wm.add(new THREE.ShapeGeometry(trowel).rotateX(-Math.PI/2),mat('tool-metal','#869194'),mm(.02,.132,-.99));box(wm,wood(),.02,.125,-.62,.065,.055,.29);
  pot(wm,kit,-4.55,-2.6,.56);wm.build(workshop);

  const ab=new Batch();landscape(ab,kit,2);box(ab,paving,0,-.018,0,13,.026,13,4);table(ab,0,0,4.3,1.9);box(ab,wood(),.30,.90,-.26,2.83,.025,.72,1);
  box(ab,mat('study-clipboard','#ac9a7a'),-.65,.9,.24,.79,.022,1.01);ab.build(analogy);
  const studyBack=new Batch();box(studyBack,plaster('study-plaster','#c4c2b8'),0,0,-4.3,11,3.8,.20,3);windowFrame(studyBack,-2.9,1.2,-4.16,1.35,1.8);box(studyBack,wood(),2.3,1.4,-4.0,2.8,.09,.46);studyBack.build(analogy,false);
  const ap=new Batch();for(let i=0;i<4;i++)box(ap,mat('study-book-'+i,['#869f97','#bf8e78','#c8af78','#8399ac'][i]),2.0,1.49+i*.075,-3.99,.77,.065,.45);
  ap.add(new THREE.CylinderGeometry(.11,.09,.22,20),mat('study-cup','#c2a17b'),mm(1.65,1.015,-.60));ap.add(new THREE.TorusGeometry(.078,.015,8,20).rotateY(Math.PI/2),mat('study-cup','#c2a17b'),mm(1.79,1.025,-.60));
  ap.add(new THREE.CircleGeometry(.088,20).rotateX(-Math.PI/2),mat('cup-tea','#907259'),mm(1.65,1.126,-.60));pot(ap,kit,4.8,-2.8,.64);
  box(ap,wood(),-2.15,.90,-.55,.09,.78,.09);ap.add(new THREE.ConeGeometry(.20,.20,24,1,true),mat('desk-lamp','#9f9c85'),mm(-2.15,1.63,-.55));ap.build(analogy);
  const studyLamp=new THREE.Mesh(new THREE.SphereGeometry(.055,16,12),new THREE.MeshBasicMaterial({color:new THREE.Color(2.3,1.66,.94)}));studyLamp.position.set(-2.15,1.59,-.55);studyLamp.layers.set(NOINK);analogy.add(studyLamp);
  boundNotebook(analogy,-1.15,.901,-.49);
  const researchCalendar=calendarProp(analogy,-.65,.918,.24,.70,.92);researchCalendar.pose('flat');
  const studyMagnifier=magnifier(analogy);studyMagnifier.position.set(-.65,1.008,.24);
  lowWall(analogy,.25,.925,-.26,.36,.15,.25,6,3);
  const wallTarget=V(.814,1.357,-.26),flyingBrick=brickMesh(.36,.15,.25,2);flyingBrick.position.copy(wallTarget);analogy.add(flyingBrick);
  const looseBrick=brickMesh(.36,.15,.25,1);looseBrick.position.set(1.62,.975,.38);looseBrick.rotation.y=.14;analogy.add(looseBrick);
  return{court,workshop,analogy,courtCalendar,researchCalendar,binLid,shoes,shoeLaces,puddle,ripples,rain,windLeaves,magnifier:studyMagnifier,flyingBrick,looseBrick,paperweight,calendarStand,studyLamp,wallTarget};
}
