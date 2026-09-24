/** Shared WorldSim resource-regeneration policy contract.
 * Pure data only: no ecology imports, no engine imports, no mutation.
 */
export const K6_RESOURCE_REGEN=Object.freeze({
  food:Object.freeze({periodTicks:120,amount:3,renewable:true}),
  wood:Object.freeze({periodTicks:720,amount:1,renewable:true}),
  stone:Object.freeze({periodTicks:null,amount:0,renewable:false})
});
