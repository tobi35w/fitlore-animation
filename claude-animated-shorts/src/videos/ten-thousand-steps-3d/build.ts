// Shared batching and painted materials from the template; residential geometry is defined below.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { brick, rng, ctex, rep, facadeHD, roofHD, stoneHD, grassHD, cobbleHD, planksHD, beam } from "./paint";
import { twoTone } from "./shade";

export type Kit = Record<string, THREE.Object3D>;
export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ---------------- materials (shared, cached) ----------------
const mats = new Map<string, THREE.Material>();
export const lam = (key: string, make: () => THREE.MeshLambertMaterialParameters) => {
  let m = mats.get(key) as THREE.MeshLambertMaterial | undefined;
  if (!m) {
    m = twoTone(new THREE.MeshLambertMaterial(make()));
    mats.set(key, m);
  }
  return m;
};
const lamOf = new Map<string, THREE.MeshLambertMaterial>();
// the nature kit ships a teal palette; our valley wants storybook greens and browns
const GREENS = ["#62ae4c", "#56a447", "#72b853"];
const RECOLOR: Record<string, string> = { grass: "#6aab4f", leafsDark: "#4a9142", woodBark: "#8a5a3c", woodInner: "#e8cfa4", wood: "#a8724a",
  woodDark: "#7a4f33", dirt: "#8a6a4a", stone: "#b7b4ad" };
/** Kenney GLB materials -> Lambert, so the whole world shares one lighting model */
const toLambert = (m: THREE.Material) => {
  let l = lamOf.get(m.uuid);
  if (!l) {
    const s = m as THREE.MeshStandardMaterial;
    const col = m.name === "leafsGreen" ? GREENS[lamOf.size % 3] : RECOLOR[m.name];
    l = twoTone(new THREE.MeshLambertMaterial({ color: col ? new THREE.Color(col) : s.color?.clone() ?? new THREE.Color("#ffffff"), map: s.map ?? null, side: s.side, alphaTest: s.alphaTest }));
    lamOf.set(m.uuid, l);
  }
  return l;
};

// ---------------- geometry pieces ----------------
const f32 = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) => {
  const out = new Float32Array(a.count * a.itemSize);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
  return new THREE.Float32BufferAttribute(out, a.itemSize);
};
/** quad a,b,c,d counter-clockwise seen from its front; uv (u0,v0) at a, (u1,v1) at c */
export const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, u1 = 1, v1 = 1, u0 = 0, v0 = 0) => {
  const g = new THREE.BufferGeometry();
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a)).normalize();
  g.setAttribute("position", new THREE.Float32BufferAttribute([a, b, c, a, c, d].flatMap((v) => [v.x, v.y, v.z]), 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 2, 3, 4, 5].flatMap(() => [n.x, n.y, n.z]), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1], 2));
  return g;
};
export const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
  const g = new THREE.BufferGeometry();
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
  g.setAttribute("position", new THREE.Float32BufferAttribute([a, b, c].flatMap((v) => [v.x, v.y, v.z]), 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 2].flatMap(() => [n.x, n.y, n.z]), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
  return g;
};
/** axis box from min to max, texture tiled every `tile` metres (0 = one image per face) */
export const boxGeo = (min: THREE.Vector3, max: THREE.Vector3, tile = 0, bottom = false) => {
  const [x0, y0, z0] = [min.x, min.y, min.z], [x1, y1, z1] = [max.x, max.y, max.z];
  const t = (a: number) => (tile ? a / tile : 1);
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  const faces = [
    quad(V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1), t(w), t(h)),
    quad(V(x1, y0, z0), V(x0, y0, z0), V(x0, y1, z0), V(x1, y1, z0), t(w), t(h)),
    quad(V(x0, y0, z0), V(x0, y0, z1), V(x0, y1, z1), V(x0, y1, z0), t(d), t(h)),
    quad(V(x1, y0, z1), V(x1, y0, z0), V(x1, y1, z0), V(x1, y1, z1), t(d), t(h)),
    quad(V(x0, y1, z1), V(x1, y1, z1), V(x1, y1, z0), V(x0, y1, z0), t(w), t(d)),
  ];
  if (bottom) faces.push(quad(V(x0, y0, z0), V(x1, y0, z0), V(x1, y0, z1), V(x0, y0, z1), t(w), t(d)));
  return mergeGeometries(faces, false);
};

