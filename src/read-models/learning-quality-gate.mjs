/** CV2 — read-only evidence quality gate for future adaptive learning. */
import {predictionCalibrationSnapshot} from './prediction-calibration.mjs';

export const LEARNING_QUALITY_VERSION='CV2-0.1';
export const LEARNING_QUALITY_RULES=Object.freeze({
  minLinkedSamples:2,
  maxConflicts:0,
  maxLinkedUnknownOutcomes:0
});

const freeze=x=>Object.freeze(x);

export function learningQualitySnapshot(state,agentId){
  const calibration=predictionCalibrationSnapshot(state,agentId);
  if(!calibration)return null;
  const linkedUnknownCount=calibration.linked.filter(x=>!['SAT','VIOL'].includes(x.outcome)).length;
  let status='UNKNOWN',reason='insufficient-evidence';
  if(calibration.conflictCount>LEARNING_QUALITY_RULES.maxConflicts){
    status='VIOL';reason='evidence-conflict';
  }else if(calibration.linkedSampleCount<LEARNING_QUALITY_RULES.minLinkedSamples){
    status='UNKNOWN';reason=calibration.evidence==='RECEIPTS_MISSING'?'receipts-missing':'insufficient-linked-samples';
  }else if(linkedUnknownCount>LEARNING_QUALITY_RULES.maxLinkedUnknownOutcomes){
    status='UNKNOWN';reason='unresolved-linked-outcome';
  }else{
    status='SAT';reason='clean-linked-evidence';
  }
  return freeze({
    version:LEARNING_QUALITY_VERSION,
    agentId:calibration.agentId,
    status,
    reason,
    linkedSampleCount:calibration.linkedSampleCount,
    unlinkedOutcomeCount:calibration.unlinkedOutcomeCount,
    conflictCount:calibration.conflictCount,
    linkedUnknownCount,
    calibrationEvidence:calibration.evidence,
    thresholds:LEARNING_QUALITY_RULES
  });
}
