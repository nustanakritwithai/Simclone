import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('offline browser fixture loads each module once and retains fault injection without HTTP',()=>{
  const python=`
import sys,re,json,base64
sys.path.insert(0,'tests')
from browser_fixture import fixture
normal=fixture(); failed=fixture(fail_start=True)
def imports(html):return json.loads(re.search(r'<script type="importmap">(.*?)</script>',html).group(1))['imports']
n=imports(normal); f=imports(failed)
assert n and len(n)==len(f)
assert all(url.startswith('data:text/javascript;base64,') for url in n.values())
assert len(normal.encode())<2000000, 'offline fixture must not embed the dependency DAG recursively'
app=base64.b64decode(n['simclone/src/app.mjs'].split(',',1)[1]).decode()
assert 'Injected module load failure' not in app
assert base64.b64decode(f['simclone/src/app.mjs'].split(',',1)[1]).decode()=="throw new Error('Injected module load failure');"
for name,url in n.items():
 text=base64.b64decode(url.split(',',1)[1]).decode()
 assert 'data:text/javascript;base64,' not in text, name
 for target in re.findall(r"(?:from\\s*|import\\s*|import\\(\\s*)['\\\"](simclone/[^'\\\"]+)['\\\"]",text):assert target in n,target
print('UNIQUE',len(n))
`;
  const r=spawnSync('python',['-c',python],{cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:15000});
  assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/UNIQUE \d+/);
});
