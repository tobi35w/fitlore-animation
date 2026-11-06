import { LIGHTS, LOOK, type LightPreset, type WorldLook } from './lights';
import type { LightName } from './story';

// Story variants retain the supplied two-tone model, face brightness and post chain.
// Blue isolates the tabletop analogy; storm shifts the exterior to an overcast blue-grey.
const BLUE:LightPreset={...LIGHTS.day,az:55,el:42,lit:[.82,.96,1.32],shade:[.26,.29,.47],lift:[.04,.06,.14],charTint:[.92,.95,1.10],charShade:.89,sideTint:[.88,.91,1.03],fog:'#a0aec5',sunCol:'#bbd3ef',sunI:2.8,sky:'#b8ccee',ground:'#878b99'};
const BLUE_LOOK:WorldLook={...LOOK.day,sky:{c:['#aab7cf','#91a7c9','#789bc1','#6386b4','#4b72a7'],e:[0,3,8,16,40]},cloud:{lit:'#d2deeb',mid:'#b6c6df',shade:'#98aacb'},bounce:[.025,.035,.075],sat:1.02};
const STORM:LightPreset={...LIGHTS.day,az:66,el:48,lit:[1.05,1.08,1.19],shade:[.30,.32,.41],lift:[.05,.06,.10],charTint:[.97,.98,1.045],charShade:.90,sideTint:[.92,.94,1.0],fog:'#a6b4c6',sunCol:'#d4dfeb',sunI:1.9,sky:'#b1c1d4',ground:'#8b9197'};
const STORM_LOOK:WorldLook={...LOOK.day,sky:{c:['#a6b4c6','#899aaf','#70859f','#627892','#516783'],e:[0,3,8,16,40]},cloud:{lit:'#b4c1d0',mid:'#96a8c0',shade:'#7e93af'},bounce:[.015,.020,.05],sat:.95};
export const lightFor=(name:LightName):LightPreset=>name==='blue'?BLUE:name==='storm'?STORM:LIGHTS[name];
export const lookFor=(name:LightName):WorldLook=>name==='blue'?BLUE_LOOK:name==='storm'?STORM_LOOK:LOOK[name];
