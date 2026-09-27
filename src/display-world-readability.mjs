/** Display V1 / D1 — pure visual language for world readability.
 * Enriches DSP1 region projections with render-only tokens. No gameplay writes.
 */
import {worldPresentationRegions} from './read-models/world-presentation.mjs?v=0.5.0';

export const DISPLAY_WORLD_READABILITY_VERSION='display-d1/v1';

const STYLE_BY_ID=Object.freeze({
  core:Object.freeze({adventure:false,shortLabel:'CORE',levelLabel:'Settlement',accent:'#d8c38c',wash:'#00000000'}),
  z1:Object.freeze({adventure:true,shortLabel:'Z1 · GRASSLAND',levelLabel:'Lv.1–15',accent:'#d1c477',wash:'#d7d98c18'}),
  z2:Object.freeze({adventure:true,shortLabel:'Z2 · WOODLAND',levelLabel:'Lv.16–30',accent:'#8eb58c',wash:'#416f5518'}),
  z3:Object.freeze({adventure:true,shortLabel:'Z3 · UPLANDS',levelLabel:'Lv.31–45',accent:'#b6a984',wash:'#8d806f1b'}),
  z4:Object.freeze({adventure:true,shortLabel:'Z4 · STONE RIDGE',levelLabel:'Lv.46–60',accent:'#c3a58a',wash:'#7d706b20'})
});

function freezeRows(rows){for(const row of rows)Object.freeze(row);return Object.freeze(rows);}

export function worldReadabilityRegions(state){
  return freezeRows(worldPresentationRegions(state).map(region=>{
    const style=STYLE_BY_ID[region.id]??STYLE_BY_ID.core;
    return {
      ...region,...style,
      markerX:Math.floor((region.minX+region.maxX)/2),
      markerY:3,
      gateX:region.minX,
      gateY:25
    };
  }));
}
