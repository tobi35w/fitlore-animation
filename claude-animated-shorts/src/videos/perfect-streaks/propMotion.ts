import { eventFrame,smooth,type V3 } from './story';

export type PropPose={pos:V3;rot:V3};
/** Absolute anchors shared by 3D props and the camera-projected hand drawings. */
export const PROP_ANCHORS={
  miniBrick:[120.814,1.357,-.26] as V3,
  looseBrick:[121.62,.975,.38] as V3,
  paperweight:[1.69,.998,-1.47] as V3,
  shoeBase:[-.72,.0555,-2.24] as V3,
};
export function miniBrickPose(f:number):PropPose{
  const age=f-eventFrame('brick-land'),q=smooth((age+24)/24),bounce=age>=0?.035*Math.exp(-age/7)*Math.abs(Math.sin(age*.5)):0;
  return{pos:[120.814-1.7*(1-q),1.357+.8*(1-q)+bounce,-.26+.30*(1-q)],rot:[(1-q)*.15,(1-q)*-.34,age<0?(1-q)*-.18:0]};
}
export function paperweightPose(f:number):PropPose{
  const age=f-eventFrame('paperweight'),q=smooth((age+20)/20),bounce=age>=0?.023*Math.exp(-age/6)*Math.abs(Math.sin(age*.7)):0;
  const [x,y,z]=PROP_ANCHORS.paperweight;
  return{pos:[x+.28*(1-q),y+.80*(1-q)+bounce,z+.10*(1-q)],rot:[0,.06+(1-q)*.20,(1-q)*.18]};
}
export function shoePose(f:number,i:number):PropPose{
  const age=f-eventFrame('shoes-set')+i*2,q=smooth((age+16)/16),bounce=age>=0?.045*Math.exp(-age/7)*Math.abs(Math.sin(age*.55)):0;
  return{pos:[-.72+(i?.18:-.18),.0555+(age<0?.66*(1-q):bounce),-2.24+(i?.025:-.025)],rot:[0,i?.08:-.12,age<0?(1-q)*(.13-i*.22):Math.sin(age*.5)*Math.exp(-Math.max(0,age)/7)*.035]};
}
/** A joined pair of laces connects both shoe uppers to this gripping point until release. */
export function shoeGrip(f:number):V3{
  const first=shoePose(f,0),release=smooth((f-eventFrame('shoes-set'))/8);
  return[-.72,first.pos[1]+.50-.23*release,-2.24+.04*release];
}
