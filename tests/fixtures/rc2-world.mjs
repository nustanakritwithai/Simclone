/** Validated scenario preparation only. Public proof still uses real UI/steps.
 * All recipes/quality/knowledge/structures below come from released authorities;
 * fixture positioning and starting resource balances are not gameplay claims.
 */
import assert from 'node:assert/strict';
import {createWorld,command,validate,walkable} from '../../src/engine.mjs';
import {advanceCraft,grantAdventureLoot} from '../../src/rust-possessions.mjs';
import {resourceStock} from '../../src/individual-resources.mjs';
import {personalHomeSite,homeOf} from '../../src/individual-housing.mjs';
import {canonicalEdge,canPlaceStation} from '../../src/rust-stations.mjs';

export function craftFixtureItem(s,a,recipeId){
  const accepted=command(s,'CRAFT_ITEM',{agentId:a.id,recipeId});assert.equal(accepted.ok,true,JSON.stringify(accepted));
  const order=s.rustPossessions.orders.find(o=>o.agentId===a.id);
  if(order.stationId!==null){const station=s.rustStations.stations.find(x=>x.id===order.stationId);a.x=station.x;a.y=station.y;}
  for(let i=0;i<order.required+2;i++){s.tick++;const result=advanceCraft(s,a.id);if(result.completed)return s.rustPossessions.items.find(x=>x.id===result.itemId);}
  throw new Error('RC2 fixture order did not complete');
}
export function craftFixtureTable(s,a){
  const item=craftFixtureItem(s,a,'CRAFTING_TABLE_LV1');
  const pos=[[1,0],[0,1],[-1,0],[0,-1]].map(([dx,dy])=>({x:a.x+dx,y:a.y+dy}))
    .find(p=>canPlaceStation(s,{agentId:a.id,itemInstanceId:item.id,...p},walkable,{actor:true}).ok);
  assert.ok(pos,'table site');const placed=command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:item.id,...pos});assert.equal(placed.ok,true,JSON.stringify(placed));
  a.x=pos.x;a.y=pos.y;return s.rustStations.stations.find(x=>x.id===placed.stationId);
}
export function craftFixtureHome(s,a){
  const hammer=craftFixtureItem(s,a,'HAMMER');assert.equal(command(s,'EQUIP_ITEM',{agentId:a.id,itemId:hammer.id}).ok,true);
  const site=personalHomeSite(s,a,walkable);assert.ok(site,'personal home site');const {x,y}=site.origin;a.x=x;a.y=y;
  for(const [kind,socket] of [['WOOD_FOUNDATION',{type:'cell',x,y}],['WOOD_WALL',canonicalEdge(x,y,'N')],
    ['WOOD_WALL',canonicalEdge(x,y,'E')],['WOOD_WALL',canonicalEdge(x,y,'W')],['WOOD_DOORWAY',canonicalEdge(x,y,'S')],['WOOD_ROOF',{type:'cell',x,y}]]){
    const item=craftFixtureItem(s,a,kind),r=command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:item.id,socket,placementId:'rc2-fixture:'+a.id+':'+item.id});
    assert.equal(r.ok,true,JSON.stringify(r));
  }
  assert.ok(homeOf(s,a.id,{completeOnly:true}));return hammer;
}
export function rc2World(){
  const s=createWorld(230926,{mode:'independent',worldProfile:'same-world',population:2});
  for(const a of s.agents){Object.assign(resourceStock(s,a),{wood:500,stone:500,food:500});a.hp=a.satiety=a.energy=100;a.task=null;craftFixtureTable(s,a);craftFixtureHome(s,a);}
  const [a,b]=s.agents;
  craftFixtureItem(s,a,'STONE_AXE');craftFixtureItem(s,a,'STONE_AXE');
  assert.equal(grantAdventureLoot(s,{agentId:a.id,claimKey:'rc2-browser-fixture-hide',items:[{itemKind:'HIDE',quantity:1,rarity:'COMMON'}]}).ok,true);
  craftFixtureItem(s,a,'HIDE_ARMOR');
  // Start near one another for the real teaching button, a few steps from A's table.
  const table=s.rustStations.stations.find(x=>x.placedBy===a.id&&x.kind==='CRAFTING_TABLE_LV1');
  const positions=[];for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++)if(Math.abs(dx)+Math.abs(dy)>=3&&walkable(s,table.x+dx,table.y+dy))positions.push({x:table.x+dx,y:table.y+dy});
  const pos=positions.find(p=>walkable(s,p.x+1,p.y));assert.ok(pos);a.x=pos.x;a.y=pos.y;b.x=pos.x+1;b.y=pos.y;
  for(const person of s.agents){person.task=null;person.hp=person.satiety=person.energy=100;}
  const errors=validate(s);assert.deepEqual(errors,[]);return s;
}