/** collects pieces by material and merges them into one static mesh per material */
export class Batch {
  private g = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(geo: THREE.BufferGeometry, mat: THREE.Material, m?: THREE.Matrix4) {
    const src = geo.index ? geo.toNonIndexed() : geo;
    const x = new THREE.BufferGeometry();
    x.setAttribute("position", f32(src.attributes.position));
    if (src.attributes.normal) x.setAttribute("normal", f32(src.attributes.normal)); else x.computeVertexNormals();
    x.setAttribute("uv", src.attributes.uv ? f32(src.attributes.uv) : new THREE.Float32BufferAttribute(new Float32Array(src.attributes.position.count * 2), 2));
    if (m) x.applyMatrix4(m);
    const l = this.g.get(mat);
    if (l) l.push(x); else this.g.set(mat, [x]);
  }
  addObject(o: THREE.Object3D, m: THREE.Matrix4) {
    o.updateMatrixWorld(true);
    o.traverse((c) => {
      const mesh = c as THREE.Mesh;
      if (!mesh.isMesh) return;
      this.add(mesh.geometry, toLambert(Array.isArray(mesh.material) ? mesh.material[0] : mesh.material), new THREE.Matrix4().multiplyMatrices(m, mesh.matrixWorld));
    });
  }
  build(parent: THREE.Object3D, cast = true) {
    for (const [mat, list] of this.g) {
      const mesh = new THREE.Mesh(mergeGeometries(list, false), mat);
      mesh.castShadow = cast; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
      parent.add(mesh);
    }
    this.g.clear();
  }
}

const box = (b: Batch, m: THREE.Material, x: number,y: number,z: number,w: number,h: number,d: number,tile=0) => b.add(boxGeo(V(x-w/2,y,z-d/2),V(x+w/2,y+h,z+d/2),tile),m);
const mat = (key: string, color: string) => lam(key,()=>({color}));
const mm = (x:number,y:number,z:number,s=1,ry=0) => new THREE.Matrix4().compose(V(x,y,z),new THREE.Quaternion().setFromAxisAngle(V(0,1,0),ry),V(s,s,s));

function addKit(b:Batch,kit:Kit,key:string,x:number,y:number,z:number,h:number,angle=0){
  const o=kit[key];if(!o)return;const bb=new THREE.Box3().setFromObject(o),size=bb.getSize(V(0,0,0)),s=h/size.y;
  b.addObject(o,new THREE.Matrix4().multiplyMatrices(mm(x,y,z,s,angle),new THREE.Matrix4().makeTranslation(-(bb.min.x+bb.max.x)/2,-bb.min.y,-(bb.min.z+bb.max.z)/2)));
}

