/** Character Cutout Rig V0.1 — deterministic 2D skeleton for image-piece animation.
 * Pure pose/kinematics only. Rendering and image creation live in character-cutout-renderer.mjs.
 */
export const CHARACTER_RIG_VERSION='character-cutout-rig/0.1';

export const CHARACTER_BONES=Object.freeze([
  'torso','head',
  'upperArmL','lowerArmL','upperArmR','lowerArmR',
  'upperLegL','lowerLegL','upperLegR','lowerLegR'
]);

export const POSE_PRESETS=Object.freeze(['idle','walk','run','work','wave','attack','jump','fall','land','crouch','hit']);

export const RIG_METRICS=Object.freeze({
  pelvisY:-18,
  torso:14,
  shoulderHalf:5,
  upperArm:8,
  lowerArm:8,
  hipHalf:3,
  upperLeg:9,
  lowerLeg:9,
  headOffset:7
});

const finite=n=>typeof n==='number'&&Number.isFinite(n);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const rad=d=>d*Math.PI/180;
const phase01=p=>((finite(p)?p:0)%1+1)%1;
const seg=(start,length,angleDeg)=>{
  const a=rad(angleDeg);
  return {x:start.x+Math.sin(a)*length,y:start.y+Math.cos(a)*length};
};
const freezeDeep=v=>Object.freeze(Object.fromEntries(Object.entries(v).map(([k,x])=>[k,x&&typeof x==='object'?Object.freeze({...x}):x])));

function basePose(){
  return {
    torsoLean:0,headTilt:0,
    shoulderL:-5,elbowL:4,shoulderR:5,elbowR:-4,
    hipL:-2,kneeL:2,hipR:2,kneeR:2
  };
}

export function poseForMotion(motion='idle',phase=0,overrides={}){
  const p=phase01(phase),wave=Math.sin(p*Math.PI*2),cycle=Math.sin(p*Math.PI*2),abs=Math.abs(cycle);
  const pose=basePose();
  switch(motion){
    case 'walk':
      pose.torsoLean=cycle*2;
      pose.shoulderL=cycle*26;pose.shoulderR=-cycle*26;
      pose.elbowL=8+Math.max(0,-cycle)*12;pose.elbowR=-8-Math.max(0,cycle)*12;
      pose.hipL=-cycle*24;pose.hipR=cycle*24;
      pose.kneeL=Math.max(0,cycle)*24;pose.kneeR=Math.max(0,-cycle)*24;
      break;
    case 'run':
      pose.torsoLean=8;
      pose.shoulderL=cycle*42;pose.shoulderR=-cycle*42;
      pose.elbowL=34;pose.elbowR=-34;
      pose.hipL=-cycle*38;pose.hipR=cycle*38;
      pose.kneeL=18+Math.max(0,cycle)*40;pose.kneeR=18+Math.max(0,-cycle)*40;
      break;
    case 'work':
      pose.torsoLean=10+abs*5;
      pose.shoulderL=-28+cycle*14;pose.shoulderR=38-cycle*38;
      pose.elbowL=24;pose.elbowR=-30-cycle*18;
      pose.hipL=-6;pose.hipR=7;pose.kneeL=6;pose.kneeR=8;
      break;
    case 'wave':
      pose.shoulderR=-125+wave*8;pose.elbowR=-45+wave*22;
      pose.shoulderL=-8;pose.elbowL=8;pose.headTilt=wave*4;
      break;
    case 'attack':{
      const strike=Math.sin(Math.min(1,p)*Math.PI);
      pose.torsoLean=12*strike;
      pose.shoulderR=-35-95*strike;pose.elbowR=-18-28*strike;
      pose.shoulderL=20+20*strike;pose.elbowL=18;
      pose.hipL=-10*strike;pose.hipR=14*strike;
      pose.kneeL=10*strike;pose.kneeR=18*strike;
      break;
    }
    case 'jump':{
      const air=Math.sin(Math.min(1,p)*Math.PI);
      pose.torsoLean=-5*air;
      pose.shoulderL=35*air;pose.shoulderR=-35*air;
      pose.elbowL=25*air;pose.elbowR=-25*air;
      pose.hipL=18*air;pose.hipR=12*air;pose.kneeL=48*air;pose.kneeR=42*air;
      break;
    }
    case 'fall':
      pose.torsoLean=-8;pose.shoulderL=-50;pose.shoulderR=50;pose.elbowL=22;pose.elbowR=-22;
      pose.hipL=8;pose.hipR=8;pose.kneeL=28;pose.kneeR=28;break;
    case 'land':{
      const settle=1-Math.min(1,p/.55);
      pose.torsoLean=16*settle;pose.shoulderL=-24*settle;pose.shoulderR=24*settle;
      pose.hipL=-38*settle;pose.hipR=-38*settle;pose.kneeL=84*settle;pose.kneeR=84*settle;break;
    }
    case 'crouch':
      pose.torsoLean=10;pose.shoulderL=-8;pose.shoulderR=8;
      pose.hipL=-34;pose.hipR=-34;pose.kneeL=76;pose.kneeR=76;break;
    case 'hit':{
      const hit=Math.sin(Math.min(1,p)*Math.PI);
      pose.torsoLean=-18*hit;pose.headTilt=10*hit;
      pose.shoulderL=24*hit;pose.shoulderR=-30*hit;pose.elbowL=18*hit;pose.elbowR=-20*hit;
      pose.hipL=8*hit;pose.hipR=-6*hit;pose.kneeL=10*hit;pose.kneeR=16*hit;break;
    }
    case 'idle':
    default:
      pose.torsoLean=Math.sin(p*Math.PI*2)*1.2;
      pose.headTilt=Math.sin(p*Math.PI*2)*1.5;
      pose.shoulderL=-5+wave*1.5;pose.shoulderR=5-wave*1.5;
      break;
  }
  for(const [k,v] of Object.entries(overrides??{}))if(k in pose&&finite(v))pose[k]=clamp(v,-170,170);
  return Object.freeze({...pose});
}

