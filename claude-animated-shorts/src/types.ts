import type { ComponentType } from 'react';

export type ShortProps = { audioFile?: string | null };
export type ProjectEntry = {
  id: string;
  component: ComponentType<ShortProps>;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  audioFile: string | null;
};