export function house(b:Batch,x:number,z:number,w:number,h:number,color:string,roof:string,key:string){
  const d=5,front=z+d/2;
  const wall=lam('facade-'+key,()=>({map:facadeHD(key,w,h,{wall:color,shutter:'#7a8893',door:key!=='h0'})}));
  const side=lam('side-'+key,()=>({map:facadeHD(key+'side',d,h,{wall:color,shutter:'#7a8893'})}));
  const roofM=lam('roof-'+roof,()=>({map:roofHD(roof)}));
  b.add(quad(V(x-w/2,0,front),V(x+w/2,0,front),V(x+w/2,h,front),V(x-w/2,h,front)),wall);
  b.add(quad(V(x-w/2,0,z-d/2),V(x-w/2,0,front),V(x-w/2,h,front),V(x-w/2,h,z-d/2)),side);
  b.add(quad(V(x+w/2,0,front),V(x+w/2,0,z-d/2),V(x+w/2,h,z-d/2),V(x+w/2,h,front)),side);
  const ridge=h+1.5,rz=z-.3;
  b.add(quad(V(x-w/2-.22,h,front+.25),V(x+w/2+.22,h,front+.25),V(x+w/2+.22,ridge,rz),V(x-w/2-.22,ridge,rz),w/4,1),roofM);
  b.add(quad(V(x+w/2+.22,h,z-d/2-.25),V(x-w/2-.22,h,z-d/2-.25),V(x-w/2-.22,ridge,rz),V(x+w/2+.22,ridge,rz),w/4,1),roofM);
  const end=mat('gable-'+color,color);b.add(tri(V(x-w/2,h,z-d/2),V(x-w/2,h,front),V(x-w/2,ridge,rz)),end);b.add(tri(V(x+w/2,h,front),V(x+w/2,h,z-d/2),V(x+w/2,ridge,rz)),end);
  const trim=mat('cream-trim','#e6ddc7');box(b,trim,x,h-.12,front+.06,w+.3,.16,.15);
  box(b,mat('brick-chimney','#b9826d'),x-w*.32,h+.55,z-.7,.55,1.1,.5);box(b,trim,x-w*.32,h+1.65,z-.7,.68,.12,.6);
  for(const s of [-1,1]){box(b,trim,x+s*(w/2-.15),0,front+.06,.2,h,.12);}
  box(b,mat('porch-slab','#c4b8a1'),x,.014,front+.48,1.5,.11,.84,2);
  const planter=mat('terracotta-pot','#c98c72');
  for(const sx of [x-w*.38,x+w*.38]){b.add(new THREE.CylinderGeometry(.25,.18,.38,10),planter,mm(sx,.23,front+.37));}
}

function lamp(b:Batch,x:number,z:number){const iron=mat('lamp-iron','#566071'),glass=mat('lamp-glass','#e6d4a3');
  box(b,iron,x,0,z,.10,3.4,.1);box(b,iron,x,3.30,z,.47,.12,.42);box(b,glass,x,3.42,z,.35,.39,.3);box(b,iron,x,3.81,z,.49,.12,.43);b.add(new THREE.ConeGeometry(.32,.3,4),iron,mm(x,4,z,1,Math.PI/4));}
function bench(b:Batch,x:number,z:number){const wood=lam('wood',()=>({map:beam()})),iron=mat('bench-iron','#58636c');
  for(const s of [-1,1]){box(b,iron,x+s*.65,0,z,.09,.49,.5);box(b,iron,x+s*.65,.25,z-.23,.08,.66,.08);}
  for(let i=0;i<4;i++)box(b,wood,x,.47,z-.25+i*.15,1.8,.06,.12,1);
  for(let i=0;i<3;i++)box(b,wood,x,.69+i*.13,z-.27,1.8,.095,.065,1);
}
function car(b:Batch,x:number,z:number){const green=mat('car-body','#7eaaa1'),glass=mat('car-windows','#506d88'),rubber=mat('tire','#383340'),trim=mat('car-trim','#dcd7c9');
  box(b,green,x,.35,z,3.25,.53,1.45);box(b,green,x-.18,.88,z,1.8,.56,1.28);box(b,glass,x-.18,1.02,z+.646,1.5,.29,.02);box(b,glass,x-.18,1.02,z-.646,1.5,.29,.02);box(b,trim,x+1.63,.46,z,.1,.16,1.27);
  for(const sx of [-1,1])for(const sz of [-1,1]){const g=new THREE.CylinderGeometry(.31,.31,.2,16);g.rotateX(Math.PI/2);b.add(g,rubber,mm(x+sx*1.03,.34,z+sz*.72));b.add(new THREE.CircleGeometry(.15,12),trim,mm(x+sx*1.03,.34,z+sz*.83,1,sz>0?0:Math.PI));}}

export type Sets = { street:THREE.Group; home:THREE.Group; fridgeDoor:THREE.Group; jar:THREE.Group; coins:THREE.Mesh[]; leaves:THREE.Mesh[]; steam:THREE.Mesh[]; desk:THREE.Group; study:THREE.Group; porch:THREE.Group };

