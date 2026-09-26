/** VAL1 — read-only autonomous-life legibility projection. */
import {isIndependent} from './individual-resources.mjs?v=0.5.0';
import {householdOf} from './relationships.mjs?v=0.5.0';
import {householdEconomySnapshot} from './kingdom-household-economy.mjs?v=0.5.0';
import {personalHomeIntent} from './individual-home-planning.mjs?v=0.5.0';
import {walkable} from './survival.mjs?v=0.5.0';

export const AUTONOMOUS_LIFE_VIEW_VERSION='VAL1-0.1';

const ACTION_LABEL=Object.freeze({
  FORAGE:'หาอาหาร',WOODCUT:'ตัดไม้',MINE:'ขุดหิน',BUILD:'ก่อสร้าง',
  CRAFT:'คราฟต์',PROCESS:'แปรรูป',EAT:'กินอาหาร',REST:'พักผ่อน',
  EXPLORE:'สำรวจ',IDLE:'พักรอ'
});
const HOME_LABEL=Object.freeze({
  INELIGIBLE:'ยังไม่ถึงวัยสร้างบ้าน',
  COHABITING:'อยู่ร่วม Household',
  HOME_COMPLETE:'บ้านส่วนตัวเสร็จแล้ว',
  NO_SITE:'กำลังหาพื้นที่บ้าน',
  NEED_HAMMER:'เตรียมโต๊ะและค้อน',
  EQUIP_HAMMER:'กำลังสวมค้อน',
  NEED_MATERIALS:'หาไม้และหิน',
  CRAFT_PIECE:'คราฟต์ชิ้นส่วนบ้าน',
  PLACE_PIECE:'นำชิ้นส่วนไปก่อสร้าง'
});
const FACTOR_LABEL=Object.freeze({
  base:'ฐาน',need:'ความต้องการ',goal:'เป้าหมาย',skill:'ทักษะ',distance:'ระยะทาง',
  laborMarket:'แรงงาน',householdCooperation:'ช่วย Household'
});
const freeze=x=>Object.freeze(x);
const number=n=>Number.isFinite(Number(n))?Number(n):0;

function selectedTrace(agent){
  const task=agent?.task;if(!task)return null;
  const targetId=task.targetId??null,trace=Array.isArray(agent.trace)?agent.trace:[];
  return trace.find(c=>c.status==='selected'&&c.kind===task.kind&&(c.targetId??null)===targetId)
    ??trace.find(c=>c.status==='selected'&&c.kind===task.kind)
    ??null;
}

function actionView(task){
  if(!task)return null;
  const purpose=task.purposeKind??null;
  const label=task.kind==='EXPLORE'&&purpose
    ?'สำรวจเพื่อ'+(ACTION_LABEL[purpose]??purpose)
    :(ACTION_LABEL[task.kind]??task.kind);
  return freeze({kind:task.kind,purposeKind:purpose,label,targetId:task.targetId??null,started:Number(task.started??0)});
}

function factorView(trace){
  if(!trace?.factors)return freeze([]);
  return freeze(Object.entries(trace.factors)
    .map(([key,value])=>freeze({key,label:FACTOR_LABEL[key]??key,value:number(value)}))
    .filter(row=>row.value!==0));
}

function householdView(state,agent){
  const household=householdOf(state,agent.id);if(!household)return null;
  const economy=householdEconomySnapshot(state,household.ownerId);if(!economy)return null;
  const top=economy.labor?.topOffer??null;
  return freeze({
    houseId:household.houseId,
    ownerId:household.ownerId,
    stock:freeze({...economy.stock}),
    scarcity:freeze({
      food:number(economy.economy?.scarcity?.food),
      wood:number(economy.economy?.scarcity?.wood),
      stone:number(economy.economy?.scarcity?.stone)
    }),
    topOffer:top?freeze({
      role:String(top.role??''),
      label:String(top.label??top.role??''),
      urgency:String(top.urgency??'normal'),
      priority:number(top.priority)
    }):null
  });
}

export function autonomousLifeSnapshot(state,agentId){
  if(!isIndependent(state))return null;
  const agent=state?.agents?.find(a=>a.id===Number(agentId)&&a.alive);if(!agent)return null;
  const trace=selectedTrace(agent),factors=factorView(trace);
  const score=trace?number(trace.score):null;
  const factorSum=trace?Object.values(trace.factors??{}).reduce((sum,v)=>sum+number(v),0):null;
  const intent=personalHomeIntent(state,agent,walkable);
  return freeze({
    version:AUTONOMOUS_LIFE_VIEW_VERSION,
    agentId:agent.id,
    currentAction:actionView(agent.task),
    decision:freeze({
      reason:trace?'selected-trace':agent.task?'trace-unknown':'no-active-task',
      score,
      factorSum,
      scoreMatches:trace?score===factorSum:null,
      factors
    }),
    homePlan:freeze({kind:String(intent?.kind??'UNKNOWN'),label:HOME_LABEL[intent?.kind]??String(intent?.kind??'UNKNOWN')}),
    household:householdView(state,agent),
    sources:freeze({
      action:agent.task?'agent.task':'none',
      decision:trace?'agent.trace:selected':'UNKNOWN',
      homePlan:'personalHomeIntent',
      household:'householdEconomySnapshot'
    })
  });
}
