/** A failed module/style load must be visible. Retry reloads; never removes saves. */
const screen=document.getElementById('boot-screen');
const message=(title,detail)=>{if(!screen)return;screen.dataset.status='error';document.getElementById('boot-title').textContent=title;document.getElementById('boot-detail').textContent=detail;};
async function stylesReady(){
  await Promise.all([...document.querySelectorAll('link[rel="stylesheet"]')].map(link=>new Promise((resolve,reject)=>{
    if(link.sheet){resolve();return;}
    const timer=setTimeout(()=>done(false),10000);
    function done(ok){clearTimeout(timer);link.removeEventListener('load',loaded);link.removeEventListener('error',failed);ok?resolve():reject(new Error('STYLE_LOAD_FAILED'));}
    function loaded(){done(true);}function failed(){done(false);}
    link.addEventListener('load',loaded,{once:true});link.addEventListener('error',failed,{once:true});
  })));
}
try{
  await stylesReady();
  await import('./app.mjs?v=0.5.0');
  if(window.simclone?.uiVersion!=='0.5.0'||window.simclone?.version!=='0.5.0')throw new Error('VERSION_MISMATCH');
  if(screen)screen.remove();
}catch(error){
  console.error('Simclone startup failed:',error);
  message('เปิดเกมยังไม่สำเร็จ','ไฟล์เกมหรือรูปแบบหน้าจอโหลดไม่ครบ กด “โหลดใหม่” เพื่อลองอีกครั้ง เซฟเดิมไม่ได้ถูกลบ');
}
