import {adventureProgressionSnapshot} from './adventure-progression.mjs?v=0.5.0';
import {ADVENTURE_ZONES,canEnterAdventureZone,adventureZoneById} from './adventure-zones.mjs?v=0.5.0';
import {monsterDefinition} from './adventure-monsters.mjs?v=0.5.0';
import {itemById} from './crafting-catalog.mjs?v=0.5.0';
import {equipmentSlotOf} from './rust-possessions.mjs?v=0.5.0';

export const ADVENTURE_UI_VERSION='adventure-ui/v1';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const pct=(value,max)=>max>0?Math.max(0,Math.min(100,Math.round(value/max*100))):0;
const professionLabel=profession=>profession==='adventurer'?'นักผจญภัย':({forager:'คนหาอาหาร',woodcutter:'คนตัดไม้',miner:'คนขุดแร่',builder:'ช่างก่อสร้าง'}[profession]??'ยังไม่มีอาชีพ');
const slotLabel=slot=>({WEAPON:'อาวุธ',ARMOR:'เกราะ',ACCESSORY:'เครื่องประดับ'}[slot]??slot);

function qualification(agent){
  const accepted=Number.isInteger(agent?.adventurerQualification?.accepted)?agent.adventurerQualification.accepted:0;
  return Math.max(0,Math.min(3,accepted));
}
function progression(agent){
  try{return adventureProgressionSnapshot(agent);}catch{return null;}
}
function gearRows(state,agentId){
  const equipment={WEAPON:null,ARMOR:null,ACCESSORY:null};
  for(const row of state.rustPossessions?.equipment??[]){
    if(row.agentId!==agentId)continue;
    const slot=equipmentSlotOf(row);
    if(Object.hasOwn(equipment,slot))equipment[slot]=row.itemId;
  }
  const items=state.rustPossessions?.items??[];
  return Object.entries(equipment).map(([slot,itemId])=>{
    const item=itemId===null?null:items.find(i=>i.id===itemId);
    const def=item&&itemById(item.kind);
    return {slot,itemId,item,def};
  });
}
function bagGear(state,agentId){
  return (state.rustPossessions?.items??[]).filter(i=>i.location?.kind==='bag'&&i.location.agentId===agentId&&itemById(i.kind)?.category==='gear');
}
function activeAgent(state,selected){
  const living=(state.agents??[]).filter(a=>a.alive);
  const selectedAgent=living.find(a=>a.id===selected);
  return living.find(a=>a.adventureCombat)||living.find(a=>a.adventureEncounter)||
    living.find(a=>a.task?.adventureExpedition)||selectedAgent?.profession==='adventurer'&&selectedAgent||
    living.find(a=>a.profession==='adventurer')||selectedAgent||living[0]||null;
}
function monsterLabel(monsterId){
  const def=monsterDefinition(monsterId);
  return def?def.speciesId+' · '+monsterId:String(monsterId??'Unknown');
}

