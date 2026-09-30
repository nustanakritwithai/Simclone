import test from 'node:test';
import assert from 'node:assert/strict';

import {createWorld,serialize,restore,day,hour} from '../src/engine.mjs?v=0.5.0';
import {getBalance} from '../src/currency-wallet.mjs?v=0.5.0';
import {hasRc4PurchaseNeed,rc4PersonalItemNeeds} from '../src/rc4-market-observation.mjs?v=0.5.0';

test('playtest #4: seed 230926 Tao has no canonical STONE_AXE purchase need',()=>{
  const world=createWorld(230926,{mode:'independent',worldProfile:'same-world'});
  const tao=world.agents.find(a=>a.name==='Tao');
  const lume=world.agents.find(a=>a.name==='Lume');
  assert.ok(tao);
  assert.ok(lume);
  assert.equal(tao.preference,'FORAGE');
  assert.equal(getBalance(world,tao.id),100);
  assert.equal(rc4PersonalItemNeeds(world,tao).some(n=>n.itemKind==='STONE_AXE'),false);
  assert.equal(hasRc4PurchaseNeed(world,tao,{itemKind:'STONE_AXE',buyOfferId:null}),false);

  // Control: the same item is a real need for the canonical WOODCUT preference.
  assert.equal(lume.preference,'WOODCUT');
  assert.equal(rc4PersonalItemNeeds(world,lume).some(n=>n.itemKind==='STONE_AXE'),true);
  assert.equal(hasRc4PurchaseNeed(world,lume,{itemKind:'STONE_AXE',buyOfferId:null}),true);
});

test('playtest #5: canonical serialize/restore preserves tick and authority roots exactly',()=>{
  const world=createWorld(230926,{mode:'independent',worldProfile:'same-world'});
  const text=serialize(world);
  const saved=JSON.parse(text);
  const loaded=restore(text,{sameWorld:true});

  assert.equal(loaded.tick,saved.tick);
  assert.equal(day(loaded),day(saved));
  assert.equal(hour(loaded),hour(saved));
  assert.deepEqual(loaded.agents.map(a=>({id:a.id,profession:a.profession,adventure:a.skills.ADVENTURE})),
                   saved.agents.map(a=>({id:a.id,profession:a.profession,adventure:a.skills.ADVENTURE})));
  assert.deepEqual(loaded.currencyWallet,saved.currencyWallet);
  assert.deepEqual(loaded.rustPossessions.items,saved.rustPossessions.items);
  assert.deepEqual(loaded.homeMarkets,saved.homeMarkets);
  assert.deepEqual(loaded.merchantListings,saved.merchantListings);
});
