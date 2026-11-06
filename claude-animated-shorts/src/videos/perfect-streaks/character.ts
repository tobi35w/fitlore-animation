import {
  Pen, INK, headBlob, blobPts, thickAngle, mul, mix, faceFront, faceSide,
  type Blob, type Expr,
} from './toon';
import { drawCalendar } from './props';

export type P2 = [number, number];
export type Person = {
  name: string; seed: number; build: 'stout' | 'kid' | 'adult';
  skin: string; shirt: string; pants: string; shoes: string; hair: string;
  beard?: boolean; watch?: boolean;
};
export const MARCUS: Person = {
  name: 'Marcus', seed: 17, build: 'stout', skin: '#c99069', shirt: '#90939a',
  pants: '#727955', shoes: '#ec8a3b', hair: '#30282b', beard: true, watch: false,
};
export const BUILDER: Person = {
  name: 'Neighbour', seed: 61, build: 'adult', skin: '#d1a386', shirt: '#b87963',
  pants: '#536678', shoes: '#68504a', hair: '#8d8984', beard: true, watch: false,
};
export type HeldProp = 'calendar' | 'roll' | 'shoes' | 'brick' | 'marker';
export type PersonPose = {
  side?: boolean; phase?: number; walking?: boolean; stride?: number;
  expr?: Expr; blink?: number; breath?: number; prop?: HeldProp; leftProp?: HeldProp;
  calendarAfter?: number; calendarBefore?: number;
  hands?: { left?: P2; right?: P2 }; look?: number; headTilt?: number; light?: number;
};

const TAU = Math.PI * 2;
const SU = 0.00216;
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a: P2, b: P2, t: number): P2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const arcLine = (a: P2, e: P2, b: P2): P2[] => Array.from({ length: 13 }, (_, i) => {
  const t = i / 12, u = 1 - t;
  return [u * u * a[0] + 2 * u * t * e[0] + t * t * b[0], u * u * a[1] + 2 * u * t * e[1] + t * t * b[1]];
});
const knee = (a: P2, b: P2, len: number): P2 => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const d = clamp(Math.hypot(dx, dy), 1, len * 2 - .01);
  const q = Math.atan2(dy, dx) - Math.acos(d / (len * 2));
  return [a[0] + len * Math.cos(q), a[1] + len * Math.sin(q)];
};

/** A held prop is drawn from the final hand endpoint, including its body rotation. */
function held(p: Pen, kind: HeldProp, hand: P2, u: number, side: -1 | 1, o: PersonPose) {
  const [x, y] = hand;
  const pts = (q: P2[]): P2[] => q.map(([a, b]) => [x + a * u, y + b * u]);
  if (kind === 'calendar') {
    drawCalendar(p, x - (side === 1 ? 4 : 48) * u, y - 52 * u, 52 * u, 64 * u, {
      before: o.calendarBefore ?? 22, after: o.calendarAfter ?? 0,
    });
  } else if (kind === 'roll') {
    p.poly(pts([[-25, -10], [24, -10], [24, 9], [-25, 9]]), '#e9e0c9', 2 * u);
    p.ell(x - 25 * u, y - .5 * u, 4.5 * u, 9.5 * u, '#c7bda8', 1.8 * u);
    p.ell(x + 24 * u, y - .5 * u, 5 * u, 9.5 * u, '#f0e8d5', 1.8 * u);
    p.arc(x + 24 * u, y - .5 * u, 2.4 * u, 5.5 * u, -100, 235, 1.1 * u, '#8b7a66');
    p.stroke(pts([[-19, -6], [17, -6]]), 2.5 * u, '#bb8570');
  } else if (kind === 'brick') {
    p.poly(pts([[-22, -18], [-12, -27], [27, -27], [17, -18]]), '#d39a75', 1.8 * u);
    p.poly(pts([[17, -18], [27, -27], [27, -5], [17, 4]]), '#925447', 1.8 * u);
    p.poly(pts([[-22, -18], [17, -18], [17, 4], [-22, 4]]), '#be795c', 1.8 * u);
    p.stroke(pts([[-17, -11], [-6, -12]]), 1.1 * u, '#aa684f');
    p.stroke(pts([[5, -5], [12, -6]]), 1.1 * u, '#ce9270');
  } else if (kind === 'marker') {
    p.poly(pts([[-3.5, -22], [3.5, -22], [3.5, 13], [-3.5, 13]]), '#6c9c84', 1.5 * u);
    p.poly(pts([[-3.5, -22], [0, -27], [3.5, -22]]), '#304a40', 1.2 * u);
    p.stroke(pts([[-3.5, 10], [3.5, 10]]), 2.8 * u, '#ddd6c4');
  } else {
    // Lace loops run continuously from the gripping dot to both orange shoes.
    for (const [j, cx, drop] of [[0, -17, 0], [1, 13, 5]]) {
      p.stroke(pts([[0, 0], [cx * .55, 13 + drop], [cx, 31 + drop]]), 1.7 * u, '#e5d2ae');
      const shoe = (q: P2[]): P2[] => pts(q.map(([a, b]) => [a + cx, b + drop]));
      p.poly(shoe([[-10, 28], [3, 30], [9, 41], [21, 46], [23, 54], [-10, 54], [-13, 45]]), j ? '#ec8a3b' : '#d87937', 2.1 * u);
      p.stroke(shoe([[-10, 51], [21, 51]]), 4.4 * u, '#f2dabb');
      p.stroke(shoe([[-5, 32], [4, 36], [-4, 38], [7, 42]]), 1.5 * u, '#f2dabb');
      p.arc(x + cx * u, y + (30 + drop) * u, 4 * u, 3 * u, 180, 490, 1.4 * u, '#e5d2ae');
    }
  }
  p.dot(x, y, 5.5 * u);
}

