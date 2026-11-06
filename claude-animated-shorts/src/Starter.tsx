import React from 'react';
import { ThreeCanvas } from '@remotion/three';
import { Audio } from '@remotion/media';
import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ShortProps } from './types';

// A neutral scene for checking a new project. Replace it with the chosen story's visuals.
export const Starter: React.FC<ShortProps> = ({ audioFile }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const time = frame / fps;
  return (
    <AbsoluteFill style={{ background: '#83bee2' }}>
      <ThreeCanvas width={width} height={height} camera={{ position: [0, 2.3, 8], fov: 42 }}>
        <color attach="background" args={['#83bee2']} />
        <ambientLight intensity={1.2} />
        <directionalLight position={[4, 7, 5]} intensity={2.5} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.6, 0]}>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color="#7fa877" roughness={1} />
        </mesh>
        <group position={[Math.sin(time * 0.6) * 0.3, Math.sin(time * 3) * 0.07, 0]} rotation={[0, Math.sin(time * 0.5) * 0.15, 0]}>
          <mesh position={[0, 0.75, 0]}>
            <sphereGeometry args={[0.7, 32, 24]} />
            <meshToonMaterial color="#f4d0a2" />
          </mesh>
          <mesh position={[0, -0.38, 0]}>
            <capsuleGeometry args={[0.45, 0.9, 8, 20]} />
            <meshToonMaterial color="#cd6243" />
          </mesh>
          {[-0.22, 0.22].map((x) => <mesh key={x} position={[x, 0.85, 0.645]}>
            <sphereGeometry args={[0.055, 12, 8]} />
            <meshBasicMaterial color="#251a28" />
          </mesh>)}
        </group>
        {[-4, 4].map((x) => <group key={x} position={[x, -0.5, -4]}>
          <mesh><cylinderGeometry args={[0.18, 0.22, 2, 8]} /><meshToonMaterial color="#8d6b4b" /></mesh>
          <mesh position={[0, 1.6, 0]}><coneGeometry args={[1.3, 3.2, 8]} /><meshToonMaterial color="#3e886e" /></mesh>
        </group>)}
      </ThreeCanvas>
      {audioFile ? <Audio src={staticFile(audioFile)} /> : null}
    </AbsoluteFill>
  );
};
