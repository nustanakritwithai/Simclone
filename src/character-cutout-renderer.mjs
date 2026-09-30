import {motionForAgent,poseForMotion,posePhaseForAgent,solveCharacterRig} from './character-rig.mjs?v=0.5.0';
import {cutoutAssetKey,facingBack,facingMirror} from './character-cutout-assets.mjs?v=0.5.0';

/** 2D cutout renderer.
 * Bones transform raster image pieces. No 3D mesh/model/geometry authority.
 */
export const CHARACTER_CUTOUT_RENDERER_VERSION='character-cutout-renderer/0.1';

const atlasCache=new Map();


function surface(w,h){
  if(typeof OffscreenCanvas!=='undefined')return new OffscreenCanvas(w,h);
  const c=document.createElement('canvas');c.width=w;c.height=h;return c;
}
function ellipse(c,x,y,rx,ry,fill){
  c.fillStyle=fill;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();
}
function polygon(c,points,fill){
  c.fillStyle=fill;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();
}
function limbImage(fill,{w=12,h=30,hand=null,boot=null}={}){
  const s=surface(w,h),c=s.getContext('2d');c.clearRect(0,0,w,h);
  c.fillStyle=fill;c.beginPath();c.roundRect(2,1,w-4,h-4,Math.max(2,w*.32));c.fill();
  if(hand)ellipse(c,w/2,h-3,Math.max(2,w*.28),Math.max(2,w*.24),hand);
  if(boot){c.fillStyle=boot;c.beginPath();c.roundRect(1,h-8,w-2,7,2);c.fill();}
  return s;
}
function torsoImage(a){
  const s=surface(28,34),c=s.getContext('2d');c.clearRect(0,0,s.width,s.height);
  polygon(c,[[6,2],[22,2],[26,30],[2,30]],a.coat);
  c.fillStyle='#eadcb28a';c.fillRect(5,23,18,2);
  c.strokeStyle='#eee4ba77';c.lineWidth=1;c.beginPath();c.moveTo(14,4);c.lineTo(14,29);c.stroke();
  return s;
}
function headImage(a,{back=false}={}){
  const s=surface(30,32),c=s.getContext('2d');c.clearRect(0,0,s.width,s.height);
  ellipse(c,15,18,9,11,a.skin);ellipse(c,15,9,10,6,a.hair);
  if(a.style===1)ellipse(c,7,14,3,8,a.hair);
  if(a.style===2){c.fillStyle=a.hair;c.fillRect(5,7,4,17);}
  if(back){
    c.fillStyle=a.hair;c.beginPath();c.roundRect(6,8,18,18,7);c.fill();
    c.fillStyle='#ffffff22';c.fillRect(10,9,8,2);
  }else{
    ellipse(c,12,17,1.15,1,a.hair);ellipse(c,19,17,1.15,1,a.hair);
    c.strokeStyle='#a66c54';c.lineWidth=1;c.beginPath();c.moveTo(12,24);c.quadraticCurveTo(15,26,19,23);c.stroke();
  }
  return s;
}

export function prototypePartAtlas(appearance,facing='front-right'){
  const key=cutoutAssetKey(appearance,facing);
  if(atlasCache.has(key))return atlasCache.get(key);
  const a={coat:appearance?.coat??'#8a9c82',skin:appearance?.skin??'#d5a47c',hair:appearance?.hair??'#3c3028',style:Number(appearance?.style??0)};
  const atlas=Object.freeze({
    sourceKind:'prototype-image-pieces',
    facing,
    head:headImage(a,{back:facingBack(facing)}),
    torso:torsoImage(a),
    upperArmL:limbImage(a.coat,{w:10,h:24,hand:a.skin}),
    lowerArmL:limbImage(a.skin,{w:8,h:22,hand:a.skin}),
    upperArmR:limbImage(a.coat,{w:10,h:24,hand:a.skin}),
    lowerArmR:limbImage(a.skin,{w:8,h:22,hand:a.skin}),
    upperLegL:limbImage('#344439',{w:11,h:25}),
    lowerLegL:limbImage('#344439',{w:9,h:24,boot:'#26342d'}),
    upperLegR:limbImage('#344439',{w:11,h:25}),
    lowerLegR:limbImage('#344439',{w:9,h:24,boot:'#26342d'})
  });
  atlasCache.set(key,atlas);return atlas;
}

