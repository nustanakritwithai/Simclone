/** VAL6 — bounded deterministic learning authority from retained productive outcomes. */
import {isIndependent} from './individual-resources.mjs?v=0.5.0';
import {productiveOutcomeEvidenceSnapshot,terminalOutcomeEvidenceState} from './outcome-learning-evidence.mjs?v=0.5.0';

export const OUTCOME_LEARNING_AUTHORITY_VERSION='VAL6-0.1';
export const MAX_OUTCOME_LEARNING_BONUS=4;

const SUPPORTED=new Set(['FORAGE','WOODCUT','MINE','BUILD']);
const freeze=x=>Object.freeze(x);

function result(kind,reason,row=null,bonus=0){
  return freeze({
    version:OUTCOME_LEARNING_AUTHORITY_VERSION,
    active:bonus>0,
    bonus,
    reason,
    kind:String(kind??'UNKNOWN'),
    sampleCount:Number(row?.sampleCount??0),
    satCount:Number(row?.satCount??0),
    violCount:Number(row?.violCount??0),
    unknownCount:Number(row?.unknownCount??0),
    totalAmount:Number(row?.totalAmount??0)
  });
}

export function outcomeLearningSignal(state,agent,kind,{emergency=false}={}){
  if(!isIndependent(state))return result(kind,'legacy');
  if(!SUPPORTED.has(kind))return result(kind,'unsupported-kind');
  if(emergency)return result(kind,'survival-emergency');

  const evidence=productiveOutcomeEvidenceSnapshot(agent);
  const row=evidence.byKind.find(x=>x.kind===kind)??null;
  if(!row||row.sampleCount<2)return result(kind,'insufficient-evidence',row);

  const terminal=terminalOutcomeEvidenceState(agent);
  if(terminal.evidence==='EVIDENCE_CONFLICT')return result(kind,'evidence-conflict',row);
  if(row.violCount>0)return result(kind,'violation-evidence',row);
  if(row.unknownCount>0)return result(kind,'unknown-evidence',row);
  if(row.satCount!==row.sampleCount||row.totalAmount<=0)return result(kind,'not-all-productive-sat',row);

  const bonus=Math.min(MAX_OUTCOME_LEARNING_BONUS,row.satCount);
  return result(kind,'repeated-productive-sat',row,bonus);
}
