import {poseForMotion,solveCharacterRig} from './character-rig.mjs?v=0.5.0';

export const CHARACTER_MOTION_SOLVER_VERSION='character-motion-solver/0.2';

export const MOTION_SOLVER_RULES=Object.freeze({
  maxRootCorrection:2.8,
  supportKneeDeg:6,
  landingCompressionDeg:8,
  swingToeLiftDeg:8
});

const finite=n=>typeof n==='number'&&Number.isFinite(n);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const phase01=p=>((finite(p)?p:0)%1+1)%1;
const freeze=v=>Object.freeze(v);

export const MOTION_LIBRARY=Object.freeze({
  idle:Object.freeze({loop:true,grounded:true}),
  walk:Object.freeze({loop:true,grounded:true}),
  run:Object.freeze({loop:true,grounded:false}),
  work:Object.freeze({loop:true,grounded:true}),
  wave:Object.freeze({loop:true,grounded:true}),
  attack:Object.freeze({loop:false,grounded:true}),
  jump:Object.freeze({loop:false,grounded:false}),
  fall:Object.freeze({loop:true,grounded:false}),
  land:Object.freeze({loop:false,grounded:true}),
  crouch:Object.freeze({loop:true,grounded:true}),
  hit:Object.freeze({loop:false,grounded:true})
});

export function contactForMotion(motion='idle',phase=0){
  const p=phase01(phase);
  if(motion==='walk'){
    if(p<.08||p>=.92)return freeze({L:true,R:true,weight:'both',flight:false});
    if(p<.5)return freeze({L:true,R:false,weight:'L',flight:false});
    return freeze({L:false,R:true,weight:'R',flight:false});
  }
  if(motion==='run'){
    if((p>=.18&&p<.36)||(p>=.68&&p<.86))return freeze({L:false,R:false,weight:'air',flight:true});
    return p<.5?freeze({L:true,R:false,weight:'L',flight:false}):freeze({L:false,R:true,weight:'R',flight:false});
  }
  if(motion==='jump'){
    if(p<.18)return freeze({L:true,R:true,weight:'both',flight:false});
    if(p<.82)return freeze({L:false,R:false,weight:'air',flight:true});
    return freeze({L:true,R:true,weight:'both',flight:false});
  }
  if(motion==='fall')return freeze({L:false,R:false,weight:'air',flight:true});
  if(motion==='land')return p<.68?freeze({L:true,R:true,weight:'both',flight:false}):freeze({L:true,R:true,weight:'both',flight:false});
  return freeze({L:true,R:true,weight:'both',flight:false});
}

function supportResponse(pose,motion,phase,contact){
  const out={...pose},p=phase01(phase),pulse=Math.sin(p*Math.PI);
  const support=contact.weight;
  if(support==='L'){
    out.kneeL=Number(out.kneeL??0)+MOTION_SOLVER_RULES.supportKneeDeg*(.45+.55*pulse);
    out.kneeR=Math.max(0,Number(out.kneeR??0)-MOTION_SOLVER_RULES.swingToeLiftDeg*.2);
  }else if(support==='R'){
    out.kneeR=Number(out.kneeR??0)+MOTION_SOLVER_RULES.supportKneeDeg*(.45+.55*pulse);
    out.kneeL=Math.max(0,Number(out.kneeL??0)-MOTION_SOLVER_RULES.swingToeLiftDeg*.2);
  }
  if(motion==='land'){
    const compression=(1-Math.min(1,p/.45));
    out.kneeL=Number(out.kneeL??0)+MOTION_SOLVER_RULES.landingCompressionDeg*compression;
    out.kneeR=Number(out.kneeR??0)+MOTION_SOLVER_RULES.landingCompressionDeg*compression;
    out.torsoLean=Number(out.torsoLean??0)+4*compression;
  }
  return out;
}

function contactAnkles(rig,contact){
  const out=[];
  if(contact.L)out.push(rig.ankleL);
  if(contact.R)out.push(rig.ankleR);
  return out;
}

export function rootCorrectionForContacts(rig,contact,scale=1){
  const feet=contactAnkles(rig,contact);
  if(!feet.length)return freeze({x:0,y:0,applied:false,reason:'air'});
  const y=feet.reduce((sum,p)=>sum+p.y,0)/feet.length;
  const max=MOTION_SOLVER_RULES.maxRootCorrection*Math.max(.1,Number(scale)||1);
  return freeze({x:0,y:clamp(-y,-max,max),applied:true,reason:contact.weight});
}

export function solveMotionFrame({
  motion='idle',
  phase=0,
  overrides=null,
  origin={x:0,y:0},
  scale=1
}={}){
  const rawPose=poseForMotion(motion,phase,overrides??{});
  const contact=contactForMotion(motion,phase);
  const pose=freeze(supportResponse(rawPose,motion,phase,contact));
  const rawRig=solveCharacterRig(pose,origin,scale);
  const correction=rootCorrectionForContacts(rawRig,contact,scale);
  const correctedOrigin={x:Number(origin?.x)||0,y:(Number(origin?.y)||0)+correction.y};
  const rig=correction.applied?solveCharacterRig(pose,correctedOrigin,scale):rawRig;
  return freeze({
    version:CHARACTER_MOTION_SOLVER_VERSION,
    motion,
    phase:phase01(phase),
    contact,
    pose,
    rootCorrection:correction,
    rig
  });
}

export function motionTransitionAlpha(elapsedMs,durationMs=150){
  const e=Math.max(0,Number(elapsedMs)||0),d=Math.max(1,Number(durationMs)||150);
  const t=clamp(e/d,0,1);
  return t*t*(3-2*t);
}

export function blendPoses(a,b,alpha=.5){
  const t=clamp(Number(alpha)||0,0,1),keys=new Set([...Object.keys(a??{}),...Object.keys(b??{})]),out={};
  for(const key of keys){
    const av=Number(a?.[key]),bv=Number(b?.[key]);
    if(finite(av)&&finite(bv))out[key]=av+(bv-av)*t;
    else if(finite(bv))out[key]=bv;
    else if(finite(av))out[key]=av;
  }
  return freeze(out);
}

export function footSockets(frame){
  const rig=frame?.rig;
  if(!rig)return null;
  return freeze({
    'foot.L':freeze({x:rig.ankleL.x,y:rig.ankleL.y}),
    'foot.R':freeze({x:rig.ankleR.x,y:rig.ankleR.y})
  });
}
