import React from 'react';
import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Audio } from '@remotion/media';
import type { ShortProps } from '../../types';
import scenes from '../../../projects/ten-thousand-steps/scenes.json';
import { Bag, Bench, C, Child, Cloud, Head, House, Marcus, Measure, Shoe, Street, Tree, Watch } from './art';

const Park: React.FC<{ t: number }> = ({ t }) => <>
  <rect width={1024} height={1536} fill={C.sky} stroke="none" />
  <Cloud x={255} y={290} /><Cloud x={764} y={394} scale={.7} />
  <path d="M0 721Q208 621 390 694T1024 654V1536H0Z" fill={C.mustard} />
  <path d="M317 683Q758 778 527 1013T404 1580H713Q522 1268 739 1073T545 683Z" fill={C.pale} />
  <Tree x={118} y={1005} scale={1.35} /><Tree x={863} y={852} scale={1.05} /><Tree x={903} y={1376} scale={1.6} color={C.terra} />
  <Measure d="M444 1540Q354 1240 588 1040T445 698" t={t} />
</>;

const Car: React.FC<{ x: number; y: number; color?: string }> = ({ x, y, color = C.brown }) => <g transform={`translate(${x} ${y})`}>
  <path d="M-126-26-87-91Q-71-110-26-110H44Q73-104 106-48L142-32V23H-146V-12Z" fill={color} />
  <path d="M-66-90H-12V-44H-93Z M3-90H40Q59-86 80-44H3Z" fill={C.cream} />
  <circle cx={-91} cy={25} r={30} fill={C.ink} /><circle cx={91} cy={25} r={30} fill={C.ink} />
  <circle cx={-91} cy={25} r={13} fill={C.pale} /><circle cx={91} cy={25} r={13} fill={C.pale} />
  <path d="M-133-16H-112 M112-16H131" stroke={C.cream} strokeWidth={8} />
</g>;

const Walker: React.FC<{ x: number; y: number; t: number; scale?: number; elder?: boolean; woman?: boolean }> = ({ x, y, t, scale = 1, elder, woman }) => {
  const d = Math.sin(t * 4.6) * 13;
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <path d={`M-16-99Q${-30 + d}-49 ${-22 + d} 0 M20-99Q${33 - d}-49 ${21 - d} 0`} stroke={C.ink} strokeWidth={22} fill="none" />
    <path d={`M${-37 + d} 3h33 M${8 - d} 3h33`} stroke={C.brown} strokeWidth={15} />
    <path d={woman ? 'M-28-194H30L50-85Q0-66-50-85Z' : 'M-36-194H36L43-98Q0-82-43-98Z'} fill={woman ? C.terra : C.cream} />
    <path d={`M-32-179-58 ${-123 + d} M32-179 61 ${-130 - d}`} stroke={C.skin} strokeWidth={18} fill="none" />
    <circle cy={-235} r={40} fill={elder ? C.pale : C.skin} />
    <path d={woman ? 'M-41-226Q-70-275 0-283Q61-273 43-218L22-255Q-13-238-41-226Z' : 'M-39-240Q-52-281 0-282Q50-279 40-235L21-251Q-6-244-39-240Z'} fill={elder ? C.white : C.hair} />
    <path d="M-15-232h1 M16-232h1" strokeWidth={5} /><path d="M-9-212Q0-205 10-213" fill="none" strokeWidth={2} />
    {elder && <path d="M57-133Q81-146 80-118V8" fill="none" stroke={C.brown} strokeWidth={7} />}
  </g>;
};

