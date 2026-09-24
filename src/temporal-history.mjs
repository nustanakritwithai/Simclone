/**
 * Simclone Temporal History Adapter — V0.1 proof.
 *
 * Architecture adapted from TestGE's checkpoint/rollback/replay contract,
 * but deliberately works through Simclone's canonical serialize/restore boundary.
 * It does not rewrite engine rules and it never touches browser persistence.
 */

function fnv1a(text){
  let h=2166136261>>>0;
  for(let i=0;i<text.length;i++){
    h^=text.charCodeAt(i);
    h=Math.imul(h,16777619);
  }
  return (h>>>0).toString(16).padStart(8,'0');
}

function copyPayload(payload){
  if(payload===undefined)return {};
  return JSON.parse(JSON.stringify(payload));
}

export function createTemporalHistory({
  world,
  serialize,
  restore,
  validate,
  step,
  command,
  maxCheckpoints=16,
  maxJournalEntries=4096
}={}){
  if(!world||typeof serialize!=='function'||typeof restore!=='function'||
     typeof validate!=='function'||typeof step!=='function'||typeof command!=='function')
    throw new Error('TemporalHistory requires world + serialize/restore/validate/step/command hooks');
  if(!Number.isInteger(maxCheckpoints)||maxCheckpoints<1||maxCheckpoints>256)
    throw new Error('Invalid maxCheckpoints');
  if(!Number.isInteger(maxJournalEntries)||maxJournalEntries<1||maxJournalEntries>100000)
    throw new Error('Invalid maxJournalEntries');

  let current=world;
  let nextCheckpointId=1;
  let nextSequence=1;
  const checkpoints=[];
  const journal=[];

  const canonical=()=>serialize(current);
  const hashState=text=>fnv1a(text??canonical());

  function assertValid(candidate){
    const errors=validate(candidate);
    if(errors.length)throw new Error('TemporalHistory invalid world: '+errors.join(', '));
  }

  function prune(){
    while(checkpoints.length>maxCheckpoints)checkpoints.shift();
    const oldestTick=checkpoints.length?checkpoints[0].tick:current.tick;
    while(journal.length>maxJournalEntries)journal.shift();
    while(journal.length&&journal[0].tick<oldestTick)journal.shift();
  }

  function checkpoint(label=`tick-${current.tick}`){
    assertValid(current);
    const state=canonical();
    const cp={
      id:nextCheckpointId++,
      label:String(label),
      tick:current.tick,
      engineVersion:current.version??null,
      historyVersion:current.historyVersion??null,
      archiveVersion:current.archiveVersion??null,
      hash:hashState(state),
      state
    };
    checkpoints.push(cp);
    prune();
    return {...cp,state:undefined};
  }

  function findCheckpoint(idOrLabel){
    const cp=typeof idOrLabel==='number'
      ?checkpoints.find(x=>x.id===idOrLabel)
      :checkpoints.findLast?.(x=>x.label===idOrLabel) ?? [...checkpoints].reverse().find(x=>x.label===idOrLabel);
    if(!cp)throw new Error('TemporalHistory checkpoint not found');
    return cp;
  }

  function restoreCheckpoint(idOrLabel){
    const cp=findCheckpoint(idOrLabel);
    const candidate=restore(cp.state);
    assertValid(candidate);
    const actual=serialize(candidate);
    if(hashState(actual)!==cp.hash)throw new Error('TemporalHistory checkpoint hash mismatch');
    current=candidate;
    return {world:current,id:cp.id,label:cp.label,tick:cp.tick,hash:cp.hash};
  }

  function executeCommand(type,payload={}){
    const atTick=current.tick;
    const safePayload=copyPayload(payload);
    const result=command(current,type,safePayload);
    if(result?.ok){
      journal.push({
        sequence:nextSequence++,
        tick:atTick,
        type:String(type),
        payload:safePayload
      });
      prune();
    }
    return result;
  }

  function advance(count=1){
    step(current,count);
    return current;
  }

  function replayFrom(idOrLabel,targetTick){
    const cp=findCheckpoint(idOrLabel);
    if(!Number.isInteger(targetTick)||targetTick<cp.tick||targetTick>1000000000)
      throw new Error('Invalid replay targetTick');

    restoreCheckpoint(cp.id);
    const commands=journal
      .filter(x=>x.tick>=cp.tick&&x.tick<targetTick)
      .sort((a,b)=>a.tick-b.tick||a.sequence-b.sequence);
    let index=0;

    while(current.tick<targetTick){
      while(index<commands.length&&commands[index].tick===current.tick){
        const rec=commands[index++];
        const result=command(current,rec.type,copyPayload(rec.payload));
        if(!result?.ok)throw new Error(`TemporalHistory replay command failed at tick ${current.tick}: ${rec.type}`);
      }
      step(current,1);
    }

    assertValid(current);
    return {world:current,tick:current.tick,hash:hashState(),commandsReplayed:index};
  }

  function verifyRoundTrip(idOrLabel,targetTick=current.tick){
    const beforeState=canonical();
    const beforeHash=hashState(beforeState);
    const beforeTick=current.tick;
    try{
      const replay=replayFrom(idOrLabel,targetTick);
      const afterState=canonical();
      const afterHash=hashState(afterState);
      return {
        ok:beforeTick===targetTick&&beforeHash===afterHash&&beforeState===afterState,
        beforeTick,
        afterTick:current.tick,
        beforeHash,
        afterHash,
        commandsReplayed:replay.commandsReplayed
      };
    }catch(error){
      return {
        ok:false,
        beforeTick,
        afterTick:current.tick,
        beforeHash,
        afterHash:null,
        error:String(error?.message||error)
      };
    }
  }

  function stats(){
    return {
      tick:current.tick,
      checkpoints:checkpoints.length,
      journalEntries:journal.length,
      oldestCheckpointTick:checkpoints[0]?.tick??null,
      newestCheckpointTick:checkpoints.at(-1)?.tick??null,
      hash:hashState()
    };
  }

  return {
    get world(){return current;},
    checkpoint,
    restore:restoreCheckpoint,
    executeCommand,
    advance,
    replayFrom,
    verifyRoundTrip,
    stats,
    listCheckpoints:()=>checkpoints.map(({state,...meta})=>({...meta})),
    listJournal:()=>journal.map(x=>({...x,payload:copyPayload(x.payload)}))
  };
}

export {fnv1a as temporalStateHash};
