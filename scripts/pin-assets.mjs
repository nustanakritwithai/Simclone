/** Keep source versions independent of browser cache keys. No build toolchain. */
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),src=resolve(root,'src'),imports={};
function runtimeModules(dir=src){
  return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const full=resolve(dir,entry.name);
    if(entry.isDirectory())return runtimeModules(full);
    if(!entry.isFile()||!entry.name.endsWith('.mjs'))return [];
    return [relative(src,full).replaceAll('\\','/')];
  }).sort();
}
for(const name of runtimeModules()){
  const hash=createHash('sha256').update(readFileSync(resolve(src,name))).digest('hex').slice(0,16);
  imports[`./src/${name}?v=0.5.0`]=`./src/${name}?v=0.5.0&rev=${hash}`;
}
const mapping='<script type="importmap" id="runtime-import-map">'+JSON.stringify({imports})+'</script>';
let html=readFileSync(resolve(root,'index.html'),'utf8');
html=html.replace(/<script type="importmap" id="runtime-import-map">[\s\S]*?<\/script>\n?/,'');
html=html.replace('</head>',mapping+'\n</head>');
html=html.replace(/src="\.\/src\/boot\.mjs\?v=0\.5\.0(?:&rev=[a-f0-9]+)?"/,`src="${imports['./src/boot.mjs?v=0.5.0']}"`);
writeFileSync(resolve(root,'index.html'),html);
console.log('Pinned',Object.keys(imports).length,'runtime modules by source SHA-256');