export function solveCharacterRig(poseInput={},origin={x:0,y:0},scale=1){
  const pose={...basePose(),...poseInput},m=RIG_METRICS,s=finite(scale)&&scale>0?scale:1;
  const root={x:finite(origin?.x)?origin.x:0,y:(finite(origin?.y)?origin.y:0)+m.pelvisY*s};
  const torsoAngle=180+pose.torsoLean;
  const neck=seg(root,m.torso*s,torsoAngle);
  const shoulderAxis=rad(pose.torsoLean);
  const shoulderDx=Math.cos(shoulderAxis)*m.shoulderHalf*s;
  const shoulderDy=Math.sin(shoulderAxis)*m.shoulderHalf*s;
  const shoulderL={x:neck.x-shoulderDx,y:neck.y-shoulderDy+2*s};
  const shoulderR={x:neck.x+shoulderDx,y:neck.y+shoulderDy+2*s};
  const hipL={x:root.x-m.hipHalf*s,y:root.y};
  const hipR={x:root.x+m.hipHalf*s,y:root.y};

  const elbowL=seg(shoulderL,m.upperArm*s,pose.shoulderL+pose.torsoLean);
  const wristL=seg(elbowL,m.lowerArm*s,pose.shoulderL+pose.elbowL+pose.torsoLean);
  const elbowR=seg(shoulderR,m.upperArm*s,pose.shoulderR+pose.torsoLean);
  const wristR=seg(elbowR,m.lowerArm*s,pose.shoulderR+pose.elbowR+pose.torsoLean);
  const kneeL=seg(hipL,m.upperLeg*s,pose.hipL);
  const ankleL=seg(kneeL,m.lowerLeg*s,pose.hipL+pose.kneeL);
  const kneeR=seg(hipR,m.upperLeg*s,pose.hipR);
  const ankleR=seg(kneeR,m.lowerLeg*s,pose.hipR+pose.kneeR);
  const headCenter=seg(neck,m.headOffset*s,180+pose.torsoLean+pose.headTilt*.35);

  return freezeDeep({
    root,neck,headCenter,shoulderL,elbowL,wristL,shoulderR,elbowR,wristR,
    hipL,kneeL,ankleL,hipR,kneeR,ankleR,
    pose:Object.freeze({...pose})
  });
}

export function motionForAgent(agent){
  if(agent?.adventureCombat?.status==='ACTIVE')return 'attack';
  const moving=Array.isArray(agent?.task?.path)&&agent.task.path.length>0;
  if(moving)return 'walk';
  if(['BUILD','CRAFT','PROCESS','WOODCUT','MINE'].includes(agent?.task?.kind))return 'work';
  return 'idle';
}

export function posePhaseForAgent(agent,timeMs=0){
  const id=Number.isSafeInteger(agent?.id)?agent.id:0;
  const speed=motionForAgent(agent)==='run'?.0015:.00115;
  return phase01((finite(timeMs)?timeMs:0)*speed+id*.173);
}