/** Planted stance feet and the existing bean-head proportions, in a 600×1000 design. */
export function drawPerson(p: Pen, who: Person, o: PersonPose = {}) {
  const side = !!o.side, phase = o.phase ?? 0, walk = !!o.walking, light = o.light ?? -2.1;
  const cfg = who.build === 'kid' ? { a: 112, t: .85, l: 1, tw: .72 }
    : who.build === 'stout' ? { a: 118, t: 1.15, l: 1.32, tw: .92 }
      : { a: 118, t: 1.1, l: 1.4, tw: .8 };
  const H = headBlob(who.seed, cfg.a, side ? 1 : 0), W = 2 * H.a, HH = 2 * H.b, u = W / 100;
  if (side) { H.asym = .12; H.rot = .04; }
  const ank = 975 - 4 * u, L = (cfg.l + .12) * HH - 4 * u;
  let hipY = ank - L * .995 + (o.breath ?? 0) * 2.2;
  const feet: { x: number; y: number; near: boolean }[] = [];
  if (side && walk) {
    const S = (o.stride ?? .64) * 370;
    const at = (offset: number) => {
      const q = ((phase + offset) % 1 + 1) % 1;
      if (q < .5) return { x: S / 2 - S * q * 2, h: 0, s: q * 2, stance: true };
      const s = (q - .5) * 2;
      return { x: -S / 2 + S * s - S / Math.PI * Math.sin(TAU * s), h: 38 * Math.sin(Math.PI * s), s, stance: false };
    };
    const n = at(0), f = at(.5), st = n.stance ? n : f, Le = L * (1 - .035 * Math.sin(Math.PI * st.s));
    hipY = ank - Math.sqrt(Math.max(1, Le * Le - st.x * st.x));
    feet.push({ x: 300 + f.x, y: ank - f.h, near: false }, { x: 300 + n.x, y: ank - n.h, near: true });
  } else {
    for (const s of [-1, 1]) feet.push({
      x: 300 + s * (side ? 4 : 22) * u,
      y: ank - (walk ? Math.max(0, Math.sin(TAU * (phase + (s < 0 ? 0 : .5)))) * 35 : 0), near: s > 0,
    });
    if (walk) hipY += .015 * (1 + cfg.t + cfg.l) * HH * Math.cos(2 * TAU * phase);
  }
  const torsoBottom = hipY + .12 * HH, chin = torsoBottom - cfg.t * HH, hc = chin - H.b;
  p.rot = null;
  for (const f of feet) {
    const h: P2 = [300 + (side ? 0 : (f.near ? 15 : -15) * u), hipY], a: P2 = [f.x, f.y];
    const k = side ? knee(h, a, L / 2) : lerp(h, a, .5), direction = side || f.near ? 1 : -1;
    p.stroke([h, k, a], 5.8 * u, mix(who.pants, INK, f.near ? .43 : .65));
    const toe: P2[] = [[a[0] - 3 * u * direction, a[1]], [a[0] + 13 * u * direction, a[1] + .5 * u]];
    p.stroke(toe, 9 * u, INK); p.stroke(toe, 7.4 * u, who.shoes);
    p.stroke([[toe[0][0], a[1] + 2.7 * u], [toe[1][0], a[1] + 3.2 * u]], 2.3 * u, '#f2dabb');
  }
  const lean = walk ? (side ? 4 + 3 * Math.cos(2 * TAU * phase) : Math.sin(TAU * phase)) : 0;
  const bodyAngle = lean * Math.PI / 180;
  p.rot = lean ? [bodyAngle, 300, hipY] : null;
  const T: Blob = {
    a: (side ? (who.build === 'stout' ? .36 : .31) : cfg.tw / 2 / 1.06) * W,
    b: (torsoBottom - chin + .25 * HH) / 2, nTop: 2.2, nBot: 2.6,
    egg: who.build === 'stout' ? .17 : .12, asym: side ? .06 : 0, rot: 0, noise: .006, seed: who.seed + 7,
  };
  const tcx = 300 + (side ? 2 * u : 0), tp = blobPts(tcx, torsoBottom - T.b, T), thick = thickAngle(light);
  const shoulder = (s: number): P2 => [side ? tcx : tcx + s * .85 * T.a, chin + .12 * HH];
  const arms = ([-1, 1] as const).map(s => {
    const a = shoulder(s), sw = walk ? Math.sin(TAU * phase) * (side ? 44 : 9) * u * s : 0;
    let h: P2 = side ? [a[0] + sw, a[1] + .91 * HH - Math.abs(sw) * .12]
      : [tcx + s * (T.a + 12 * u), chin + 1.04 * HH - Math.abs(sw) * .3];
    let e: P2 = side ? [(a[0] + h[0]) / 2 - 8 * u, (a[1] + h[1]) / 2]
      : [tcx + s * (T.a + 10 * u), a[1] + .46 * HH];
    const prop = s === 1 ? o.prop : o.leftProp;
    if (prop) {
      h = [tcx + s * (side ? (s === 1 ? 46 : 34) : 39) * u, chin + .85 * HH];
      e = [tcx + s * (side ? 18 : 55) * u, chin + .55 * HH];
    }
    const goal = s === 1 ? o.hands?.right : o.hands?.left;
    if (goal) {
      // Targets are unrotated card coordinates. Undo body lean before drawing the arm and its prop.
      const dx = goal[0] - 300, dy = goal[1] - hipY, r = -bodyAngle;
      h = [300 + dx * Math.cos(r) - dy * Math.sin(r), hipY + dx * Math.sin(r) + dy * Math.cos(r)];
      e = [(a[0] + h[0]) / 2 + s * 8 * u, (a[1] + h[1]) / 2];
    }
    return { s, a, e, h, prop };
  });
  const drawArm = (arm: typeof arms[number]) => {
    p.stroke(arcLine(arm.a, arm.e, arm.h), 5.2 * u, mix(who.shirt, INK, arm.s < 0 ? .6 : .42));
    p.dot(...arm.h, 5.5 * u);
  };
  drawArm(arms[0]);
  p.gradFill(tp, who.shirt, mul(who.shirt, [.64, .66, .74]), light);
  p.inkRing(tp, 5 * u, thick);
  p.arc(tcx, chin - .06 * HH, .18 * W, .10 * HH, 0, 180, 2 * u, mix(who.shirt, INK, .45));
  // A holding arm comes forward with its prop, so the torso cannot hide the wrist connection.
  if (arms[0].prop) { drawArm(arms[0]); held(p, arms[0].prop, arms[0].h, u, -1, o); }
  drawArm(arms[1]);
  if (arms[1].prop) held(p, arms[1].prop, arms[1].h, u, 1, o);

  const hcX = 300 + (side ? 4 * u : 0), hp = blobPts(hcX, hc, H);
  if (o.headTilt) {
    // Keep the chin at its body-rotated position while the head adds a local tilt.
    const [pivotX, pivotY] = p.P(300, chin);
    p.rot = [bodyAngle + o.headTilt * Math.PI / 180, 300, chin, pivotX - 300, pivotY - chin];
  }
  p.shadedFill(hp, who.skin, mul(who.skin, [.96, .86, .84]), light, H.a);
  p.inkRing(hp, 5 * u, thick);
  p.clip(hp, () => {
    if (who.beard) {
      p.ell(hcX, hc + .75 * H.b, H.a * 1.05, H.b * .32, who.hair, 0);
      p.ell(hcX + (side ? 20 * u : 0), hc + .43 * H.b, H.a * .56, H.b * .27, who.skin, 0);
    }
    p.poly([[hcX - H.a * 1.2, hc - H.b * 1.2], [hcX + H.a * 1.2, hc - H.b * 1.2],
      [hcX + H.a * 1.1, hc - H.b * .56], [hcX - H.a * 1.1, hc - H.b * .4]], who.hair, 0);
    for (let j = 0; j < 12; j++) {
      const x = hcX - H.a + j * 2 * H.a / 11;
      p.ell(x, hc - H.b * (.55 + .07 * Math.sin(j * 1.8)), .13 * H.a, .15 * H.a, who.hair, 0);
    }
  });
  const expr = o.expr ?? 'neutral';
  if (side) faceSide(p, hcX, hc, W, expr, o.blink ?? 0, false, who.skin, undefined, who.build === 'stout');
  else faceFront(p, hcX, hc, W, expr, 0, o.look ?? 0, o.blink ?? 0, false, who.skin, undefined, who.build === 'stout');
  p.rot = null;
}

export const walkStride = (speed: number, cycle: number, scale = 1) => speed * cycle / 2 / SU / 370 / scale;
export function blinkAt(frame: number, seed: number) {
  let at = seed % 17;
  for (let n = 0; at <= frame; n++) {
    const k = frame - at;
    if (k < 4) return [.5, 1, 1, .5][k];
    const raw = Math.sin((n + seed) * 17.43) * 43758.5453;
    at += 18 + Math.floor(48 * (raw - Math.floor(raw)));
  }
  return 0;
}
