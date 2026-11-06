import * as THREE from 'three';
import { Pen } from './toon';
import { drawPerson, MARCUS, SALESMAN, blinkAt, walkStride, type Person, type PersonPose, type P2 } from './character';
import { NOINK } from './ink';
import { cardShade, blobMaterial, CARD_K } from './cardshade';
import { SHOTS, smooth, clamp01, eventFrame, type V3 } from './story';

const SU = .00216;
const bodyGeo = new THREE.PlaneGeometry(600 * SU, 1000 * SU);
bodyGeo.translate(0, 475 * SU, 0);

function texture(w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { canvas, tex };
}

function contact() {
  const { canvas, tex } = texture(256, 128), g = canvas.getContext('2d')!;
  g.fillStyle = 'white'; g.fillRect(0, 0, 256, 128);
  g.save(); g.scale(2, 1);
  const a = g.createRadialGradient(64, 64, 4, 64, 64, 61);
  a.addColorStop(0, '#8890a8'); a.addColorStop(.28, '#a6adc1'); a.addColorStop(1, 'white');
  g.fillStyle = a; g.fillRect(0, 0, 128, 128); g.restore();
  tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
  return tex;
}

let blobTex: THREE.Texture | null = null;

class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; shadow: THREE.Mesh; tail: THREE.Mesh; key = '';
  constructor(root: THREE.Group) {
    const t = texture(1080, 1800);
    this.canvas = t.canvas; this.tex = t.tex;
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: this.tex, alphaTest: .5, side: THREE.DoubleSide }));
    this.mesh = new THREE.Mesh(bodyGeo, this.mat);
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ map: this.tex, alphaTest: .5, depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
    this.mesh.layers.set(NOINK);
    this.mesh.receiveShadow = true;
    this.mesh.renderOrder = 1;
    this.mesh.onBeforeRender = r => {
      CARD_K.uPx.value = (r.getRenderTarget()?.height ?? r.domElement.height) / 1920;
    };
    blobTex ??= contact();
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), blobMaterial(blobTex));
    this.tail = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), blobMaterial(blobTex));
    for (const m of [this.shadow, this.tail]) {
      m.rotation.x = -Math.PI / 2; m.layers.set(NOINK); m.renderOrder = .5;
    }
    root.add(this.mesh, this.shadow, this.tail);
  }
  paint(who: Person, pose: PersonPose, detail: number) {
    const w = Math.round(600 * detail), h = Math.round(1000 * detail);
    const key = JSON.stringify([who.name, pose, detail]);
    if (key === this.key) return;
    this.key = key;
    if (this.canvas.width !== w) {
      this.tex.dispose(); this.canvas.width = w; this.canvas.height = h;
    }
    const g = this.canvas.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h);
    g.setTransform(detail, 0, 0, detail, 0, 0);
    drawPerson(new Pen(g), who, pose);
    this.tex.needsUpdate = true;
  }
}