function drawBetween(c,img,a,b,width){
  const dx=b.x-a.x,dy=b.y-a.y,len=Math.max(1,Math.hypot(dx,dy)),rot=Math.atan2(dy,dx)-Math.PI/2;
  c.save();c.translate(a.x,a.y);c.rotate(rot);
  c.drawImage(img,-width/2,-2,width,len+4);
  c.restore();
}
function drawHead(c,img,center,scale,tilt=0){
  const w=15*scale,h=16*scale;c.save();c.translate(center.x,center.y);c.rotate(tilt*Math.PI/180);c.drawImage(img,-w/2,-h/2,w,h);c.restore();
}
function drawTorso(c,img,root,neck,scale){
  drawBetween(c,img,neck,root,12*scale);
}
function bone(c,a,b){
  c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();
}
function joint(c,p,r){
  c.beginPath();c.arc(p.x,p.y,r,0,Math.PI*2);c.fill();c.stroke();
}
export function drawSkeletonOverlay(c,rig,{scale=1}={}){
  c.save();c.strokeStyle='#e6c879dd';c.fillStyle='#173b33';c.lineWidth=Math.max(.7,.8*scale);
  for(const [a,b] of [
    [rig.root,rig.neck],[rig.neck,rig.headCenter],
    [rig.shoulderL,rig.elbowL],[rig.elbowL,rig.wristL],
    [rig.shoulderR,rig.elbowR],[rig.elbowR,rig.wristR],
    [rig.hipL,rig.kneeL],[rig.kneeL,rig.ankleL],
    [rig.hipR,rig.kneeR],[rig.kneeR,rig.ankleR]
  ])bone(c,a,b);
  for(const p of [rig.root,rig.neck,rig.shoulderL,rig.elbowL,rig.wristL,rig.shoulderR,rig.elbowR,rig.wristR,rig.hipL,rig.kneeL,rig.ankleL,rig.hipR,rig.kneeR,rig.ankleR])joint(c,p,Math.max(1,1.35*scale));
  c.restore();
}
function drawTool(c,tool,rig,scale){
  if(!tool)return;
  const hand=rig.wristR;c.save();c.translate(hand.x,hand.y);
  c.strokeStyle='#a69265';c.lineWidth=1.7*scale;c.beginPath();c.moveTo(0,0);c.lineTo(4*scale,-10*scale);c.stroke();
  if(tool==='HAMMER'){c.fillStyle='#b8bdad';c.fillRect(1*scale,-13*scale,8*scale,4*scale);}
  else if(tool==='STONE_AXE')polygon(c,[[2*scale,-13*scale],[9*scale,-11*scale],[6*scale,-6*scale]],'#c4c9b4');
  else if(tool==='STONE_PICKAXE'){c.strokeStyle='#b5bba5';c.lineWidth=2*scale;c.beginPath();c.moveTo(-1*scale,-12*scale);c.lineTo(9*scale,-12*scale);c.stroke();}
  c.restore();
}

export function drawRiggedCharacter(c,{
  appearance,
  motion='idle',
  phase=0,
  overrides=null,
  scale=1,
  mirror=null,
  facing='front-right',
  showBones=false,
  tool=null
}={}){
  const pose=poseForMotion(motion,phase,overrides??{}),rig=solveCharacterRig(pose,{x:0,y:0},scale),atlas=prototypePartAtlas(appearance,facing);
  const shouldMirror=mirror===null?facingMirror(facing):!!mirror;
  c.save();if(shouldMirror)c.scale(-1,1);
  drawBetween(c,atlas.upperArmL,rig.shoulderL,rig.elbowL,6*scale);
  drawBetween(c,atlas.lowerArmL,rig.elbowL,rig.wristL,5*scale);
  drawBetween(c,atlas.upperLegL,rig.hipL,rig.kneeL,6.4*scale);
  drawBetween(c,atlas.lowerLegL,rig.kneeL,rig.ankleL,5.7*scale);
  drawBetween(c,atlas.upperLegR,rig.hipR,rig.kneeR,6.4*scale);
  drawBetween(c,atlas.lowerLegR,rig.kneeR,rig.ankleR,5.7*scale);
  drawTorso(c,atlas.torso,rig.root,rig.neck,scale);
  drawBetween(c,atlas.upperArmR,rig.shoulderR,rig.elbowR,6*scale);
  drawBetween(c,atlas.lowerArmR,rig.elbowR,rig.wristR,5*scale);
  drawHead(c,atlas.head,rig.headCenter,scale,pose.headTilt);
  drawTool(c,tool,rig,scale);
  if(showBones)drawSkeletonOverlay(c,rig,{scale});
  c.restore();
  return rig;
}

export function drawAgentCutout(c,agent,timeMs,{showBones=false,tool=null,mirror=null,facing='front-right',scale=1}={}){
  const motion=motionForAgent(agent),phase=posePhaseForAgent(agent,timeMs);
  return drawRiggedCharacter(c,{appearance:agent.appearance,motion,phase,showBones,tool,mirror,facing,scale});
}
