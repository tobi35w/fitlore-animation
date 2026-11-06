// Where Did 10,000 Steps Come From: original story, using the supplied world/post engine.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, cancelRender, continueRender, delayRender, getInputProps, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { World, loadKit } from "./world";
import { InkPass, noInkFallback } from "./ink";
import { LensBlur } from "./lensblur";
import { GradeEffect, GRADES, GRADE_STRENGTH, gradeFor } from "./grade";
import { Kit } from "./build";
import { TOTAL, SHOTS, layersAt } from "./story";

export const ORIGIN_FRAMES = TOTAL;

type PostToggles = { ink: boolean; lens: boolean; pre: boolean; bloom: boolean; grade: boolean };
const toggles = (): PostToggles => ({ ink: true, lens: true, pre: true, bloom: true, grade: true, ...((getInputProps() as { post?: Partial<PostToggles> }).post ?? {}) });

const makeBloom = () => {
  const b = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.5, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6 });
  const mip = b.mipmapBlurPass;
  const setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};

const fwd = new THREE.Vector3(), fpt = new THREE.Vector3();

const ComposerReady: React.FC<{ onReady: () => void }> = ({ onReady }) => {
  const { advance } = useThree();
  const frame = useCurrentFrame();
  useEffect(() => { advance(frame / 30); onReady(); }, [advance, onReady]);
  return null;
};

const useKit = () => {
  const [kit, setKit] = useState<Kit | null>(null);
  const [handle] = useState(() => delayRender("ten thousand origin kit"));
  useEffect(() => { loadKit().then(setKit).catch(cancelRender); }, []);
  useEffect(() => { if (kit) continueRender(handle); }, [kit, handle]);
  return kit;
};

const Inner: React.FC<{ id: number; kit: Kit; onReady: () => void }> = ({ id, kit, onReady }) => {
  const f = useCurrentFrame();
  const { camera, scene } = useThree();
  const world = useMemo(() => new World(kit), [kit]);
  const target = useMemo(() => new THREE.Vector3(), []);
  const on = useMemo(toggles, []);
  const fx = useMemo(() => ({
    ink: new InkPass(scene, camera as THREE.PerspectiveCamera),
    lens: new LensBlur({ maxCoC: 24, nearScale: 1.2 }),
    bloom: makeBloom(),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect(GRADES.day, GRADE_STRENGTH.day),
  }), [camera, scene]);
  useEffect(() => () => fx.ink.dispose(), [fx]);
  const post = useMemo(() => (
    <EffectComposer multisampling={4}>
      {on.ink ? <primitive object={fx.ink} dispose={null} /> : null}
      {on.lens && on.pre ? <primitive object={fx.lens.pre} dispose={null} /> : null}
      {on.lens ? <primitive object={fx.lens.main} dispose={null} /> : null}
      {on.bloom ? <primitive object={fx.bloom} dispose={null} /> : null}
      <primitive object={fx.tone} dispose={null} />
      {on.grade ? <primitive object={fx.grade} dispose={null} /> : null}
      <ComposerReady onReady={onReady} />
    </EffectComposer>
  ), [fx, on, onReady]);
  const cam = camera as THREE.PerspectiveCamera;
  target.copy(world.update(id, f, cam, scene));
  noInkFallback(world.root);
  cam.getWorldDirection(fwd);
  fpt.copy(target);
  fx.lens.focus = Math.max(0.3, fpt.sub(cam.position).dot(fwd));
  fx.lens.cInf = SHOTS[id - 1].dof;
  const light = SHOTS[id - 1].light;
  gradeFor(fx.grade, light === 'golden' ? 'golden' : 'day');
  return (
    <>
      <primitive object={world.root} dispose={null} />
      {post}
    </>
  );
};

const dprOverride = () => (getInputProps() as { post?: { dpr?: number } }).post?.dpr;
const ShotView: React.FC<{ id: number; kit: Kit; alpha: number }> = ({ id, kit, alpha }) => {
  const [readyHandle] = useState(() => delayRender('origin scene and post effects'));
  const onReady = useCallback(() => continueRender(readyHandle), [readyHandle]);
  useEffect(() => () => continueRender(readyHandle), [readyHandle]);
  return (
    <AbsoluteFill style={{ opacity: alpha }}>
      <ThreeCanvas width={1080} height={1920} {...(dprOverride() ? { dpr: dprOverride() } : {})} shadows gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
        camera={{ fov: 40, near: 0.2, far: 1500 }}>
        <Inner id={id} kit={kit} onReady={onReady} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

export const TenThousandOriginShort: React.FC = () => {
  const f = useCurrentFrame();
  const kit = useKit();
  if (!kit) return null;
  return (
    <AbsoluteFill style={{ background: "#0e1626" }}>
      {layersAt(f).map((l, i) => <ShotView key={i ? "over" : "base"} id={l.id} kit={kit} alpha={l.alpha} />)}
    </AbsoluteFill>
  );
};