const Phone: React.FC<{ t: number }> = ({ t }) => <g transform="translate(520 950) rotate(-8)">
  <rect x={-177} y={-315} width={354} height={630} rx={43} fill={C.watch} />
  <rect x={-158} y={-289} width={316} height={575} rx={28} fill={C.cream} />
  <path d="M-33-277H33" strokeWidth={9} stroke={C.watch} />
  <circle cy={-66} r={102} fill={C.pale} />
  <g fill={C.rust} stroke="none" transform={`translate(0 ${-60 + Math.sin(t * 2) * 5})`}>
    <ellipse cx={-25} cy={-23} rx={16} ry={35} transform="rotate(-22 -25 -23)" />
    <ellipse cx={25} cy={23} rx={16} ry={35} transform="rotate(-22 25 23)" />
  </g>
  <rect x={-108} y={109} width={216} height={24} rx={12} fill={C.mustard} />
  <rect x={-108} y={109} width={23 + Math.sin(t) * 3} height={24} rx={12} fill={C.red} stroke="none" />
  <path d="M100 91V151" stroke={C.red} strokeWidth={3} />
  <path d="M-79 209H79" stroke={C.rust} strokeWidth={7} />
</g>;

const Scene: React.FC<{ id: number; t: number; p: number }> = ({ id, t, p }) => {
  if (id === 1) return <><Street t={t} /><Marcus x={537} y={1281} scale={1.55} t={t} /><Measure d="M375 1325H692 M375 1308V1342 M692 1308V1342" t={t} solid /></>;
  if (id === 2) return <>
    <rect width={1024} height={1536} fill={C.rust} stroke="none" />
    <path d="M0 1187 1024 840V1536H0Z" fill={C.terra} stroke="none" />
    <g transform="translate(514 879) rotate(-25)">
      <path d="M-740-121H239Q337-151 375-94L380-3Q400 66 350 116Q286 150 233 115H-740Z" fill={C.skin} />
      <path d="M277-114Q356-143 376-104L400-25Q405 10 380 13L352-28 M306-106 340-46" fill="none" />
      <Watch scale={2.65} progress={.3 + Math.sin(t * .65) * .07} t={t} />
    </g>
    <Measure d="M334 603C144 639 140 943 323 1065S779 1068 851 889" t={t} />
  </>;
  if (id === 3) return <><Street t={t} empty /><Measure d="M304 920V994Q304 1021 340 1021H745" t={t} /></>;
  if (id === 4) return <>
    <rect width={1024} height={1536} fill={C.terra} stroke="none" />
    <path d="M0 330H1024 M0 507H1024 M0 682H1024 M0 858H1024" stroke={C.rust} strokeWidth={2} />
    <rect x={680} y={345} width={269} height={806} rx={4} fill={C.brown} />
    <rect x={705} y={371} width={219} height={780} rx={4} fill={C.orange} />
    <rect x={745} y={425} width={137} height={193} rx={4} fill={C.cream} /><path d="M813 425V618 M745 518H882" />
    <circle cx={889} cy={804} r={9} fill={C.ink} />
    <path d="M0 1149H1024V1536H0Z" fill={C.pale} /><path d="M0 1262H1024V1395H0Z" fill={C.mustard} />
    <path d="M55 1110H209L189 1240H77Z" fill={C.rust} /><Tree x={133} y={1110} scale={.69} color={C.mustard} />
    <Marcus x={490} y={1280} scale={1.55} t={t} pose="lace" bag />
    <Measure d="M334 1339Q455 1354 621 1322" t={t} />
  </>;
  if (id === 5) return <>
    <rect width={1024} height={1536} fill={C.mustard} stroke="none" />
    <rect x={-14} y={366} width={513} height={379} fill={C.terra} /><rect x={514} y={366} width={526} height={379} fill={C.terra} />
    <path d="M432 483V596 M579 483V596" stroke={C.brown} strokeWidth={9} />
    <rect y={795} width={1024} height={741} fill={C.pale} /><path d="M0 833H1024 M0 1471H1024" />
    <path d="M24 1020H222 M770 1228H973 M53 1401H280" stroke={C.terra} strokeWidth={3} />
    <Phone t={t} /><Measure d="M231 1229Q164 963 220 779" t={t} />
  </>;
  if (id === 6) return <>
    <rect width={1024} height={1536} fill={C.sky} stroke="none" />
    <Cloud x={789} y={299} scale={.85} />
    <path d="M141 506H973V1006H141Z" fill={C.terra} />
    {[0, 1, 2, 3].map(i => <g key={i}><rect x={190 + i * 190} y={563} width={137} height={109} fill={C.cream} /><path d={`M${258 + i * 190} 563V672`} /></g>)}
    <path d="M139 705H976V741H139Z" fill={C.rust} />
    <rect x={619} y={800} width={241} height={206} fill={C.brown} /><path d="M739 803V1005" stroke={C.pale} />
    <rect y={1007} width={1024} height={529} fill={C.brown} />
    <path d="M-25 1220H348 M700 1220H1060 M145 1217V1455 M861 1217V1455" stroke={C.cream} strokeWidth={5} />
    <Car x={42} y={1072} /><Car x={977} y={1072} color={C.rust} />
    <Measure d="M0 1430Q225 1378 497 1378L661 1140" t={t} />
    <Marcus x={516 + p * 28} y={1327} scale={1.5} t={t} pose="walk" bag />
  </>;
  if (id === 7) return <>
    <rect width={1024} height={1536} fill={C.rust} stroke="none" />
    <path d="M0 1290H1024V1536H0Z" fill={C.terra} stroke="none" />
    <Marcus x={479} y={1639} scale={2.55} t={t} pose="knee" mood="wince" />
    <g stroke={C.red} strokeWidth={5} fill="none" transform={`translate(0 ${Math.sin(t * 3) * 3})`}><path d="M736 1337 771 1322 M743 1367H785 M733 1399 768 1415" /></g>
  </>;
  if (id === 8) return <>
    <rect width={1024} height={1536} fill={C.sky} stroke="none" />
    <path d="M0 756Q479 626 1024 763V1536H0Z" fill={C.terra} />
    <Tree x={128} y={1009} scale={1.75} color={C.mustard} /><Tree x={937} y={1020} scale={1.5} />
    <path d="M0 1195H1024V1536H0Z" fill={C.pale} />
    <Bench x={496} y={1103} scale={1.52} /><Bag x={803} y={1062} scale={1.15} />
    <Marcus x={431} y={1341} scale={1.57} t={t} pose="sit" mood="thoughtful" />
    <Measure d="M324 1007Q396 911 545 997" t={t} />
  </>;
  if (id === 9) return <>
    <Park t={t} />
    <Walker x={620} y={913} t={t} scale={.74} woman />
    <Walker x={488} y={1246} t={t + .7} scale={1.13} elder />
    <Walker x={715} y={1470} t={t + 1.1} scale={1.15} woman />
    <Child x={741} y={1105} t={t} scale={.46} />
    <Measure d="M381 1278H575 M579 936H725 M635 1487H828" t={t} />
    <path d="M381 1266V1290 M575 1266V1290 M579 924V948 M725 924V948 M635 1475V1499 M828 1475V1499" stroke={C.red} strokeWidth={3} />
  </>;
  if (id === 10) return <>
    <Street t={t} />
    <rect y={1100} width={1024} height={436} fill={C.pale} /><path d="M0 1376H1024 M173 1100V1536 M808 1100V1536" stroke={C.terra} strokeWidth={2} />
    <Measure d="M-15 1421H382Q531 1421 674 1350" t={t} />
    <Marcus x={414} y={1329} scale={1.4} t={t} pose="walk" mood="smile" />
    <Child x={710} y={1330} t={t} scale={1.04} />
    <path d="M572 1090Q589 1109 605 1092" stroke={C.skin} strokeWidth={21} fill="none" />
  </>;
  if (id === 11) return <>
    <rect width={1024} height={1536} fill={C.rust} stroke="none" />
    <rect x={128} y={270} width={767} height={517} fill={C.brown} /><path d="M166 744H854" stroke={C.terra} strokeWidth={3} />
    <rect y={787} width={1024} height={749} fill={C.pale} />
    <rect x={94} y={847} width={836} height={467} rx={45} fill={C.terra} />
    <rect x={123} y={876} width={778} height={410} rx={25} fill="none" stroke={C.rust} strokeWidth={3} />
    <path d="M163 1262H857 M164 900H857" fill="none" stroke={C.rust} strokeDasharray="4 12" />
    <g transform="translate(0 0) rotate(-13 520 990)"><Shoe x={397} y={1070} scale={3.9} worn /><Shoe x={609} y={928} scale={3.6} worn /></g>
    <Measure d="M-40 1390Q170 1406 246 1329T639 1351Q827 1440 1059 1330" t={t} />
  </>;
  if (id === 12) return <>
    <rect width={1024} height={1536} fill={C.sky} stroke="none" />
    <circle cx={735} cy={479} r={140} fill={C.cream} stroke="none" /><Cloud x={223} y={350} scale={.8} />
    <House x={-84} y={1039} w={220} h={275} /><House x={757} y={1020} w={190} h={250} color={C.mustard} /><House x={943} y={1061} w={160} h={250} />
    <path d="M-30 1410Q150 1130 540 1030Q780 980 1050 1230L1050 1600H-30Z" fill={C.mustard} />
    <Measure d="M105 1492Q151 1319 385 1285T535 1041" t={t} />
    <Marcus x={565} y={1035} scale={1.18} t={t} pose="open" mood="smile" />
    <path d="M896 1339 914 1302 924 1343 M211 1463 218 1437 232 1462" fill="none" stroke={C.rust} />
  </>;
  if (id === 13) return <>
    <rect width={1024} height={1536} fill={C.terra} stroke="none" />
    <path d="M0 1196H1024V1536H0Z" fill={C.mustard} stroke="none" />
    <path d="M58 1558Q82 1091 234 995L474 995Q877 995 1028 1558Z" fill={C.gray} />
    <rect x={299} y={927} width={113} height={146} rx={30} fill={C.skin} />
    <Head x={357} y={803 + Math.sin(t * 1.6) * 2} scale={2.2} t={t} mood="smile" />
    <path d="M505 1580 544 1060Q556 995 595 966L660 843Q694 807 729 828Q775 847 763 891L717 1080 818 1580Z" fill={C.skin} />
    <path d="M667 847Q705 789 735 830 M692 872Q746 815 765 851" fill="none" />
    <g transform="translate(656 1190) rotate(12)"><Watch scale={2.5} progress={.79 + Math.sin(t * .6) * .025} t={t} /></g>
    <Measure d="M439 983C325 1103 409 1399 624 1440S959 1244 840 1045" t={t} />
  </>;
  if (id === 14) return <>
    <rect width={1024} height={1536} fill={C.rust} stroke="none" />
    <path d="M-40 1560Q38 1266 329 1283L695 1283Q985 1266 1065 1560Z" fill={C.gray} />
    <rect x={392} y={1196} width={240} height={223} rx={68} fill={C.skin} />
    <Head x={512} y={901 + Math.sin(t * 1.6) * 4} scale={4.78} t={t} smileAmount={Math.min(1, t / 2.5)} />
    <path d="M247 975Q245 1000 257 1015 M766 975Q775 999 767 1012" fill="none" strokeWidth={3} />
  </>;
  return <>
    <Street t={t} dusk />
    <Marcus x={514 + p * 37} y={1289} scale={1.51} t={t} pose="walk" mood="smile" bag />
    <Measure d="M-10 1444Q156 1331 322 1395T574 1321" t={t} />
  </>;
};

/** One shared vector character and palette; all motion is deterministic and frame-driven. */
export const Video: React.FC<ShortProps> = ({ audioFile }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scene = scenes.find(s => frame >= s.a && frame < s.b) ?? scenes[scenes.length - 1];
  const t = (frame - scene.a) / fps;
  const p = Math.min(1, Math.max(0, (frame - scene.a) / Math.max(1, scene.b - scene.a - 1)));
  return <AbsoluteFill style={{ background: C.sky }}>
    <svg className="steps-art" viewBox="0 0 1024 1536" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" fill="none" stroke={C.ink} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
      <style>{'.steps-art * { vector-effect: non-scaling-stroke; }'}</style>
      <Scene id={scene.id} t={t} p={p} />
    </svg>
    {audioFile && <Audio src={staticFile(audioFile)} />}
  </AbsoluteFill>;
};
