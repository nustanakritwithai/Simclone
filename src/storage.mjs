/** Browser persistence adapter. Never changes the engine or discards a bad save. */
export function createWorldStore({getStorage, serialize, restore, now=()=>Date.now(), key='simclone:world:v1'}) {
  let info={kind:'new',tick:null,at:null,protected:false},original=null,readBlocked=false;
  const status=()=>({...info});
  function load(){
    let text;
    try{text=getStorage().getItem(key);}catch{readBlocked=true;info={...info,kind:'unavailable',protected:true};return null;}
    if(text===null)return null;
    original=text;
    try{const world=restore(text);info={kind:'loaded',tick:world.tick,at:null,protected:false};return world;}
    catch{info={kind:'protected',tick:null,at:null,protected:true};return null;}
  }
  function save(world){
    if(readBlocked)return {ok:false,reason:'unread'};
    if(info.protected)return {ok:false,reason:'protected'};
    try{const text=serialize(world);getStorage().setItem(key,text);info={kind:'saved',tick:world.tick,at:now(),protected:false};return {ok:true};}
    catch{info={...info,kind:'unavailable'};return {ok:false,reason:'unavailable'};}
  }
  // Only call after an explicit reset/import confirmation, never after a load error.
  function allowReplacement(){readBlocked=false;info={kind:'new',tick:null,at:null,protected:false};}
  return {load,save,status,allowReplacement,originalText:()=>original};
}
export function saveLabel(info){
  if(info.kind==='protected')return 'เซฟเดิมมีปัญหา · ไม่เขียนทับ';
  if(info.kind==='unavailable')return 'บันทึกไม่ได้ · ส่งออกไฟล์';
  if(info.kind==='saved')return 'บันทึกแล้ว · วัน '+(1+Math.floor(info.tick/360));
  if(info.kind==='loaded')return 'เปิดเซฟเดิม · วัน '+(1+Math.floor(info.tick/360));
  return 'ยังไม่ได้บันทึก';
}
