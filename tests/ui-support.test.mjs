import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldStore,saveLabel} from '../src/storage.mjs';
import {safeFrame,mapCell} from '../src/navigation.mjs';
import {createWorld,serialize,restore} from '../src/engine.mjs';
function fixture(text=null){const data=new Map(text===null?[]:[['simclone:world:v1',text]]);let denyGet=false,denySet=false;
 const adapter={getItem:key=>{if(denyGet)throw Error('denied');return data.get(key)??null},setItem:(key,value)=>{if(denySet)throw Error('quota');data.set(key,value)}};
 return {data,denyRead:()=>{denyGet=true},denyWrite:()=>{denySet=true},allowWrite:()=>{denySet=false},store:createWorldStore({getStorage:()=>adapter,serialize,restore,now:()=>77})};}
test('empty browser does not claim saved until write succeeds',()=>{const f=fixture();assert.equal(f.store.load(),null);assert.equal(f.store.status().kind,'new');assert.equal(f.data.size,0);assert.equal(f.store.save(createWorld()).ok,true);assert.equal(f.store.status().kind,'saved');assert.equal(f.store.status().at,77);});
test('valid legacy 0.1.0 save loads without migration or extra mutation',()=>{const world=createWorld(89),text=serialize(world),f=fixture(text);assert.equal(serialize(f.store.load()),text);assert.equal(f.store.status().kind,'loaded');assert.equal(f.data.get('simclone:world:v1'),text);});
test('corrupt save is protected from repeated autosaves, available unchanged for recovery',()=>{const f=fixture('broken original');assert.equal(f.store.load(),null);for(let i=0;i<4;i++)assert.deepEqual(f.store.save(createWorld()),{ok:false,reason:'protected'});assert.equal(f.store.originalText(),'broken original');assert.equal(f.data.get('simclone:world:v1'),'broken original');});
test('denied read is unavailable rather than falsely labeled corrupt',()=>{const f=fixture();f.denyRead();assert.equal(f.store.load(),null);assert.equal(f.store.status().kind,'unavailable');assert.equal(f.store.status().protected,true);});
test('quota failure never reports saved',()=>{const f=fixture();f.denyWrite();assert.equal(f.store.save(createWorld()).ok,false);assert.equal(f.store.status().kind,'unavailable');assert.equal(f.data.size,0);assert.ok(saveLabel(f.store.status()).includes('บันทึกไม่ได้'));});
test('storage can recover without deleting the world',()=>{const f=fixture();f.denyWrite();const s=createWorld(7);f.store.save(s);f.allowWrite();assert.equal(f.store.save(s).ok,true);assert.equal(f.store.status().kind,'saved');assert.equal(f.data.get('simclone:world:v1'),serialize(s));});
test('explicit replacement releases protection, original backup remains recoverable',()=>{const f=fixture('bad');f.store.load();f.store.allowReplacement();assert.equal(f.store.save(createWorld()).ok,true);assert.equal(f.store.originalText(),'bad');assert.doesNotThrow(()=>restore(f.data.get('simclone:world:v1')));});
test('save status is copied, not a mutable escape hatch',()=>{const f=fixture('bad');f.store.load();f.store.status().protected=false;assert.equal(f.store.save(createWorld()).ok,false);});
test('safe camera bounds stay finite and visible in supported viewport sizes',()=>{for(const [w,h] of [[320,566],[390,670],[768,948],[1440,924],[844,333]]){const r=safeFrame(w,h,{top:155,bottom:h-200,left:12,right:w-12});assert.ok(r.left>=0&&r.right<=w&&r.top>=0&&r.bottom<=h);assert.ok(r.width>0&&r.height>=56);}});
test('minimap pointer clamps to valid map coordinates',()=>{assert.deepEqual(mapCell(-4,-1,180,156),{x:0,y:0});assert.deepEqual(mapCell(180,156,180,156),{x:29,y:25});assert.deepEqual(mapCell(90,78,180,156),{x:15,y:13});});

test('failed read must not overwrite an unknown original even if writes work',()=>{const f=fixture('original not yet read');f.denyRead();f.store.load();assert.deepEqual(f.store.save(createWorld()),{ok:false,reason:'unread'});assert.equal(f.data.get('simclone:world:v1'),'original not yet read');});
