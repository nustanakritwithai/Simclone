/** 2D cutout asset contract for isometric presentation.
 * This module contains no DOM, image loading, simulation writes or 3D model concepts.
 */
export const CHARACTER_CUTOUT_ASSET_VERSION='character-cutout-assets/0.1';

export const CUTOUT_PARTS=Object.freeze([
  'head','torso',
  'upperArmL','lowerArmL','upperArmR','lowerArmR',
  'upperLegL','lowerLegL','upperLegR','lowerLegR'
]);

export const CUTOUT_FACINGS=Object.freeze([
  'front-left','front-right','back-left','back-right'
]);

export const CUTOUT_PART_SPEC=Object.freeze({
  head:Object.freeze({w:30,h:32,pivot:Object.freeze({x:.5,y:.72}),layer:80}),
  torso:Object.freeze({w:28,h:34,pivot:Object.freeze({x:.5,y:.15}),layer:50}),
  upperArmL:Object.freeze({w:10,h:24,pivot:Object.freeze({x:.5,y:.08}),layer:35}),
  lowerArmL:Object.freeze({w:8,h:22,pivot:Object.freeze({x:.5,y:.08}),layer:30}),
  upperArmR:Object.freeze({w:10,h:24,pivot:Object.freeze({x:.5,y:.08}),layer:65}),
  lowerArmR:Object.freeze({w:8,h:22,pivot:Object.freeze({x:.5,y:.08}),layer:70}),
  upperLegL:Object.freeze({w:11,h:25,pivot:Object.freeze({x:.5,y:.08}),layer:20}),
  lowerLegL:Object.freeze({w:9,h:24,pivot:Object.freeze({x:.5,y:.08}),layer:15}),
  upperLegR:Object.freeze({w:11,h:25,pivot:Object.freeze({x:.5,y:.08}),layer:25}),
  lowerLegR:Object.freeze({w:9,h:24,pivot:Object.freeze({x:.5,y:.08}),layer:18})
});

export function facingFromWorldStep(from,to){
  const dx=Number(to?.x)-Number(from?.x),dy=Number(to?.y)-Number(from?.y);
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||(dx===0&&dy===0))return 'front-right';
  // Simclone projection: screenX = x-y, screenY = x+y.
  const sx=dx-dy,sy=dx+dy;
  const horizontal=sx<0?'left':'right';
  const depth=sy<0?'back':'front';
  return depth+'-'+horizontal;
}

export function facingMirror(facing){
  return facing==='front-left'||facing==='back-left';
}

export function facingBack(facing){
  return facing==='back-left'||facing==='back-right';
}

export function cutoutAssetKey(appearance,facing='front-right'){
  const a=appearance??{};
  return [a.coat??'',a.skin??'',a.hair??'',Number(a.style??0),facingBack(facing)?'back':'front'].join('|');
}

export function validateCutoutAssetContract(spec=CUTOUT_PART_SPEC){
  const errors=[];
  for(const part of CUTOUT_PARTS){
    const row=spec?.[part];
    if(!row||!Number.isFinite(row.w)||row.w<=0||!Number.isFinite(row.h)||row.h<=0||
      !Number.isFinite(row.layer)||!row.pivot||!Number.isFinite(row.pivot.x)||!Number.isFinite(row.pivot.y)||
      row.pivot.x<0||row.pivot.x>1||row.pivot.y<0||row.pivot.y>1)errors.push(part);
  }
  return Object.freeze(errors);
}