export function installAdventureUI({read,openDialog,closeDialog,execute,select,center,toast,save}){
  const stage=document.getElementById('stage');
  if(!stage)throw new Error('Adventure UI requires #stage');
  let launch=document.getElementById('adventure-launch');
  if(!launch){
    launch=document.createElement('button');launch.id='adventure-launch';launch.type='button';launch.className='adventure-launch';
    launch.innerHTML='<b aria-hidden="true">⚔</b><span>ผจญภัย</span><small>ADVENTURE</small>';
    launch.setAttribute('aria-label','เปิดโลกนักผจญภัย');stage.appendChild(launch);
  }
  let hud=document.getElementById('adventure-hud');
  if(!hud){
    hud=document.createElement('aside');hud.id='adventure-hud';hud.className='adventure-hud';hud.hidden=true;hud.setAttribute('aria-live','polite');stage.appendChild(hud);
  }

  function currentAgent(preferredId=null){
    const {state,selected}=read();
    return state.agents.find(a=>a.alive&&a.id===preferredId)??activeAgent(state,selected);
  }
  function renderGear(state,agent){
    const rows=gearRows(state,agent.id);
    const equipped=rows.map(row=>'<div class="adv-gear-slot"><span>'+esc(slotLabel(row.slot))+'</span><b>'+esc(row.def?.name??'—')+'</b>'+
      (row.item?'<button type="button" data-adv-action="unequip-gear" data-agent="'+agent.id+'" data-slot="'+row.slot+'">ถอด</button>':'')+'</div>').join('');
    const equippedIds=new Set(rows.map(r=>r.itemId).filter(Number.isSafeInteger));
    const spare=bagGear(state,agent.id).filter(i=>!equippedIds.has(i.id)).map(item=>{
      const def=itemById(item.kind);return '<button type="button" class="adv-gear-card" data-adv-action="equip-gear" data-agent="'+agent.id+'" data-item="'+item.id+'"><b>'+esc(def?.name??item.kind)+'</b><small>'+esc(def?.equipSlot??'GEAR')+' · +'+(item.upgradeLevel??0)+'</small></button>';
    }).join('');
    return '<section class="adv-panel-section"><h3>Equipment</h3><div class="adv-gear-grid">'+equipped+'</div>'+(spare?'<div class="adv-spare-gear">'+spare+'</div>':'<small class="adv-muted">ยังไม่มี gear ที่ไม่ได้สวมในกระเป๋า</small>')+'</section>';
  }
  function agentPanel(agent){
    const {state}=read(),p=progression(agent),q=qualification(agent),isAdv=agent.profession==='adventurer';
    const busy=Boolean(agent.task||agent.adventureEncounter||agent.adventureCombat);
    const zones=ADVENTURE_ZONES.map(zone=>{
      const unlocked=Boolean(p&&canEnterAdventureZone(zone.zoneId,p.level));
      const disabled=!isAdv||!unlocked||busy||agent.hp<=0;
      return '<button type="button" class="adv-zone-card '+(unlocked?'unlocked':'locked')+'" data-adv-action="start-expedition" data-agent="'+agent.id+'" data-zone="'+zone.zoneId+'" '+(disabled?'disabled':'')+'>'+
        '<span>'+esc(zone.zoneId.toUpperCase())+'</span><b>'+esc(zone.name)+'</b><small>Lv.'+zone.minLevel+'–'+zone.maxLevel+(unlocked?' · เข้าได้':' · ยังล็อก')+'</small></button>';
    }).join('');
    const status=agent.adventureCombat?'Combat · '+agent.adventureCombat.status:agent.adventureEncounter?'Encounter พร้อมต่อสู้':agent.task?.adventureExpedition?'กำลังเดินทาง '+agent.task.adventureExpedition.zoneId:(busy?'กำลังทำ '+esc(agent.task?.kind??'งาน'):'พร้อม');
    return '<article class="adv-profile" data-adv-profile="'+agent.id+'">'+
      '<div class="adv-profile-head"><div><span class="adv-kicker">'+esc(professionLabel(agent.profession))+'</span><h2>'+esc(agent.name)+'</h2><small>'+esc(status)+'</small></div><div class="adv-level"><small>LEVEL</small><b>'+(p?.level??1)+'</b></div></div>'+
      '<div class="adv-stats"><span><small>HP</small><b>'+Math.round(agent.hp)+'</b></span><span><small>XP</small><b>'+(p?.xp??0)+'</b></span><span><small>EXPLORE</small><b>'+q+'/3</b></span></div>'+
      (!isAdv?'<div class="adv-notice">ต้องจบ EXPLORE จริง 3 ครั้งก่อน ออกเดินอย่างเดียวหรือผล UNKNOWN ไม่นับ</div>':'')+
      '<section class="adv-panel-section"><h3>Khet Sila</h3><div class="adv-zone-grid">'+zones+'</div></section>'+
      renderGear(state,agent)+
      '<div class="adv-panel-actions"><button type="button" data-adv-action="focus-agent" data-agent="'+agent.id+'">ดู Clone ในโลก</button></div>'+
      '</article>';
  }
  function open(agentId=null){
    const {state}=read(),living=(state.agents??[]).filter(a=>a.alive);
    const agent=currentAgent(agentId);
    const roster=living.map(a=>'<button type="button" class="adv-roster-card '+(a.id===agent?.id?'active':'')+'" data-adv-action="open-agent" data-agent="'+a.id+'">'+
      '<b>'+esc(a.name)+'</b><small>'+esc(professionLabel(a.profession))+' · EXPLORE '+qualification(a)+'/3</small></button>').join('');
    openDialog('โลกนักผจญภัย','ADVENTURE · LIVE',
      '<section class="adv-dialog"><div class="adv-roster">'+roster+'</div>'+(agent?agentPanel(agent):'<div class="adv-notice">ยังไม่มี Clone ที่มีชีวิต</div>')+'</section>');
  }
  function run(type,data,{close=false,success=null}={}){
    const result=execute(type,data);
    if(!result?.ok){toast(result?.message??result?.reason??'คำสั่ง Adventure ใช้ไม่ได้');return result;}
    if(success)toast(success(result));
    save?.();
    if(close)closeDialog();
    return result;
  }
  function onClick(event){
    const button=event.target.closest('[data-adv-action]');if(!button)return;
    const action=button.dataset.advAction,agentId=Number(button.dataset.agent);
    if(action==='open'){open();return;}
    if(action==='open-agent'){open(agentId);return;}
    if(action==='focus-agent'){closeDialog();select(agentId,true);center?.();return;}
    if(action==='start-expedition'){
      const r=run('START_ADVENTURE_EXPEDITION',{agentId,zoneId:button.dataset.zone},{close:true,success:x=>'ออกเดินทาง '+String(x.zoneId).toUpperCase()+' · '+x.pathLength+' ช่อง'});
      if(r?.ok){select(agentId,true);center?.();}
      return;
    }
    if(action==='start-combat'){run('START_ADVENTURE_COMBAT',{agentId},{success:()=> 'เริ่มต่อสู้'});return;}
    if(action==='attack'){
      const agent=currentAgent(agentId);const turn=agent?.adventureCombat?.turn;
      if(!Number.isSafeInteger(turn)){toast('combat turn ไม่พร้อม');return;}
      run('ADVENTURE_COMBAT_ACTION',{agentId,action:'BASIC_ATTACK',expectedTurn:turn},{success:r=>r.status==='ACTIVE'?'โจมตี · Turn '+r.turn:r.status==='VICTORY'?'ชนะ · +'+r.xpAwarded+' XP':'พ่ายแพ้'});return;
    }
    if(action==='claim-loot'){run('CLAIM_ADVENTURE_LOOT',{agentId},{success:r=>r.changed?'รับ loot '+r.itemIds.length+' ชิ้น':'loot ชุดนี้รับแล้ว'});return;}
    if(action==='equip-gear'){run('EQUIP_ADVENTURE_GEAR',{agentId,itemId:Number(button.dataset.item)},{success:()=> 'สวมอุปกรณ์แล้ว'});open(agentId);return;}
    if(action==='unequip-gear'){run('UNEQUIP_ADVENTURE_GEAR',{agentId,slot:button.dataset.slot},{success:()=> 'ถอดอุปกรณ์แล้ว'});open(agentId);return;}
  }
  function renderHud(){
    const {state,selected}=read(),agent=activeAgent(state,selected),task=agent?.task?.adventureExpedition,encounter=agent?.adventureEncounter,combat=agent?.adventureCombat;
    const active=Boolean(agent&&(task||encounter||combat));
    hud.hidden=!active;if(!active){hud.innerHTML='';return;}
    let body='';
    if(task){
      const zone=adventureZoneById(task.zoneId);
      body='<div class="adv-hud-title"><span>EXPEDITION</span><b>'+esc(zone.name)+'</b></div>'+
        '<p>'+esc(agent.name)+' กำลังเดินทาง · เหลือ '+agent.task.path.length+' ช่อง</p>'+
        '<div class="adv-mini-row"><span>HP '+Math.round(agent.hp)+'</span><span>Lv.'+(progression(agent)?.level??1)+'</span></div>';
    }else if(encounter){
      const def=monsterDefinition(encounter.monsterId);
      body='<div class="adv-hud-title"><span>ENCOUNTER</span><b>'+esc(monsterLabel(encounter.monsterId))+'</b></div>'+
        '<p>'+esc(def?.types?.join('/')??'Wild')+' · Lv.'+encounter.monsterLevel+' · '+esc(encounter.rank)+'</p>'+
        '<button type="button" class="adv-primary" data-adv-action="start-combat" data-agent="'+agent.id+'">เริ่มต่อสู้</button>';
    }else if(combat?.status==='ACTIVE'){
      const monsterPct=pct(combat.monsterHpCurrent,combat.monsterHpMax);
      body='<div class="adv-hud-title"><span>COMBAT · TURN '+combat.turn+'</span><b>'+esc(monsterLabel(combat.monsterId))+'</b></div>'+
        '<div class="adv-health"><label>Clone HP <b>'+Math.round(agent.hp)+'</b></label><i><em style="width:'+pct(agent.hp,100)+'%"></em></i></div>'+
        '<div class="adv-health monster"><label>Monster HP <b>'+combat.monsterHpCurrent+' / '+combat.monsterHpMax+'</b></label><i><em style="width:'+monsterPct+'%"></em></i></div>'+
        '<button type="button" class="adv-primary" data-adv-action="attack" data-agent="'+agent.id+'">Attack</button>';
    }else if(combat?.status==='VICTORY'){
      const def=monsterDefinition(combat.monsterId),fire=def?.types?.[0]==='Fire',claim=combat.lootClaim;
      body='<div class="adv-hud-title"><span>VICTORY</span><b>'+esc(monsterLabel(combat.monsterId))+'</b></div>'+
        '<p>Adventure XP +'+(combat.reward?.xpAward??0)+'</p>'+
        (claim?'<div class="adv-loot-done">Loot '+claim.itemIds.length+' ชิ้น · กระเป๋า '+claim.bagged+' · ตกพื้น '+claim.dropped+'</div>':
          fire?'<button type="button" class="adv-primary" data-adv-action="claim-loot" data-agent="'+agent.id+'">รับ Loot</button>':'<div class="adv-notice compact">Loot profile ของธาตุนี้ยังไม่เปิดใน V1</div>');
    }else if(combat?.status==='DEFEATED'){
      body='<div class="adv-hud-title"><span>DEFEATED</span><b>'+esc(agent.name)+'</b></div><p>HP คงไว้ที่ 1 · ระบบ Return/Recovery จะเปิดใน gate ถัดไป</p>';
    }
    hud.innerHTML='<div class="adv-hud-top"><button type="button" data-adv-action="open" aria-label="เปิดรายละเอียด Adventure">⚔</button></div>'+body;
  }
  function update(){
    const {state}=read();
    launch.hidden=state?.worldMode?.kind!=='independent';
    if(!launch.hidden){
      const living=(state.agents??[]).filter(a=>a.alive),adventurers=living.filter(a=>a.profession==='adventurer').length;
      launch.dataset.adventurers=String(adventurers);
      launch.querySelector('small').textContent=adventurers?adventurers+' ADVENTURER':'ADVENTURE';
    }
    renderHud();
  }

  launch.addEventListener('click',()=>open());
  document.addEventListener('click',onClick);
  update();
  return Object.freeze({version:ADVENTURE_UI_VERSION,update,open});
}
