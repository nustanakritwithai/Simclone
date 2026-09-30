import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {poseForMotion} from '../src/character-rig.mjs';
import {
  CHARACTER_MOTION_SOLVER_VERSION,MOTION_SOLVER_RULES,MOTION_LIBRARY,
  contactForMotion,solveMotionFrame,rootCorrectionForContacts,
  motionTransitionAlpha,blendPoses,footSockets
} from '../src/character-motion-solver.mjs';

test('motion solver exposes grounded/air contact metadata',()=>{
  assert.equal(CHARACTER_MOTION_SOLVER_VERSION,'character-motion-solver/0.2');
  assert.equal(contactForMotion('idle',.2).weight,'both');
  assert.equal(contactForMotion('walk',.25).weight,'L');
  assert.equal(contactForMotion('walk',.75).weight,'R');
  assert.equal(contactForMotion('run',.25).flight,true);
  assert.equal(contactForMotion('jump',.5).weight,'air');
  assert.equal(contactForMotion('fall',.1).flight,true);
  assert.equal(MOTION_LIBRARY.land.grounded,true);
});

test('foot plant root correction is bounded and presentation-only',()=>{
  const frame=solveMotionFrame({motion:'walk',phase:.25,scale:1});
  assert.equal(frame.contact.weight,'L');
  assert.ok(Math.abs(frame.rootCorrection.y)<=MOTION_SOLVER_RULES.maxRootCorrection+1e-9);
  const sockets=footSockets(frame);
  assert.ok(Number.isFinite(sockets['foot.L'].x));
  assert.ok(Number.isFinite(sockets['foot.R'].y));
});

test('air states never apply planted-foot root correction',()=>{
  const fall=solveMotionFrame({motion:'fall',phase:.4,scale:1});
  assert.equal(fall.contact.weight,'air');
  assert.equal(fall.rootCorrection.applied,false);
  assert.equal(fall.rootCorrection.reason,'air');
});

test('landing adds bounded support compression without changing source pose',()=>{
  const raw=poseForMotion('land',.1),copy={...raw},frame=solveMotionFrame({motion:'land',phase:.1,scale:1});
  assert.deepEqual(raw,copy);
  assert.ok(frame.pose.kneeL>=raw.kneeL);
  assert.ok(frame.pose.kneeR>=raw.kneeR);
});

test('motion transition and pose blend are deterministic',()=>{
  assert.equal(motionTransitionAlpha(0),0);
  assert.equal(motionTransitionAlpha(150),1);
  assert.equal(motionTransitionAlpha(75),.5);
  assert.deepEqual(blendPoses({hipL:0,kneeL:10},{hipL:20,kneeL:30},.25),{hipL:5,kneeL:15});
});

test('solver source owns no simulation, DOM, random or wall-clock authority',()=>{
  const source=readFileSync(new URL('../src/character-motion-solver.mjs',import.meta.url),'utf8');
  const renderer=readFileSync(new URL('../src/character-cutout-renderer.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/Math\.random|\bDate\b|document\.|window\.|fetch\(/);
  assert.doesNotMatch(source,/\.task\s*=|\.x\s*=|\.y\s*=|profession\s*=|currencyWallet\s*=/);
  assert.match(renderer,/solveMotionFrame\(/);
});

test('manual root correction helper follows exact contact set',()=>{
  const raw=solveMotionFrame({motion:'idle',phase:0,scale:1}).rig;
  const left=rootCorrectionForContacts(raw,{L:true,R:false,weight:'L'},1);
  const right=rootCorrectionForContacts(raw,{L:false,R:true,weight:'R'},1);
  assert.equal(left.reason,'L');
  assert.equal(right.reason,'R');
});
