"""Exact local modules, in-memory DOM and explicit Storage double. No HTTP claim."""
from pathlib import Path
import re,base64
ROOT=Path(__file__).resolve().parents[1]
def fixture(fail_start=False):
    cache={}
    def module(path):
        path=path.resolve()
        if path in cache:return cache[path]
        text=path.read_text()
        regex=r"(?:from\s*|import\(\s*)['\"](\./[^'\"]+)['\"]"
        def replace(m):
            dependency=(path.parent / m.group(1).split('?')[0]).resolve()
            return m.group(0).replace(m.group(1),module(dependency))
        text=re.sub(regex,replace,text)
        if fail_start and path.name=='app.mjs':text="throw new Error('Injected module load failure');"
        url='data:text/javascript;base64,'+base64.b64encode(text.encode()).decode()
        cache[path]=url
        return url
    html=(ROOT/'index.html').read_text()
    html=re.sub(r'<link rel="stylesheet" href="\./([^"?]+)(?:\?[^\"]+)?">',lambda m:'<style>'+(ROOT/m.group(1)).read_text()+'</style>',html)
    boot=module(ROOT/'src/boot.mjs')
    html=re.sub(r'<script type="module" src="\./src/boot\.mjs[^\"]*"[^>]*></script>',lambda m:f'<script type="module">import "{boot}";</script>',html)
    return html
HTML=fixture()
def storage(page,saved=None,deny_get=False,deny_set=False):
    page.evaluate('''options=>{const map=new Map(options.saved===null?[]:[['simclone:world:v1',options.saved]]);window.__saveMap=map;window.__denyGet=options.denyGet;window.__denySet=options.denySet;Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>{if(window.__denyGet)throw new Error('Denied');return map.get(k)??null},setItem:(k,v)=>{if(window.__denySet)throw new Error('Quota');map.set(k,String(v))}}})}''',dict(saved=saved,denyGet=deny_get,denySet=deny_set))
