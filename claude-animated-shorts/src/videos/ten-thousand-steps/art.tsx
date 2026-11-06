import React from 'react';

export const C = {
  ink: '#29221e', sky: '#e7b464', cream: '#f3d79b', mustard: '#cda044',
  terra: '#c37654', rust: '#934c36', brick: '#b56142', brown: '#70503b',
  pale: '#e9c18b', red: '#ce4636', skin: '#a86c49', hair: '#282323',
  beard: '#382a24', gray: '#b7b5ab', olive: '#50563b', orange: '#ed762e',
  white: '#fbefd8', navy: '#303a49', watch: '#262627', glass: '#805b40',
};

export const Measure: React.FC<{ d: string; t?: number; solid?: boolean }> = ({ d, t = 0, solid }) =>
  <path d={d} fill="none" stroke={C.red} strokeWidth={3} strokeDasharray={solid ? undefined : '3 15'} strokeDashoffset={-t * 24} />;

export const Shoe: React.FC<{ x?: number; y?: number; scale?: number; flip?: boolean; worn?: boolean }> = ({ x = 0, y = 0, scale = 1, flip, worn }) =>
  <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`}>
    <path d="M-41-31 L-8-35 13-20 Q25-15 53-12 Q68-10 68 2 L66 14 -46 14 Q-49-2-41-31Z" fill={C.orange} />
    <path d="M-47 0 Q5 6 67 0 L66 15 Q14 22-47 13Z" fill={C.white} />
    <path d="M-29-29-13-15 M-14-27 1-13 M0-22 13-11" fill="none" />
    <path d="M-38 10 53 12" strokeWidth={2} fill="none" />
    {worn && <path d="M29-5 39-3 M-34-10-26-8 M45 9 51 8" stroke={C.cream} strokeWidth={3} fill="none" />}
  </g>;

export const Watch: React.FC<{ x?: number; y?: number; scale?: number; progress?: number; t?: number }> = ({ x = 0, y = 0, scale = 1, progress = .25, t = 0 }) =>
  <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <rect x={-27} y={-117} width={54} height={234} rx={15} fill={C.watch} />
    {[-95, -78, 81, 98].map(y => <path key={y} d={`M-12 ${y}h24`} stroke={C.brown} strokeWidth={3} />)}
    <rect x={-49} y={-62} width={98} height={124} rx={24} fill={C.watch} />
    <rect x={-41} y={-53} width={82} height={105} rx={18} fill={C.cream} />
    <rect x={49} y={-20} width={7} height={20} rx={3} fill={C.watch} />
    <circle cy={-5} r={29} fill="none" stroke={C.mustard} strokeWidth={7} />
    <path d={`M0-34A29 29 0 ${progress > .5 ? 1 : 0} 1 ${Math.sin(progress * Math.PI * 2) * 29} ${-5 - Math.cos(progress * Math.PI * 2) * 29}`} fill="none" stroke={C.red} strokeWidth={7} />
    <g transform={`translate(0 ${-4 + Math.sin(t * 2) * 2})`} fill={C.rust} stroke="none">
      <ellipse cx={-8} cy={-6} rx={5} ry={10} transform="rotate(-22 -8 -6)" />
      <ellipse cx={8} cy={7} rx={5} ry={10} transform="rotate(-22 8 7)" />
    </g>
    <path d="M-16 39H16" stroke={C.rust} strokeWidth={4} />
  </g>;

export const Head: React.FC<{ x?: number; y?: number; scale?: number; t?: number; mood?: 'neutral' | 'smile' | 'wince' | 'thoughtful'; look?: number; smileAmount?: number; down?: boolean }> = ({ x = 0, y = 0, scale = 1, t = 0, mood = 'neutral', look = 0, smileAmount, down }) => {
  const blink = t % 4.7 > 4.52;
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <ellipse cx={-66} cy={3} rx={12} ry={20} fill={C.skin} />
    <ellipse cx={66} cy={3} rx={12} ry={20} fill={C.skin} />
    <path d="M-61-45 Q-58-77 0-78 Q59-77 62-44 L64 12 Q62 77 0 79 Q-61 77-65 12Z" fill={C.skin} />
    <path d="M-64-25-67-51 Q-64-87-20-88 Q22-95 55-73 Q68-60 64-24 L51-37 50-52 Q28-48 8-59 Q-17-44-52-48 L-52-28Z" fill={C.hair} />
    {[-53, -39, -24, -8, 8, 25, 40, 53].map((x, i) => <circle key={x} cx={x} cy={-68 - Math.sin(i / 7 * Math.PI) * 15} r={9} fill={C.hair} stroke="none" />)}
    {[-40, -23, -6, 11, 28, 44].map((x, i) => <path key={x} d={`M${x} ${-64 - Math.sin(i) * 5}q-4-6 2-7q6 0 5 5`} stroke="#47372e" strokeWidth={1.5} fill="none" />)}
    <path d="M-59 13 Q-49 23-45 36 Q-28 52 0 47 Q30 53 46 34 L60 11 58 43 Q39 78 0 79 Q-39 78-58 43Z" fill={C.beard} />
    <path d={mood === 'wince' ? 'M-40-23-16-16 M16-16 40-24' : 'M-41-25 Q-29-31-16-25 M17-26 Q31-31 42-24'} fill="none" strokeWidth={5} />
    {blink || mood === 'wince' ? <path d="M-38-7-21-3 M23-3 39-8" fill="none" strokeWidth={4} /> : <g stroke="none" fill={C.ink}><ellipse cx={-29 + look} cy={down ? 4 : -7} rx={4.5} ry={6} /><ellipse cx={29 + look} cy={down ? 4 : -7} rx={4.5} ry={6} /></g>}
    <path d="M1-4-4 15Q1 19 9 15" fill="none" strokeWidth={3} />
    <path d="M-20 29 Q0 18 20 29 L13 35 Q0 28-13 35Z" fill={C.beard} stroke="none" />
    {smileAmount !== undefined ? <path d={`M-16 39Q0 ${44 + smileAmount * 10} 17 39`} fill="none" strokeWidth={3} stroke={C.ink} /> : mood === 'smile' ? <path d="M-20 38 Q0 47 20 38 Q12 58 0 57 Q-13 57-20 38Z" fill={C.white} strokeWidth={3} /> :
      <path d={mood === 'wince' ? 'M-16 44 Q0 32 17 41' : mood === 'thoughtful' ? 'M-14 42Q0 39 15 43' : 'M-16 39Q0 49 17 39'} fill="none" strokeWidth={3} stroke={C.ink} />}
  </g>;
};

export type MarcusPose = 'stand' | 'walk' | 'sit' | 'lace' | 'knee' | 'open' | 'watch';
export const Marcus: React.FC<{ x: number; y: number; scale?: number; t?: number; pose?: MarcusPose; mood?: 'neutral' | 'smile' | 'wince' | 'thoughtful'; bag?: boolean; phase?: number }> = ({ x, y, scale = 1, t = 0, pose = 'stand', mood = 'neutral', bag, phase = 0 }) => {
  const walk = pose === 'walk';
  const stride = walk ? Math.sin(t * 5.2 + phase) : 0;
  const breathe = Math.sin(t * 1.8) * 1.5;
  const lean = pose === 'lace' ? 16 : pose === 'knee' ? 10 : pose === 'sit' ? 5 : 0;
  return <g transform={`translate(${x} ${y + (walk ? Math.cos(t * 10.4) * 2 : 0)}) scale(${scale})`}>
    {pose === 'lace' ? <g fill={C.olive}>
      <path d="M-77-176H-12L-17-30-73-30Z" /><Shoe x={-44} y={-15} flip />
      <path d="M4-174Q68-211 99-159L99-118 63-29 13-39 45-120-11-128Z" /><Shoe x={53} y={-25} />
    </g> : pose === 'sit' ? <g fill={C.olive}>
      <path d="M-76-180 Q-115-153-114-112 L-102-23-49-23-53-111-18-140Z" />
      <path d="M14-170 90-162 Q119-150 115-109 L94-23 42-23 56-110-6-127Z" />
      <Shoe x={-76} y={-14} flip /><Shoe x={71} y={-14} />
    </g> : [-1, 1].map(side => <g key={side} transform={`translate(${side * 47} -174) rotate(${side * stride * 3}) scale(1 ${1 - Math.max(0, side * stride) * .08})`}>
      <path d="M-36 0H35L31 138Q1 146-29 138Z" fill={C.olive} />
      <path d="M-26 120Q0 126 28 120" fill="none" strokeWidth={2} />
      <Shoe x={side * 3} y={153} flip={side < 0} />
    </g>)}
    <g transform={`rotate(${lean} 0 -166) translate(0 ${breathe})`}>
      <rect x={-25} y={-332} width={50} height={44} rx={12} fill={C.skin} />
      {bag && <path d="M54-290 Q149-298 149-199 L120-144 82-153 71-222Z" fill={C.navy} />}
      {[-1, 1].filter(side => pose !== 'sit' && pose !== 'watch' && !(pose === 'lace' && side === -1) && !(pose === 'knee' && side === 1)).map(side => <g key={side} transform={`rotate(${pose === 'open' ? side * -57 : side * stride * -11} ${side * 78} -284)`}>
        <path d={side < 0 ? 'M-76-292Q-124-282-137-233L-123-169Q-115-153-101-163L-106-230-63-260Z' : 'M76-292Q124-282 137-233L123-169Q115-153 101-163L106-230 63-260Z'} fill={C.skin} />
        {side > 0 && <g transform="translate(121 -189) rotate(12)"><rect x={-14} y={-8} width={28} height={16} rx={4} fill={C.watch} /><rect x={-8} y={-7} width={16} height={14} rx={3} fill={C.watch} /></g>}
      </g>)}
      <path d="M-27-309Q-57-320-89-300L-111-249-80-235-87-170Q0-139 87-170L80-235 111-249 89-300Q54-321 27-309Q0-285-27-309Z" fill={C.gray} />
      <path d="M-29-309Q0-276 29-309 M-78-180Q0-156 78-180" fill="none" strokeWidth={2.5} />
      {bag && <><path d="M69-310-58-164" stroke={C.navy} strokeWidth={11} /><path d="M70-311-57-165" stroke={C.ink} strokeWidth={2} /></>}
      {(pose === 'watch' || pose === 'sit') && <><path d="M-92-258Q-116-240-110-209L-45-200Q-23-190-19-204L-28-222-75-230-64-251Z" fill={C.skin} /><path d="M95-257Q132-234 114-199Q91-181-50-199L-50-226Q33-233 84-228L76-253Z" fill={C.skin} /><g transform="translate(-28 -213)"><rect x={-8} y={-18} width={16} height={35} rx={3} fill={C.watch} /><rect x={-15} y={-12} width={30} height={25} rx={6} fill={C.watch} /><circle r={7} fill={C.mustard} /></g></>}
      {pose === 'knee' && <><path d="M95-245Q130-214 108-133L70-81Q53-72 45-87L79-142 74-222Z" fill={C.skin} /><g transform="translate(86 -134) rotate(26)"><rect x={-15} y={-10} width={30} height={20} rx={4} fill={C.watch} /></g></>}
      {pose === 'lace' && <path d="M-82-243Q-30-223 10-155L84-98Q99-77 80-70L-15-125-103-209Z" fill={C.skin} />}
      <Head y={-383} t={t} mood={mood} look={pose === 'watch' || pose === 'sit' ? -4 : 0} down={pose === 'watch' || pose === 'sit'} />
    </g>
  </g>;
};

export const Child: React.FC<{ x: number; y: number; t?: number; scale?: number }> = ({ x, y, t = 0, scale = 1 }) => {
  const stride = Math.sin(t * 6);
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    {[-1, 1].map(side => <g key={side} transform={`translate(${side * 23} -102) rotate(${side * stride * 13})`}><path d="M-19 0H19L16 81H-17Z" fill={C.navy} /><Shoe y={92} scale={.57} flip={side < 0} /></g>)}
    <path d="M-31-220Q-54-218-70-180L-92-224-111-219-84-152Q-71-136-47-164L-46-100Q0-80 46-100L44-164 63-131 81-140 62-190Q52-217 29-220Z" fill={C.mustard} />
    <path d="M-92-224Q-90-243-105-242Q-122-237-111-219Z M63-131Q67-115 81-122L81-140" fill={C.skin} />
    <circle cy={-262} r={55} fill={C.skin} />
    <path d="M-55-260Q-75-313-16-322Q39-331 61-284L55-242 40-267Q3-269-14-295Q-27-266-55-260Z" fill={C.hair} />
    <circle cx={63} cy={-286} r={23} fill={C.hair} />
    <path d="M52-290 60-273" stroke={C.orange} strokeWidth={9} />
    <g fill={C.ink} stroke="none"><circle cx={-20} cy={-259} r={4} /><circle cx={20} cy={-259} r={4} /></g>
    <path d="M-12-235Q0-224 14-237" fill="none" strokeWidth={3} />
    <path d="M-25-219Q0-200 26-219" fill="none" />
    <path d="M41-210Q83-227 76-158L50-157" fill={C.orange} />
  </g>;
};

export const House: React.FC<{ x: number; y: number; w?: number; h?: number; color?: string; open?: boolean }> = ({ x, y, w = 230, h = 290, color = C.terra, open }) => <g transform={`translate(${x} ${y})`}>
  <path d={`M0 60H${w}V${h}H0Z`} fill={color} />
  <path d={`M-16 62 ${w / 2} -15 ${w + 16} 62Z`} fill={C.rust} />
  <path d={`M${w * .7} 21V-25H${w * .81}V38`} fill={C.brick} />
  <rect x={w * .12} y={100} width={w * .26} height={64} rx={3} fill={C.cream} />
  <path d={`M${w * .25} 101V163 M${w * .13} 131H${w * .37}`} fill="none" />
  <rect x={w * .61} y={100} width={w * .26} height={64} rx={3} fill={C.cream} />
  <path d={`M${w * .74} 101V163 M${w * .62} 131H${w * .86}`} fill="none" />
  <rect x={w * .37} y={h - 105} width={w * .26} height={105} rx={3} fill={open ? C.brown : C.orange} />
  {open && <path d={`M${w * .37} ${h - 105} ${w * .56} ${h - 120}V${h - 13}L${w * .37} ${h}Z`} fill={C.orange} />}
  <circle cx={w * .57} cy={h - 47} r={3.5} fill={C.ink} stroke="none" />
  <path d={`M${w * .3} ${h}H${w * .7}V${h + 15}H${w * .3}Z`} fill={C.pale} />
</g>;

export const Tree: React.FC<{ x: number; y: number; scale?: number; color?: string }> = ({ x, y, scale = 1, color = C.rust }) => <g transform={`translate(${x} ${y}) scale(${scale})`}>
  <path d="M-12 0-9-164H12L14 0Z" fill={C.brown} />
  <path d="M-10-83-42-111 M12-117 42-145" fill="none" strokeWidth={8} />
  <path d="M-61-110Q-110-131-80-182Q-93-229-39-241Q-10-279 32-247Q83-254 93-209Q124-166 85-137Q74-94 31-108Q-19-78-61-110Z" fill={color} />
  <path d="M0-214V-113 M0-170-34-190 M0-144 37-176" stroke={C.brown} fill="none" strokeWidth={3} />
</g>;

export const Bench: React.FC<{ x?: number; y?: number; scale?: number }> = ({ x = 0, y = 0, scale = 1 }) => <g transform={`translate(${x} ${y}) scale(${scale})`}>
  <path d="M-207 15-223 132 M205 15 223 132 M-143 19-159 132 M145 19 159 132" stroke={C.ink} strokeWidth={12} />
  <rect x={-247} y={-144} width={494} height={53} rx={8} fill={C.brown} />
  <rect x={-247} y={-81} width={494} height={53} rx={8} fill={C.brown} />
  <path d="M-249-12H249L265 20H-265Z" fill={C.terra} />
  <path d="M-235-135H236 M-235-72H236 M-228 1H228" fill="none" stroke={C.pale} strokeWidth={2} />
</g>;

export const Bag: React.FC<{ x: number; y: number; scale?: number }> = ({ x, y, scale = 1 }) => <g transform={`translate(${x} ${y}) scale(${scale})`}>
  <path d="M-50-67Q-4-82 50-67L67 49Q64 70 0 75Q-65 72-67 47Z" fill={C.navy} />
  <path d="M-49-67Q-29-129 13-111Q67-131 53-61 M-47-66Q0-43 51-65 M-43-55-71 55 M43-55 67 56" fill="none" />
</g>;

export const Cloud: React.FC<{ x: number; y: number; scale?: number }> = ({ x, y, scale = 1 }) => <path transform={`translate(${x} ${y}) scale(${scale})`} d="M-80 18Q-105-15-66-27Q-62-76-19-66Q10-86 34-50Q68-57 80-22Q123-20 109 18Z" fill={C.cream} stroke="none" />;

export const Street: React.FC<{ t: number; empty?: boolean; dusk?: boolean }> = ({ t, empty, dusk }) => <>
  <rect width={1024} height={1536} fill={dusk ? C.mustard : C.sky} stroke="none" />
  <circle cx={814} cy={393} r={81} fill={C.cream} stroke="none" />
  <Cloud x={216} y={361} /><Cloud x={589} y={269} scale={.68} />
  <House x={-65} y={620} color={C.terra} /><House x={232} y={648} w={245} h={262} color={C.mustard} open={empty} />
  <House x={553} y={618} color={C.brick} /><House x={851} y={650} w={235} h={260} color={C.terra} />
  <rect y={925} width={1024} height={170} fill={C.pale} /><path d="M0 980H1024 M40 925V1095 M286 925V1095 M534 925V1095 M782 925V1095" fill="none" strokeWidth={2} />
  <rect y={1095} width={1024} height={441} fill={C.brown} />
  <path d="M0 1290H1024" stroke={C.mustard} strokeDasharray="76 92" strokeWidth={7} />
  <Tree x={158} y={956} scale={.76} color={C.rust} /><Tree x={849} y={956} scale={.7} color={C.mustard} />
  <Measure d={empty ? 'M-50 1018H1110' : 'M-40 1450Q70 1390 201 1390T431 1380Q511 1381 555 1320'} t={t} />
</>;
