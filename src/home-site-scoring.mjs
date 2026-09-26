/** MX3B — knowledge-bounded smart home-site scoring for Large World.
 * The scorer may use local visible terrain and resource locations the Clone
 * already knows. It must not inspect remote hidden resource amounts or social
 * state owned by the in-flight IC7 authority.
 */
import {worldBounds} from './world-bounds.mjs?v=0.5.0';
import {worldRegionAt} from './world-regions.mjs?v=0.5.0';
import {KNOWLEDGE_REVISION_RULES} from './knowledge-revision.mjs?v=0.5.0';
import {BELIEF_STATUS} from './knowledge.mjs?v=0.5.0';

export const SMART_HOME_SITE_VERSION='MX3B-0.1';
export const SMART_HOME_SITE_RULES=Object.freeze({
  maxKnownResourceDistance:12,
  travelWeight:3,
  resourceWeights:Object.freeze({food:2,wood:1.5,stone:.75}),
  regionScores:Object.freeze({
    grassland:4,
    woodland:2,
    uplands:-1,
    'stone-ridge':-2,
    wetland:-4,
    riverlands:-3
  }),
  adjacentWaterPenalty:6
});

const TYPES=Object.freeze(['food','wood','stone']);
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);

function knownResources(state,agent){
  const byType=Object.fromEntries(TYPES.map(k=>[k,new Map()]));
  for(const belief of agent?.knowledgeState?.beliefs??[]){
    const v=belief?.value,type=v?.type;
    if(!TYPES.includes(type)||belief.status===BELIEF_STATUS.REFUTED||
      !Number.isSafeInteger(v.resourceId)||!Number.isInteger(v.x)||!Number.isInteger(v.y))continue;
    byType[type].set(v.resourceId,{id:v.resourceId,x:v.x,y:v.y,source:'knowledge'});
  }
  for(const node of state.nodes??[]){
    if(!TYPES.includes(node.type)||node.amount<=0||distance(agent,node)>KNOWLEDGE_REVISION_RULES.observationRange)continue;
    byType[node.type].set(node.id,{id:node.id,x:node.x,y:node.y,source:'vision'});
  }
  return Object.fromEntries(TYPES.map(k=>[k,[...byType[k].values()].sort((a,b)=>a.id-b.id)]));
}

function adjacentWater(state,site){
  const bounds=worldBounds(state);
  let n=0;
  for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]){
    const x=site.x+dx,y=site.y+dy;
    if(x<0||y<0||x>=bounds.w||y>=bounds.h)continue;
    if(state.tiles[y*bounds.w+x]==='water')n++;
  }
  return n;
}

export function smartHomeSiteEvidence(state,agent,site){
  const bounds=worldBounds(state);
  if(bounds.profile!=='large')return Object.freeze({version:SMART_HOME_SITE_VERSION,eligible:false,reason:'legacy-profile',score:0});
  if(!agent?.alive||!Number.isInteger(site?.x)||!Number.isInteger(site?.y)||
    site.x<0||site.y<0||site.x>=bounds.w||site.y>=bounds.h)
    return Object.freeze({version:SMART_HOME_SITE_VERSION,eligible:false,reason:'input',score:-Infinity});

  const known=knownResources(state,agent),travel=distance(agent,site),local=travel<=KNOWLEDGE_REVISION_RULES.observationRange;
  const region=local?worldRegionAt(state.seed,bounds,site.x,site.y).region:null;
  const water=local?adjacentWater(state,site):0;
  const nearest={};let resourceScore=0;
  for(const type of TYPES){
    const xs=known[type],d=xs.length?Math.min(...xs.map(p=>distance(site,p))):null;nearest[type]=d;
    if(d!==null){
      const closeness=Math.max(0,SMART_HOME_SITE_RULES.maxKnownResourceDistance-d);
      resourceScore+=closeness*SMART_HOME_SITE_RULES.resourceWeights[type];
    }
  }
  const travelScore=-travel*SMART_HOME_SITE_RULES.travelWeight;
  const regionScore=region===null?0:(SMART_HOME_SITE_RULES.regionScores[region]??0);
  const waterScore=-water*SMART_HOME_SITE_RULES.adjacentWaterPenalty;
  const score=+(travelScore+resourceScore+regionScore+waterScore).toFixed(3);
  return Object.freeze({
    version:SMART_HOME_SITE_VERSION,eligible:true,score,travel,
    localTerrainObserved:local,region,adjacentWater:water,
    nearestKnownResource:Object.freeze({...nearest}),
    factors:Object.freeze({travel:travelScore,resources:+resourceScore.toFixed(3),region:regionScore,water:waterScore})
  });
}

export function chooseSmartHomeSite(state,agent,candidates){
  if(!Array.isArray(candidates)||!candidates.length)return null;
  const ranked=candidates.map(site=>({site:{x:site.x,y:site.y},evidence:smartHomeSiteEvidence(state,agent,site)}))
    .sort((a,b)=>b.evidence.score-a.evidence.score||
      a.evidence.travel-b.evidence.travel||
      a.site.y-b.site.y||a.site.x-b.site.x);
  const best=ranked[0];
  return Object.freeze({site:Object.freeze({...best.site}),evidence:best.evidence});
}
