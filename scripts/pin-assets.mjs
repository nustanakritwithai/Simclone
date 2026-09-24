/** Keep source versions independent of browser cache keys. No build toolchain. */
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),imports={};
for(const name of readdirSync(resolve(root,'src')).filter(n=>n.endsWith('.mjs')).sort()){
  const hash=createHash('sha256').update(readFileSync(resolve(root,'src',name))).digest('hex').slice(0,16);
  imports[`./src/${name}?v=0.5.0`]=`./src/${name}?v=0.5.0&rev=${hash}`;
}
const mapping='<script type="importmap" id="runtime-import-map">'+JSON.stringify({imports})+'</script>';
let html=readFileSync(resolve(root,'index.html'),'utf8');
html=html.replace(/<script type="importmap" id="runtime-import-map">[\s\S]*?<\/script>\n?/,'');
html=html.replace('</head>',mapping+'\n</head>');
html=html.replace(/src="\.\/src\/boot\.mjs\?v=0\.5\.0(?:&rev=[a-f0-9]+)?"/,`src="${imports['./src/boot.mjs?v=0.5.0']}"`);
writeFileSync(resolve(root,'index.html'),html);
console.log('Pinned',Object.keys(imports).length,'runtime modules by source SHA-256');