type Place = { who: Person; pos: V3; pose: PersonPose; mirror: boolean };
const mix2 = (a: P2, b: P2, t: number): P2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function stage(id: number, f: number, right: THREE.Vector3): Place[] {
  const s = SHOTS[id - 1], lf = Math.max(0, Math.min(s.b - s.a - 1, f - s.a));
  const t = lf / 30, u = clamp01(lf / (s.b - s.a - 1)), out: Place[] = [];
  const add = (who: Person, pos: V3, pose: PersonPose = {}, mirror = false) =>
    out.push({ who, pos, pose: { phase: t, blink: blinkAt(f, who.seed), breath: Math.sin(f * .12 + who.seed), ...pose }, mirror });
  const walk = (who: Person, pos: V3, velocity: V3, pose: PersonPose = {}, cycle = 1, offset = 0) => {
    const projected = velocity[0] * right.x + velocity[2] * right.z, mirror = projected < 0;
    add(who, pos, { side: true, walking: true, stride: walkStride(Math.abs(projected), cycle), phase: (lf - offset) / (30 * cycle), ...pose }, mirror);
  };

  switch (id) {
    case 1: // Midnight pacing
      walk(MARCUS, [-0.6 + 0.3 * Math.sin(t * 2.5), 0.018, 0.2 + 0.3 * Math.cos(t * 2.5)], [0.3, 0, 0], { expr: 'nervous', headTilt: -2 });
      break;
    case 2: // Desperate calculation
      walk(MARCUS, [-0.2 + 0.25 * t, 0.018, 0.1], [0.35, 0, 0], { expr: 'nervous', hands: { left: [200, 620] }, headTilt: -3 });
      break;
    case 3: // Watch red ring insert
      add(MARCUS, [0, 0.018, 0.1], { prop: 'watch', expr: 'nervous', hands: { left: [220, 580] } });
      break;
    case 4: // Only ten thousand saves
      add(MARCUS, [0.1, 0.018, 0.2], { expr: 'shock', hands: { left: [190, 540], right: [410, 540] }, headTilt: 2 });
      break;
    case 5: // Marching past cat
      walk(MARCUS, [-0.8 + 0.45 * t, 0.018, 0.3], [0.45, 0, 0], { expr: 'stern', headTilt: -2 });
      break;
    case 6: // Toothbrush high knees
      add(MARCUS, [0.1, 0.018 + 0.06 * Math.abs(Math.sin(t * 6)), 0.1], { prop: 'toothbrush', expr: 'nervous', hands: { right: [420, 520] } });
      break;
    case 7: // Midnight toe stub collapse
      if (t < 1.2) {
        add(MARCUS, [-0.1 + 0.2 * t, 0.018, 0.1], { expr: 'shock', headTilt: 4 });
      } else {
        add(MARCUS, [0.1, 0.018, 0.1], { expr: 'shock', headTilt: -6 });
      }
      break;
    case 8: // Plus two steps registered
      add(MARCUS, [0.1, 0.018, 0.1], { prop: 'watch', expr: 'smile', hands: { left: [210, 570] } });
      break;
    case 9: // Clock salesman reveal
      add(MARCUS, [0, 0.018, 0.1], { expr: 'neutral', headTilt: 3 });
      break;
    case 10: // Not a medical prescription
      add(MARCUS, [0.2, 0.018, 0.1], { expr: 'neutral', hands: { right: [420, 620] } });
      break;
    case 11: // Manpo-kei 1965 launch
      add(SALESMAN, [0.2, 0.018, 0.1], { prop: 'pedometer', expr: 'smile', hands: { right: [430, 590] }, side: true });
      break;
    case 12: // Walking kanji character
      add(SALESMAN, [0.3, 0.018, 0.1], { expr: 'smile', hands: { right: [450, 540] } });
      break;
    case 13: // Advertising gimmick
      walk(SALESMAN, [-0.5 + 0.3 * t, 0.018, 0.2], [0.3, 0, 0], { expr: 'smile' });
      break;
    case 14: // Harvard longevity curve
      add(MARCUS, [0.1, 0.018, 0.1], { expr: 'smile', hands: { right: [430, 600] } });
      break;
    case 15: // Stealing your sleep
      add(MARCUS, [0, 0.018, 0.1], { expr: 'relief', headTilt: -4 });
      break;
    case 16: // Silencing the watch
      add(MARCUS, [0, 0.018, 0.1], { expr: 'relief', hands: { left: [230, 640] } });
      break;
    case 17: // Smiling at cat
      add(MARCUS, [0.1, 0.018, 0.1], { expr: 'smile', hands: { right: [420, 680] } });
      break;
    case 18: // Four calm steps
      walk(MARCUS, [-0.6 + 0.35 * t, 0.018, 0.2], [0.35, 0, 0], { expr: 'smile', headTilt: 1 });
      break;
    case 19: // Into bed callback
      add(MARCUS, [0.1, 0.018, 0.1], { expr: 'smile', headTilt: 2 });
      break;
  }
  return out;
}

export class Cast {
  private actors: Actor[] = [];
  constructor(private root: THREE.Group) {}
  update(id: number, f: number, cam: THREE.PerspectiveCamera, sun: THREE.Vector3) {
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    right.y = 0; right.normalize();
    const poses = stage(id, f, right), s = SHOTS[id - 1];
    poses.forEach((a, i) => {
      while (this.actors.length <= i) this.actors.push(new Actor(this.root));
      const actor = this.actors[i], pos = new THREE.Vector3(...a.pos);
      const dist = cam.position.distanceTo(pos.clone().add(new THREE.Vector3(0, 1, 0)));
      actor.paint(a.who, { ...a.pose, light: Math.atan2(-sun.y, sun.dot(right) * (a.mirror ? -1 : 1)) }, dist < 2.1 ? 3 : dist < 7 ? 1.8 : 1.1);
      actor.mesh.visible = true;
      actor.mesh.position.copy(pos);
      actor.mesh.rotation.set(0, Math.atan2(-right.z, right.x), 0);
      actor.mesh.scale.set(a.mirror ? -1 : 1, 1, 1);
      actor.mesh.castShadow = s.light === 'golden';
      actor.shadow.visible = true;
      actor.shadow.position.set(pos.x, pos.y + .003, pos.z);
      actor.shadow.scale.set(.88, .38, 1);
      actor.tail.visible = s.light === 'day';
      actor.tail.position.set(pos.x - sun.x * .4, pos.y + .002, pos.z - sun.z * .4);
      actor.tail.rotation.set(-Math.PI / 2, 0, Math.atan2(-sun.x, -sun.z));
      actor.tail.scale.set(.6, 1.4, 1);
    });
    for (let i = poses.length; i < this.actors.length; i++) {
      this.actors[i].mesh.visible = false;
      this.actors[i].shadow.visible = false;
      this.actors[i].tail.visible = false;
    }
  }
}
