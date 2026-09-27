/** Shared pure retained-outcome evidence for VAL5 read model and VAL6 authority. */
export const PRODUCTIVE_OUTCOME_KINDS=Object.freeze(['FORAGE','WOODCUT','MINE','BUILD']);

const PRODUCTIVE_SET=new Set(PRODUCTIVE_OUTCOME_KINDS);
const freeze=x=>Object.freeze(x);
const sameTarget=(a,b)=>(a??null)===(b??null);

function retainedOutcomes(agent){
  const lessons=Array.isArray(agent?.planning?.lessons)?agent.planning.lessons:[];
  return freeze(lessons
    .filter(l=>PRODUCTIVE_SET.has(l?.kind))
    .map(l=>freeze({
      tick:Number.isSafeInteger(l.tick)?l.tick:null,
      kind:String(l.kind),
      targetId:Number.isSafeInteger(l.targetId)?l.targetId:null,
      outcome:String(l.outcome??'UNKNOWN'),
      amount:Number.isFinite(l.amount)?l.amount:null
    })));
}

function aggregate(samples){
  const result=[];
  for(const kind of PRODUCTIVE_OUTCOME_KINDS){
    const xs=samples.filter(x=>x.kind===kind);
    if(!xs.length)continue;
    result.push(freeze({
      kind,
      sampleCount:xs.length,
      satCount:xs.filter(x=>x.outcome==='SAT').length,
      violCount:xs.filter(x=>x.outcome==='VIOL').length,
      unknownCount:xs.filter(x=>!['SAT','VIOL'].includes(x.outcome)).length,
      totalAmount:xs.reduce((sum,x)=>sum+(Number.isFinite(x.amount)?x.amount:0),0),
      lastTick:xs.reduce((max,x)=>Number.isSafeInteger(x.tick)?Math.max(max,x.tick):max,-1)
    }));
  }
  return freeze(result);
}

export function productiveOutcomeEvidenceSnapshot(agent){
  const outcomes=retainedOutcomes(agent);
  return freeze({outcomes,byKind:aggregate(outcomes)});
}

export function terminalOutcomeEvidenceState(agent){
  const plan=agent?.planning?.goal??null;
  const isVal2=plan?.planVersion==='VAL2-0.1'&&typeof plan?.planId==='string'&&plan?.step;
  if(!isVal2||!PRODUCTIVE_SET.has(plan.kind)||!['completed','failed'].includes(plan.status))
    return freeze({evidence:'NOT_TERMINAL_OR_OUT_OF_SCOPE'});

  const lessons=Array.isArray(agent?.planning?.lessons)?agent.planning.lessons:[];
  let lesson=null;
  for(let i=lessons.length-1;i>=0;i--){
    const row=lessons[i];
    if(row?.tick===plan.updatedTick&&row?.kind===plan.kind&&sameTarget(row?.targetId,plan.targetId)){lesson=row;break;}
  }
  if(!lesson)return freeze({evidence:'OUTCOME_UNKNOWN'});

  const verifiedSat=plan.status==='completed'&&
    plan.outcome==='SAT:productive-outcome'&&
    lesson.outcome==='SAT'&&
    Number.isFinite(lesson.amount)&&lesson.amount>0;

  const verifiedViol=plan.status==='failed'&&
    plan.outcome==='VIOL:replan-budget-exhausted'&&
    Number.isInteger(plan.attempt)&&plan.attempt===plan.maxReplans&&
    lesson.outcome==='VIOL'&&
    lesson.amount===0;

  return freeze({evidence:(verifiedSat||verifiedViol)?'VERIFIED':'EVIDENCE_CONFLICT'});
}


export function receiptBackedFailureEvidence(agent,kind){
  const plan=agent?.planning?.goal??null;
  if(!plan||plan.planVersion!=='VAL2-0.1'||plan.kind!==kind||plan.status!=='failed'||
    plan.outcome!=='VIOL:replan-budget-exhausted'||!Number.isInteger(plan.attempt)||plan.attempt!==plan.maxReplans)
    return freeze({evidence:'NO_VERIFIED_TERMINAL_VIOL'});

  const lessons=Array.isArray(agent?.planning?.lessons)?agent.planning.lessons:[];
  let lesson=null;
  for(let i=lessons.length-1;i>=0;i--){
    const row=lessons[i];
    if(row?.tick===plan.updatedTick&&row?.kind===plan.kind&&sameTarget(row?.targetId,plan.targetId)){lesson=row;break;}
  }
  if(!lesson||lesson.outcome!=='VIOL'||lesson.amount!==0||lesson.planId!==plan.planId)
    return freeze({evidence:'TERMINAL_LESSON_UNLINKED'});

  const receipts=Array.isArray(agent?.planning?.predictions)?agent.planning.predictions:[];
  let receipt=null;
  for(let i=receipts.length-1;i>=0;i--){
    const row=receipts[i];
    if(row?.planId===plan.planId&&row?.taskKind===kind&&sameTarget(row?.targetId,plan.targetId)&&row.tick<=lesson.tick){receipt=row;break;}
  }
  if(!receipt)return freeze({evidence:'PREDICTION_RECEIPT_MISSING'});
  if(receipt.interruptionNow!==null||receipt.traceSource!=='agent.trace:selected')
    return freeze({evidence:'RECEIPT_NOT_CAUSAL_ELIGIBLE',receiptId:receipt.receiptId});

  return freeze({
    evidence:'RECEIPT_BACKED_VIOL',
    planId:plan.planId,
    receiptId:receipt.receiptId,
    lessonTick:lesson.tick,
    receiptTick:receipt.tick
  });
}
