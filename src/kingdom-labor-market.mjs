/** Kingdom Sandbox LaborMarketSystem extraction K4.
 * Generates read-only labor-offer proposals from K2 scarcity and K3 staffing.
 * No profession changes, recruitment state, movement, rewards, clocks or randomness.
 */
export const KINGDOM_LABOR_VERSION='K4-shadow-0.1';
export const LABOR_OFFER_CAP=4;
const ROLE_GOOD=Object.freeze({woodcutter:'wood',miner:'stone',builder:'building'});
const ROLE_LABEL=Object.freeze({woodcutter:'คนตัดไม้',miner:'คนขุดหิน',builder:'ช่างก่อสร้าง'});
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));

export function laborOfferCandidate(role,{economy,production}={}){
  const row=production?.roles?.[role];
  if(!row||!ROLE_GOOD[role])return null;
  const good=ROLE_GOOD[role];
  const scarcity=good==='building'
    ? (row.laborGap>0?1.5:0.25)
    : Number(economy?.scarcity?.[good]??0.25);
  const premium=Number(economy?.premium?.[role]??1);
  const gap=Math.max(0,Number(row.laborGap)||0);
  // Donor opens labor offers when shortage > 1.2. Adapt that threshold to the single Simclone settlement.
  if(scarcity<=1.2||gap<=0)return null;
  const quantityNeeded=Math.min(3,Math.max(1,gap));
  const priority=+(
    (scarcity-1)*40+
    (premium-1)*100+
    gap*4+
    (row.workers===0?25:0)
  ).toFixed(2);
  return {
    type:'labor_offer_'+role,
    role,label:ROLE_LABEL[role],good,
    scarcity:+scarcity.toFixed(3),premium:+premium.toFixed(3),
    workers:row.workers,ideal:row.ideal,gap,quantityNeeded,
    priority,
    urgency:priority>=80?'critical':priority>=45?'high':'normal',
    reach:'local',
    authoritative:false,
  };
}

export function kingdomLaborMarketSnapshot({economy=null,production=null}={}){
  const offers=['woodcutter','miner','builder']
    .map(role=>laborOfferCandidate(role,{economy,production}))
    .filter(Boolean)
    .sort((a,b)=>b.priority-a.priority||a.role.localeCompare(b.role))
    .slice(0,LABOR_OFFER_CAP);
  return {
    version:KINGDOM_LABOR_VERSION,
    mode:'shadow',
    offers,
    activeCount:offers.length,
    topOffer:offers[0]??null,
    hasCritical:offers.some(o=>o.urgency==='critical'),
  };
}
