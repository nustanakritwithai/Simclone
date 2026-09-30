import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  CHARACTER_PROFESSION_MOTION_VERSION,SHARED_CHARACTER_MOTIONS,
  PROFESSION_PROFILE_ORDER,PROFESSION_MOTION_GROUPS,
  professionMotionGroup,motionForAgent
} from '../src/character-profession-motion.mjs';
import {poseForMotion,solveCharacterRig} from '../src/character-rig.mjs';

test('profession motion profiles expose one explicit animation group per career',()=>{
  assert.equal(CHARACTER_PROFESSION_MOTION_VERSION,'character-profession-motion/1');
  assert.deepEqual(PROFESSION_PROFILE_ORDER,['forager','woodcutter','miner','builder','crafter','merchant','adventurer']);
  assert.deepEqual(SHARED_CHARACTER_MOTIONS,['idle','walk','run','jump','fall','land','crouch','hit']);
  assert.deepEqual(professionMotionGroup('forager'),['forage']);
  assert.deepEqual(professionMotionGroup('woodcutter'),['woodcut']);
  assert.deepEqual(professionMotionGroup('miner'),['mine']);
  assert.deepEqual(professionMotionGroup('builder'),['build']);
  assert.deepEqual(professionMotionGroup('crafter'),['craft','process']);
  assert.deepEqual(professionMotionGroup('merchant'),['merchant-inspect','merchant-trade']);
  assert.deepEqual(professionMotionGroup('adventurer'),['hunt','attack','guard','victory']);
});

test('runtime selects signature work motion only when profession matches',()=>{
  assert.equal(motionForAgent({profession:'forager',task:{kind:'FORAGE',path:[]}}),'forage');
  assert.equal(motionForAgent({profession:'woodcutter',task:{kind:'WOODCUT',path:[]}}),'woodcut');
  assert.equal(motionForAgent({profession:'miner',task:{kind:'MINE',path:[]}}),'mine');
  assert.equal(motionForAgent({profession:'builder',task:{kind:'BUILD',path:[]}}),'build');
  assert.equal(motionForAgent({profession:'crafter',task:{kind:'CRAFT',path:[]}}),'craft');
  assert.equal(motionForAgent({profession:'crafter',task:{kind:'PROCESS',path:[]}}),'process');
  assert.equal(motionForAgent({profession:'merchant',task:{kind:'IDLE',path:[],rc4MarketTravel:{marketId:'M1'}}}),'merchant-trade');
  assert.equal(motionForAgent({profession:'adventurer',task:{kind:'HUNT',path:[]}}),'hunt');
  assert.equal(motionForAgent({profession:'adventurer',task:{kind:'HUNT',path:[{x:1,y:1}]}}),'hunt');
  assert.equal(motionForAgent({profession:'adventurer',adventureCombat:{status:'ACTIVE'},task:null}),'attack');
});

test('shared locomotion stays shared and mismatched careers cannot steal signature poses',()=>{
  assert.equal(motionForAgent({profession:'builder',task:{kind:'BUILD',path:[{x:2,y:2}]}}),'walk');
  assert.equal(motionForAgent({profession:'merchant',task:{kind:'CRAFT',path:[]}}),'work');
  assert.equal(motionForAgent({profession:'builder',task:{kind:'MINE',path:[]}}),'work');
  assert.equal(motionForAgent({profession:'crafter',task:null}),'idle');
});

test('every profession pose resolves to finite shared-rig geometry',()=>{
  const names=[...new Set(Object.values(PROFESSION_MOTION_GROUPS).flat())];
  assert.equal(names.length,13);
  for(const motion of names){
    const pose=poseForMotion(motion,.37),rig=solveCharacterRig(pose,{x:0,y:0},1);
    for(const point of [rig.root,rig.neck,rig.headCenter,rig.elbowL,rig.wristL,rig.elbowR,rig.wristR,rig.kneeL,rig.ankleL,rig.kneeR,rig.ankleR]){
      assert.equal(Number.isFinite(point.x)&&Number.isFinite(point.y),true,motion);
    }
  }
});

test('profession selector and Pose Studio remain presentation-only',()=>{
  const selector=readFileSync(new URL('../src/character-profession-motion.mjs',import.meta.url),'utf8');
  const ui=readFileSync(new URL('../src/independent-ui.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(selector,/Math\.random|\bDate\b|document\.|window\.|fetch\(/);
  assert.doesNotMatch(selector,/agent\.(?:task|profession|x|y)\s*=|currencyWallet\s*=|inventory\s*=/);
  assert.match(ui,/data-pose-profession/);
  assert.match(ui,/professionMotionGroup\(/);
});
