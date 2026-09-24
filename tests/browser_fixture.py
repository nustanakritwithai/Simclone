"""Exact local modules, in-memory DOM and explicit Storage double. No HTTP claim."""
from pathlib import Path
import re,base64,json
ROOT=Path(__file__).resolve().parents[1]
def fixture(fail_start=False):
    # Use one module URL per source file. Recursively embedding dependency data
    # URLs duplicates the complete transitive graph and exhausts browser memory.
    # Import maps preserve native ESM linking and the existing offline boundary.
    modules={}
    def module(path):
        path=path.resolve()
        if not path.is_relative_to(ROOT/'src'):
            raise ValueError(f"Unexpected module outside runtime: {path}")
        name='simclone/'+path.relative_to(ROOT).as_posix()
        if name in modules:return name
        modules[name]=None  # cycles resolve through the import map as in ESM
        text=path.read_text()
        regex=r"(?:from\s*|import\s*|import\(\s*)['\"](\./[^'\"]+)['\"]"
        def replace(m):
            dependency=(path.parent / m.group(1).split('?')[0]).resolve()
            return m.group(0).replace(m.group(1),module(dependency))
        text=re.sub(regex,replace,text)
        if fail_start and path.name=='app.mjs':text="throw new Error('Injected module load failure');"
        modules[name]='data:text/javascript;base64,'+base64.b64encode(text.encode()).decode()
        return name
    html=(ROOT/'index.html').read_text()
    # Offline modules use the same sources but data URLs instead of HTTP cache keys.
    html=re.sub(r'<script type="importmap" id="runtime-import-map">[\s\S]*?</script>','',html)
    html=re.sub(r'<link rel="stylesheet" href="\./([^"?]+)(?:\?[^\"]+)?">',lambda m:'<style>'+(ROOT/m.group(1)).read_text()+'</style>',html)
    boot=module(ROOT/'src/boot.mjs')
    imports=json.dumps({'imports':modules},ensure_ascii=True,separators=(',',':'))
    entry=f'<script type="importmap">{imports}</script><script type="module">import "{boot}";</script>'
    html=re.sub(r'<script type="module" src="\./src/boot\.mjs[^\"]*"[^>]*></script>',lambda m:entry,html)
    return html
HTML=fixture()
def storage(page,saved=None,deny_get=False,deny_set=False):
    page.evaluate('''options=>{const map=new Map(options.saved===null?[]:[['simclone:world:v1',options.saved]]);window.__saveMap=map;window.__denyGet=options.denyGet;window.__denySet=options.denySet;Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>{if(window.__denyGet)throw new Error('Denied');return map.get(k)??null},setItem:(k,v)=>{if(window.__denySet)throw new Error('Quota');map.set(k,String(v))}}})}''',dict(saved=saved,denyGet=deny_get,denySet=deny_set))
