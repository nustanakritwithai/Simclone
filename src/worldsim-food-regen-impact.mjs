/** WM4.2 — read-only food-regeneration impact report.
 * No candidate unit mutation is proposed here. The report only measures how
 * WM3.4 ecology evidence is distributed across the legacy +3/120 food nodes.
 */
import {createResourceRegenerationShadow} from './worldsim-resource-regen-shadow.mjs?v=0.5.0';

export const FOOD_REGEN_IMPACT_VERSION='wm4.2-food-impact-1';
const bucket=p=>p<.04?'very-low':p<.08?'low':p<.12?'medium':'high';

export function createFoodRegenerationImpact(state,regen=createResourceRegenerationShadow(state)){
  const rows=regen.rows.filter(r=>r.type==='food').map(r=>Object.freeze({
    id:r.id,x:r.x,y:r.y,amount:r.amount,max:r.max,missing:r.missing,
    legacyPeriodTicks:r.legacyPeriodTicks,legacyAmount:r.legacyAmount,
    legacyIncrement:r.legacyIncrement,
    ecologyRegenerationPotential:r.ecologyRegenerationPotential,
    ecologyBand:bucket(r.ecologyRegenerationPotential),
    authoritativeWriter:r.authoritativeWriter
  }));
  const counts={'very-low':0,low:0,medium:0,high:0};
  let potential=0,missing=0,weightedPotential=0;
  for(const r of rows){
    counts[r.ecologyBand]++;potential+=r.ecologyRegenerationPotential;missing+=r.missing;
    weightedPotential+=r.ecologyRegenerationPotential*r.missing;
  }
  const sorted=[...rows].sort((a,b)=>b.ecologyRegenerationPotential-a.ecologyRegenerationPotential||a.id-b.id);
  const ascending=[...rows].sort((a,b)=>a.ecologyRegenerationPotential-b.ecologyRegenerationPotential||a.id-b.id);
  const median=ascending.length
    ? ascending.length%2
      ? ascending[(ascending.length-1)/2].ecologyRegenerationPotential
      : (ascending[ascending.length/2-1].ecologyRegenerationPotential+ascending[ascending.length/2].ecologyRegenerationPotential)/2
    : 0;
  return Object.freeze({
    version:FOOD_REGEN_IMPACT_VERSION,
    authority:Object.freeze({mode:'shadow-only',writer:regen.authority.writer,unitFormula:'none'}),
    legacy:Object.freeze({periodTicks:120,amount:3}),
    summary:Object.freeze({
      nodes:rows.length,
      averageEcologyPotential:rows.length?+(potential/rows.length).toFixed(4):0,
      medianEcologyPotential:+median.toFixed(4),
      minEcologyPotential:ascending.length?ascending[0].ecologyRegenerationPotential:0,
      maxEcologyPotential:sorted.length?sorted[0].ecologyRegenerationPotential:0,
      missingWeightedEcologyPotential:missing?+(weightedPotential/missing).toFixed(4):0,
      totalMissing:missing,
      bands:Object.freeze(counts)
    }),
    highest:Object.freeze(sorted.slice(0,8)),
    lowest:Object.freeze(sorted.slice(-8)),
    rows:Object.freeze(rows)
  });
}


/** Read-only integration evidence over the interval leading into a food boundary.
 * Sampling avoids binding a future gameplay formula to one instantaneous climate phase.
 */
export function createFoodRegenerationWindowImpact(state,{windowTicks=120,samples=5}={}){
  if(!Number.isInteger(state?.tick)||state.tick<0)throw new Error('Invalid food impact state tick');
  if(!Number.isInteger(windowTicks)||windowTicks<1||!Number.isInteger(samples)||samples<2||samples>25)
    throw new Error('Invalid food impact window');
  const end=state.tick,start=Math.max(0,end-windowTicks),ticks=[];
  for(let i=0;i<samples;i++)ticks.push(Math.round(start+(end-start)*i/(samples-1)));
  const snapshots=ticks.map(tick=>createFoodRegenerationImpact({...state,tick}));
  const byId=new Map();
  for(const snapshot of snapshots)for(const row of snapshot.rows){
    let acc=byId.get(row.id);
    if(!acc){acc={id:row.id,x:row.x,y:row.y,total:0,min:1,max:0,count:0};byId.set(row.id,acc);}
    const p=row.ecologyRegenerationPotential;
    acc.total+=p;acc.min=Math.min(acc.min,p);acc.max=Math.max(acc.max,p);acc.count++;
  }
  const rows=[...byId.values()].sort((a,b)=>a.id-b.id).map(acc=>Object.freeze({
    id:acc.id,x:acc.x,y:acc.y,
    windowEcologyPotential:+(acc.total/Math.max(1,acc.count)).toFixed(4),
    minEcologyPotential:+acc.min.toFixed(4),
    maxEcologyPotential:+acc.max.toFixed(4)
  }));
  const average=rows.length?rows.reduce((sum,r)=>sum+r.windowEcologyPotential,0)/rows.length:0;
  return Object.freeze({
    version:FOOD_REGEN_IMPACT_VERSION,
    authority:Object.freeze({
      mode:'shadow-only',
      writer:snapshots[0]?.authority?.writer??'worldsim-wm4.1',
      unitFormula:'none',
      aggregation:'window-average-observation'
    }),
    window:Object.freeze({startTick:start,endTick:end,sampleTicks:Object.freeze(ticks)}),
    summary:Object.freeze({
      nodes:rows.length,
      averageWindowEcologyPotential:+average.toFixed(4),
      minWindowEcologyPotential:rows.length?Math.min(...rows.map(r=>r.windowEcologyPotential)):0,
      maxWindowEcologyPotential:rows.length?Math.max(...rows.map(r=>r.windowEcologyPotential)):0
    }),
    rows:Object.freeze(rows)
  });
}
