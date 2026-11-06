import { LIGHTS, LOOK, type LightPreset, type WorldLook } from './lights';
import type { LightName } from './story';
// Blue explanation draws on the measured blue ambient / warm window reference scenes.
// Day and golden presets and all post parameters remain the template values.
const BLUE:LightPreset={...LIGHTS.day,az:55,el:42,lit:[.76,.90,1.32],shade:[.24,.27,.48],lift:[.035,.055,.15],charTint:[.91,.94,1.14],charShade:.89,sideTint:[.86,.89,1.04],fog:'#9aaac7',sunCol:'#adc9ee',sunI:2.8,sky:'#b6c9ed',ground:'#767994'};
const BLUE_LOOK:WorldLook={...LOOK.day,sky:{c:['#a6b1c9','#8b9dc2','#6f8db8','#597bac','#40649a'],e:[0,3,8,16,40]},bounce:[.025,.035,.08],sat:1.02};
export const lightFor=(name:LightName)=>name==='blue'?BLUE:LIGHTS[name];
export const lookFor=(name:LightName)=>name==='blue'?BLUE_LOOK:LOOK[name];
