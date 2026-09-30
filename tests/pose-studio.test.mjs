import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  ACTION_MOTIONS,CHARACTER_BONES,CHARACTER_RIG_VERSION,POSE_PRESETS,RIG_METRICS,
  motionForAgent,poseForMotion,posePhaseForAgent,solveCharacterRig
} from '../src/character-rig.mjs';
import {CUTOUT_FACINGS,CUTOUT_PARTS,facingBack,facingFromWorldStep,facingMirror,validateCutoutAssetContract} from '../src/character-cutout-assets.mjs';

const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const near=(a,b,eps=1e-9)=>Math.abs(a-b)<=eps;

test('Pose Studio rig exposes the required articulated 2D body',()=>{
  assert.equal(CHARACTER_RIG_VERSION,'character-cutout-rig/0.1');
  assert.deepEqual(CHARACTER_BONES,[
    'torso','head','upperArmL','lowerArmL','upperArmR','lowerArmR',
    'upperLegL','lowerLegL','upperLegR','lowerLegR'
  ]);
  assert.deepEqual(POSE_PRESETS,['idle','walk','run','work','wave','attack']);
  assert.deepEqual(ACTION_MOTIONS,['rest','eat','forage','woodcut','mine','build','craft','process','hunt']);
});

test('skeleton solve is deterministic and preserves connected segment lengths',()=>{
  const pose=poseForMotion('walk',.375),a=solveCharacterRig(pose,{x:4,y:9},2.5),b=solveCharacterRig(pose,{x:4,y:9},2.5);
  assert.deepEqual(a,b);
  assert.ok(near(dist(a.root,a.neck),RIG_METRICS.torso*2.5));
  assert.ok(near(dist(a.shoulderL,a.elbowL),RIG_METRICS.upperArm*2.5));
  assert.ok(near(dist(a.elbowL,a.wristL),RIG_METRICS.lowerArm*2.5));
  assert.ok(near(dist(a.shoulderR,a.elbowR),RIG_METRICS.upperArm*2.5));
  assert.ok(near(dist(a.elbowR,a.wristR),RIG_METRICS.lowerArm*2.5));
  assert.ok(near(dist(a.hipL,a.kneeL),RIG_METRICS.upperLeg*2.5));
  assert.ok(near(dist(a.kneeL,a.ankleL),RIG_METRICS.lowerLeg*2.5));
  assert.ok(near(dist(a.hipR,a.kneeR),RIG_METRICS.upperLeg*2.5));
  assert.ok(near(dist(a.kneeR,a.ankleR),RIG_METRICS.lowerLeg*2.5));
});

test('walk and run alternate opposite limbs while idle stays bounded',()=>{
  const walk=poseForMotion('walk',.25),run=poseForMotion('run',.25),idle=poseForMotion('idle',.25);
  assert.ok(walk.shoulderL*walk.shoulderR<0);
  assert.ok(walk.hipL*walk.hipR<0);
  assert.ok(Math.abs(run.shoulderL)>Math.abs(walk.shoulderL));
  assert.ok(Math.abs(run.hipL)>Math.abs(walk.hipL));
  assert.ok(Math.abs(idle.torsoLean)<2);
});

test('agent motion derives from existing task/combat state without writing gameplay',()=>{
  assert.equal(motionForAgent({id:1,task:null}),'idle');
  assert.equal(motionForAgent({id:1,task:{kind:'EXPLORE',path:[{x:1,y:1}]}}),'walk');
  for(const [kind,motion] of Object.entries({REST:'rest',EAT:'eat',FORAGE:'forage',WOODCUT:'woodcut',MINE:'mine',BUILD:'build',CRAFT:'craft',PROCESS:'process',HUNT:'hunt'}))
    assert.equal(motionForAgent({id:1,task:{kind,path:[]}}),motion);
  assert.equal(motionForAgent({id:1,task:{kind:'HUNT',path:[{x:1,y:1}]}}),'hunt');
  assert.equal(motionForAgent({id:1,adventureCombat:{status:'ACTIVE'},task:null}),'attack');
  assert.equal(posePhaseForAgent({id:7,task:null},12345),posePhaseForAgent({id:7,task:null},12345));
});

test('action poses are distinct, finite and keep the same skeleton topology',()=>{
  const signatures=new Set();
  for(const motion of ACTION_MOTIONS){
    const pose=poseForMotion(motion,.37),rig=solveCharacterRig(pose,{x:0,y:0},1);
    for(const point of [rig.root,rig.neck,rig.headCenter,rig.elbowL,rig.wristL,rig.elbowR,rig.wristR,rig.kneeL,rig.ankleL,rig.kneeR,rig.ankleR]){
      assert.equal(Number.isFinite(point.x)&&Number.isFinite(point.y),true,motion);
    }
    signatures.add(JSON.stringify(pose));
  }
  assert.equal(signatures.size,ACTION_MOTIONS.length);
});

test('rig and cutout renderer are deterministic 2D image-piece code, not 3D model code',()=>{
  const rig=readFileSync(new URL('../src/character-rig.mjs',import.meta.url),'utf8');
  const renderer=readFileSync(new URL('../src/character-cutout-renderer.mjs',import.meta.url),'utf8');
  const app=readFileSync(new URL('../src/app.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(rig,/Math\.random|\bDate\b|document\.|window\.|fetch\(/);
  assert.match(renderer,/sourceKind:'prototype-image-pieces'/);
  assert.match(renderer,/drawImage\(/);
  assert.doesNotMatch(renderer,/THREE\.|WebGLRenderingContext|\.gltf\b|\.glb\b/);
  assert.match(app,/drawAgentCutout\(c,a,time/);
  assert.doesNotMatch(app,/line\(c,\[\[-3,-9\],\[-4\+stride/);
});

test('isometric facing derives only from world step and supports four cutout views',()=>{
  assert.deepEqual(CUTOUT_FACINGS,['front-left','front-right','back-left','back-right']);
  assert.equal(facingFromWorldStep({x:0,y:0},{x:1,y:0}),'front-right');
  assert.equal(facingFromWorldStep({x:0,y:0},{x:0,y:1}),'front-left');
  assert.equal(facingFromWorldStep({x:0,y:0},{x:-1,y:0}),'back-left');
  assert.equal(facingFromWorldStep({x:0,y:0},{x:0,y:-1}),'back-right');
  assert.equal(facingMirror('front-left'),true);
  assert.equal(facingBack('back-right'),true);
  assert.deepEqual(validateCutoutAssetContract(),[]);
  assert.equal(CUTOUT_PARTS.length,10);
});

test('world cutout facing stays render-only and never writes visual state into agents',()=>{
  const app=readFileSync(new URL('../src/app.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(app,/\.visualFacing\s*=/);
  assert.match(app,/v\.facing=facing/);
  assert.match(app,/facingFromWorldStep\(a,next\)/);
});
