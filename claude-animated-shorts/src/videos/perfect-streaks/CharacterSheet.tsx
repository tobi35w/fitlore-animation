import React, { useEffect, useRef, useState } from 'react';
import { continueRender, delayRender } from 'remotion';
import { Pen, type Expr } from './toon';
import { MARCUS, BUILDER, drawPerson, type PersonPose } from './character';

/** Construction studies only: never part of the film composition. */
export const CharacterSheet: React.FC<{ who?: 'marcus' | 'builder' }> = ({ who = 'marcus' }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const [wait] = useState(() => delayRender('Perfect Streaks character construction'));
  useEffect(() => {
    const g = ref.current!.getContext('2d')!, person = who === 'builder' ? BUILDER : MARCUS;
    g.fillStyle = '#ece6dc'; g.fillRect(0, 0, 1080, 1920);
    g.fillStyle = '#30252f'; g.font = 'bold 39px Arial';
    g.fillText(person.name + ' · character construction', 36, 60);
    g.font = '21px Arial';
    g.fillText('Connected joints · planted soles · matching props · both hands', 36, 98);
    const items: [string, PersonPose][] = [
      ['Front', {}], ['Side', { side: true }],
      ...[0, .25, .5, .75].map(v => ['Walk ' + v, { side: true, walking: true, phase: v, stride: .58 }] as [string, PersonPose]),
      ...(['neutral', 'stern', 'nervous', 'shock', 'relief', 'smile'] as Expr[])
        .map(expr => [expr, { expr }] as [string, PersonPose]),
      ['Calendar', { prop: 'calendar' }], ['Side calendar', { side: true, prop: 'calendar' }],
      ['Rolled calendar', { prop: 'roll' }], ['Side roll', { side: true, leftProp: 'roll' }],
      ['Shoes by laces', { prop: 'shoes' }], ['Side shoes', { side: true, prop: 'shoes' }],
      ['Brick in hand', { prop: 'brick' }], ['Side brick', { side: true, prop: 'brick' }],
      ['Marker', { prop: 'marker' }], ['Both hands', { leftProp: 'calendar', prop: 'marker', calendarAfter: 7 }],
      ['Walking + tilt + reach', { side: true, walking: true, phase: .15, headTilt: -4, hands: { right: [460, 650] } }],
      ['Blink', { blink: 1 }],
    ];
    items.forEach(([label, pose], i) => {
      const x = 28 + (i % 4) * 263, y = 127 + Math.floor(i / 4) * 291;
      g.fillStyle = '#f7f1e7'; g.fillRect(x, y, 246, 278);
      g.strokeStyle = '#d2c8bd'; g.lineWidth = 1; g.strokeRect(x, y, 246, 278);
      g.fillStyle = '#4b3c44'; g.font = label.length > 21 ? '16px Arial' : '18px Arial';
      g.fillText(label, x + 11, y + 25);
      g.save(); g.translate(x + 37, y - 14); g.scale(.285, .285);
      drawPerson(new Pen(g), person, pose); g.restore();
      g.strokeStyle = '#b1a092'; g.beginPath();
      g.moveTo(x + 63, y + 265); g.lineTo(x + 183, y + 265); g.stroke();
    });
    continueRender(wait);
  }, [who, wait]);
  return <canvas ref={ref} width={1080} height={1920} style={{ width: 1080, height: 1920 }} />;
};
