/** Isolated Career positive-control fixture. Test adapters are not full-RC4 acceptance.
 * Unlike a hand-authored VERIFIED flag, progression is executed inside real Trade/ Ledger calls.
 */
import {settleTradeAtomic,createTradeReplayState} from '../../src/trade-kernel.mjs?v=0.5.0';
import {createMerchantLedger,applyCanonicalTradeExecutionToLedger} from '../../src/merchant-ledger.mjs?v=0.5.0';
import {noteVerifiedCommittedMerchantTransaction} from '../../src/merchant-career.mjs?v=0.5.0';
const worlds=new WeakMap();
export function progressThroughCanonicalTrade(agent,evidence){
  const r=evidence.receipt;
  if(evidence.duplicate||![r.buyerId,r.sellerId].includes(agent.id))return noteVerifiedCommittedMerchantTransaction(agent,evidence);
  let s=worlds.get(agent);
  if(!s)s={agents:[],testWallet:{},testItems:[],tradeReplay:createTradeReplayState(),testLedgers:[]};
  const people=new Set([agent.id,r.buyerId,r.sellerId]);
  for(const id of people){
    if(!s.agents.some(a=>a.id===id))s.agents.push({id,alive:true,x:0,y:0});
    if(s.testWallet[id]===undefined)s.testWallet[id]=100000;
  }
  Object.assign(s.agents.find(a=>a.id===agent.id),structuredClone(agent),{alive:true,x:0,y:0});
  s.testItems=s.testItems.filter(i=>i.id!==r.itemInstanceId);
  s.testItems.push({id:r.itemInstanceId,kind:r.itemKind,agentId:r.sellerId});
  const p={...r};delete p.itemIds;delete p.fingerprint;delete p.integrityFingerprint;delete p.eventId;
  const listing={id:r.listingId,marketId:r.marketId,revision:1,status:'OPEN',sellerId:r.sellerId,itemKind:r.itemKind,quantity:1,unitPrice:r.unitPrice};
  const reservation={id:r.reservationId,marketId:r.marketId,listingId:r.listingId,listingRevision:1,status:'ACTIVE',buyerId:r.buyerId,sellerId:r.sellerId,itemKind:r.itemKind,quantity:1,unitPrice:r.unitPrice,itemIds:r.itemIds};
  let progress;
  const result=settleTradeAtomic(s,p,{
    wallet:{balance:(w,id)=>w.testWallet[id],debit:(w,id,n)=>(w.testWallet[id]-=n,true),credit:(w,id,n)=>(w.testWallet[id]+=n,true)},
    item:{tradableItemIds:(w,{agentId,itemKind})=>w.testItems.filter(i=>i.agentId===agentId&&i.kind===itemKind).map(i=>i.id),transfer:(w,{itemIds,toAgentId})=>{for(const i of w.testItems)if(itemIds.includes(i.id))i.agentId=toAgentId;return true;}},
    market:{market:()=>({id:r.marketId,open:true,x:0,y:0,tradeRange:1}),listing:()=>listing,reservation:()=>reservation,activeReservations:()=>[reservation]},
    postSettlement:{apply:(w,c)=>{
      let ledger=w.testLedgers.find(x=>x.merchantId===agent.id)??createMerchantLedger(agent.id);
      // A historical acquisition fixture establishes seller basis; it is not a sale-item mint.
      if(r.sellerId===agent.id&&!ledger.purchases.some(x=>x.remainingItemIds.includes(r.itemInstanceId)))ledger.purchases.push({
        transactionId:'basis:'+r.transactionId,marketId:r.marketId,itemKind:r.itemKind,itemIds:r.itemIds,remainingItemIds:r.itemIds,
        quantity:1,unitPrice:r.unitPrice,totalPrice:r.unitPrice,listingId:'basis:'+r.listingId,reservationId:'basis:'+r.reservationId});
      const applied=applyCanonicalTradeExecutionToLedger(ledger,w,c);
      if(applied.state!=='SAT')return {ok:false,reason:applied.reason};
      w.testLedgers=w.testLedgers.filter(x=>x.merchantId!==agent.id);w.testLedgers.push(applied.ledger);
      progress=noteVerifiedCommittedMerchantTransaction(w.agents.find(a=>a.id===agent.id),applied);
      return {ok:progress.status==='SAT'};
    },verify:()=>true}
  });
  if(!result.ok)throw new Error('Career fixture real settlement: '+JSON.stringify(result));
  worlds.set(agent,result.state);Object.assign(agent,result.state.agents.find(a=>a.id===agent.id));
  return progress;
}