/** Three sets share a coherent palette and real perspective, without any painted picture panels. */
export function buildSets(parent:THREE.Object3D,kit:Kit):Sets {
  const street=new THREE.Group(),home=new THREE.Group(),b=new Batch();parent.add(street,home);
  const grass=lam('grassHD',()=>({map:grassHD()})),stone=lam('paving',()=>({map:cobbleHD()})),curb=lam('curb',()=>({map:stoneHD('copeHD')}));
  const road=lam('road',()=>({map:ctex('road-paint',1024,1024,(g,r)=>{g.fillStyle='#9b998d';g.fillRect(0,0,1024,1024);for(let i=0;i<300;i++){g.fillStyle=i%2?'rgba(239,228,202,.14)':'rgba(83,75,64,.09)';g.fillRect(r()*1024,r()*1024,2+r()*4,2);}})}));
  box(b,grass,0,-.3,0,300,.28,160,4);box(b,road,0,-.03,4.9,180,.035,5.7,4);box(b,stone,0,-.024,-.4,180,.05,4.7,4);box(b,curb,0,-.07,1.95,180,.16,.20,2);box(b,curb,0,-.07,7.75,180,.16,.2,2);
  const palette=['#d9cbb6','#d5a99a','#b8c9bd','#d4b993','#c5c6b4'];
  for(let i=-6;i<=8;i++){const x=i*8.2;if(i!==5)house(b,x,-5.4,6.4,3.25+(Math.abs(i)%3)*.42,palette[(i+10)%5],['#bd8c7d','#9ea0a4','#b78373'][(i+9)%3],'h'+i);
    addKit(b,kit,i%2?'tree_oak':'tree_default',x+3.72,0,-3.4,3.2+(i%3)*.14,i);
    addKit(b,kit,'plant_bushLarge',x-2.3,0,-2.65,.7,i);addKit(b,kit,'plant_bush',x+2.3,0,-2.5,.7,i+2);
    if(i%2===0)lamp(b,x+5.4,1.4);
    if(i%3===0)bench(b,x-3.1,-2.35);
  }
  // Marcus's door, brass handle, mat, mailbox and planters make the callback location recognizable.
  const door=lam('front-door',()=>({map:ctex('front-door-grain',256,512,(g)=>{g.fillStyle='#5c8c88';g.fillRect(0,0,256,512);g.strokeStyle='#366565';g.lineWidth=5;for(const y of [55,265])g.strokeRect(28,y,200,190);})}));
  box(b,door,0,.05,-2.872,1.18,2.08,.10);box(b,mat('door-handle','#c5a567'),.37,.95,-2.8,.06,.18,.075);
  box(b,lam('doormat',()=>({map:ctex('doormat',256,128,(g)=>{g.fillStyle='#86735e';g.fillRect(0,0,256,128);g.strokeStyle='#a99679';g.lineWidth=3;for(let y=5;y<128;y+=9){g.beginPath();g.moveTo(0,y);g.lineTo(256,y);g.stroke();}})})),0,.06,-2.1,1.05,.015,.48);
  box(b,mat('mailbox-post','#6e5844'),2.8,0,-1.0,.11,.78,.11);box(b,mat('mailbox','#7b8894'),2.8,.77,-1.0,.48,.28,.3);
  car(b,-4.7,4.7);
  for(let i=0;i<9;i++){
    const m=new THREE.Matrix4().makeScale(15+i%3*4,4+i%3*2,10);m.setPosition(-65+i*18,0,-37-i%2*13);
    b.add(new THREE.SphereGeometry(1,18,10),mat('distant-hill'+i%3,['#8aab81','#839f89','#799894'][i%3]),m);
  }
  // School approach: a lower terracotta building, broad door, tiled path and planted forecourt.
  house(b,40,-7.7,10,4.1,'#d8c6a4','#c39580','school');
  box(b,stone,40,.002,-3.5,3.2,.04,4.0,4);
  for(const x of [39.2,40.8])box(b,mat('school-trim','#d7ceaf'),x,0,-4.95,.18,2.6,.28);
  box(b,mat('school-trim','#d7ceaf'),40,2.55,-4.95,1.8,.18,.34);
  b.add(new THREE.CylinderGeometry(.10,.21,.25,16),mat('school-bell','#b99955'),mm(40,2.95,-4.95));
  for(const x of [35,45]){box(b,curb,x,0,-2.5,.65,1.6,.65,2);addKit(b,kit,'tree_oak',x+.7,0,-4,4.7);}
  b.build(street);

  home.position.x=100;const h=new Batch(),wall=lam('home-wall',()=>({map:ctex('home-plaster',512,512,(g,r)=>{g.fillStyle='#d9c9b0';g.fillRect(0,0,512,512);for(let i=0;i<18;i++){g.fillStyle='rgba(244,235,215,.09)';g.beginPath();g.ellipse(r()*512,r()*512,35+r()*90,30+r()*60,0,0,Math.PI*2);g.fill();}})}));
  box(h,lam('floor',()=>({map:planksHD()})),0,-.12,0,8,.12,8,2);
  // A real opening admits the key through the window and projects the mullions on the floor.
  box(h,wall,0,0,-3.4,8,1.2,.16,4);box(h,wall,0,3.06,-3.4,8,.64,.16,4);
  box(h,wall,-3.325,1.2,-3.4,1.35,1.86,.16,4);box(h,wall,1.825,1.2,-3.4,4.35,1.86,.16,4);
  box(h,wall,-4,0,-.8,.16,3.7,5.2,4);box(h,wall,4,0,-.8,.16,3.7,5.2,4);
  const wood=lam('home-wood',()=>({map:beam()})),ivory=mat('home-ivory','#e2d8c1'),teal=mat('cupboard','#779d91');
  box(h,teal,-1.2,0,-2.7,3.8,.87,.85);box(h,ivory,-1.2,.88,-2.7,3.95,.075,.97);
  for(let i=0;i<4;i++){box(h,wood,-2.65+i*.92,.35,-2.20,.68,.01,.02);box(h,mat('handle-metal','#82888e'),-2.65+i*.92,.63,-2.17,.22,.025,.04);}
  box(h,wood,-.6,.78,.2,2.3,.10,1.45,1);for(const sx of [-1,1])for(const sz of [-1,1])box(h,wood,-.6+sx*.98,0,.2+sz*.53,.10,.78,.10);
  // Window frame, curtains and light pool are geometric and tint the room through the scene light rig.
  for(const x of [-2.65,-.35,-1.5])box(h,ivory,x,1.2,-3.25,.07,1.86,.06);
  for(const y of [1.2,2.18,3.06])box(h,ivory,-1.5,y,-3.25,2.38,.065,.06);
  box(h,mat('curtain','#b98078'),-2.85,1.17,-3.17,.36,2.02,.13);box(h,mat('curtain','#b98078'),-.18,1.17,-3.17,.36,2.02,.13);
  const fridge=mat('fridge','#bed1c7'),inside=mat('fridge-inside','#a6b7a9');
  box(h,fridge,2.35,0,-2.57,1.3,2.25,1.2);box(h,inside,2.35,.12,-1.95,1.08,1.99,.04);
  for(const y of [.45,1.0,1.54])box(h,ivory,2.35,y,-1.85,1.03,.04,.4);
  const fridgeDoor=new THREE.Group();fridgeDoor.position.set(3.0,0,-1.77);home.add(fridgeDoor);const d=new Batch();box(d,fridge,-.65,.02,0,1.3,2.22,.1);box(d,mat('fridge-handle','#657b76'),-1.12,1.0,.08,.06,.65,.1);d.build(fridgeDoor);
  // Story dressing: cup, kettle, towel, plate, plant, stool, books, wall clock, bowl.
  h.add(new THREE.CylinderGeometry(.1,.085,.21,14),mat('cup','#dda679'),mm(-1.25,.99,-2.55));
  h.add(new THREE.SphereGeometry(.22,16,10),mat('kettle','#979f94'),mm(-2.4,1.10,-2.6));box(h,mat('towel','#a9b5c6'),-2.0,.49,-2.11,.35,.44,.025);
  h.add(new THREE.CylinderGeometry(.32,.28,.025,28),ivory,mm(-1.15,.91,.37));h.add(new THREE.CylinderGeometry(.20,.14,.12,24),mat('bowl','#ccb895'),mm(-1.15,.97,.37));
  addKit(h,kit,'plant_bush',.6,.98,-2.72,.45);h.add(new THREE.CylinderGeometry(.15,.1,.22,12),mat('pot-home','#cc9479'),mm(.6,1.0,-2.72));
  box(h,wood,-2.4,.45,.6,.55,.08,.55);for(const s of [-1,1])box(h,wood,-2.4+s*.2,0,.6,.07,.45,.35);
  for(let i=0;i<3;i++)box(h,mat('book'+i,['#778b9e','#b67b70','#c7ad75'][i]),1.15,.05+i*.13,-3,.75,.1,.5);
  h.add(new THREE.CylinderGeometry(.34,.34,.08,32).rotateX(Math.PI/2),wood,mm(.9,2.8,-3.27));
  h.add(new THREE.CircleGeometry(.28,32),ivory,mm(.9,2.8,-3.215));box(h,mat('clock-hands','#51494d'),.9,2.79,-3.2,.023,.19,.03);box(h,mat('clock-hands','#51494d'),.97,2.80,-3.2,.17,.02,.03);
  h.build(home);
  // Transparent jar with a readable rim; coins are actual 3D objects animated by the shared timeline.
  const jar=new THREE.Group();jar.position.set(-.4,.91,.25);home.add(jar);
  const glass=new THREE.MeshPhongMaterial({color:'#aed5d9',transparent:true,opacity:.22,side:THREE.DoubleSide,depthWrite:false,shininess:50});
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.26,.25,.52,40,1,true),glass);body.position.y=.26;jar.add(body);
  for(const y of [0,.52]){const ring=new THREE.Mesh(new THREE.TorusGeometry(.26,.012,8,40),mat('jar-rim','#bdd7d3'));ring.rotation.x=Math.PI/2;ring.position.y=y;jar.add(ring);}
  const coins=Array.from({length:14},(_,i)=>{const c=new THREE.Mesh(new THREE.CylinderGeometry(.10,.10,.021,24),twoTone(new THREE.MeshPhongMaterial({color:'#d0aa51',shininess:28,specular:'#bda276'})));c.castShadow=true;c.receiveShadow=true;jar.add(c);return c;});
  // Research desk contains physical books, paper and magnifier. No writing or pseudo-labels.
  const desk=new THREE.Group();home.add(desk);const db=new Batch();box(db,mat('paper','#e8dec6'),.08,.909,.48,.70,.01,.64);box(db,mat('book-cover','#7297a5'),-.95,.91,-.10,.6,.045,.67);db.build(desk);
  const magnifier=new THREE.Mesh(new THREE.TorusGeometry(.14,.02,8,28),mat('magnifier','#6b756f'));magnifier.rotation.x=-Math.PI/2;magnifier.position.set(.05,.94,.42);desk.add(magnifier);
  const handle=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.24,8),mat('magnifier','#6b756f'));handle.rotation.z=Math.PI/2;handle.position.set(.29,.94,.42);desk.add(handle);
  const leaves:THREE.Mesh[]=[],steam:THREE.Mesh[]=[];
  const study=new THREE.Group();study.position.set(23.4,0,2.1);study.add(desk.clone(true));const sb=new Batch();box(sb,wood,-.35,.79,.3,1.8,.1,1.1);for(const sx of [-1,1])for(const sz of [-1,1])box(sb,wood,-.35+sx*.72,0,.3+sz*.4,.08,.79,.08);sb.build(study);street.add(study);
  const porch=new THREE.Group(),pb=new Batch();const top=lam('porch-table-wood',()=>({map:beam()}));box(pb,top,1.95,.8,-1.5,1.05,.10,.66);for(const x of [1.53,2.37])box(pb,top,x,0,-1.5,.075,.8,.5);pb.add(new THREE.CylinderGeometry(.25,.18,.13,24),mat('porch-bowl','#d7c8aa'),mm(1.95,.955,-1.48));pb.add(new THREE.CircleGeometry(.22,24).rotateX(-Math.PI/2),mat('porch-food','#b19764'),mm(1.95,1.027,-1.48));pb.build(porch);street.add(porch);
  return {street,home,fridgeDoor,jar,coins,leaves,steam,desk,study,porch};
}

