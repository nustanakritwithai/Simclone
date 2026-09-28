"""One-shot, hash-locked transfer of the independently tested RC4 repair.
This publisher can update only the existing integration branch; it cannot merge.
"""
from pathlib import Path
import json, os, subprocess, tempfile
ROOT=Path.cwd()
PACKAGE=ROOT/'verification/rc4/_repair'
MANIFEST=json.loads((PACKAGE/'manifest.json').read_text())
HELPER='.github/workflows/rc4-apply-reviewed-repair.yml'
def git(*args,env=None):
    return subprocess.check_output(['git',*args],text=True,env=env).strip()
def run(*args): subprocess.run(args,check=True)
def blob(path): return git('hash-object',path)
assert os.environ.get('GITHUB_REPOSITORY')=='nustanakritwithai/Simclone'
assert os.environ.get('GITHUB_REF')=='refs/heads/integration/rc4-merchant-economy-v1'
assert git('rev-parse','HEAD')==os.environ['GITHUB_SHA']
assert not git('status','--porcelain')
for path,hashes in MANIFEST['paths'].items():
    target=hashes['after'] if path in MANIFEST['directPaths'] else hashes['before']
    assert blob(path)==target, 'unexpected source drift: '+path
for name,path in MANIFEST['patches'].items():
    assert path.startswith(('src/','tests/','scripts/')) and '..' not in path
    text=(PACKAGE/name).read_text()
    assert text.splitlines()[0]=='diff --git a/'+path+' b/'+path
    assert sum(line.startswith('diff --git ') for line in text.splitlines())==1
    run('git','apply','--unidiff-zero','--index',str(PACKAGE/name))
for path in MANIFEST['headerPaths']:
    p=ROOT/path;p.write_text(MANIFEST['header']+p.read_text())
run('node','scripts/pin-assets.mjs')
for path,hashes in MANIFEST['paths'].items():
    assert blob(path)==hashes['after'], 'reviewed output mismatch: '+path
run('git','add','--',*MANIFEST['paths'].keys())
run('git','rm','-r','--','verification/rc4/_repair')
run('git','diff','--cached','--check')
# The helper itself is removed through the connector afterwards, so the final
# production candidate must match this independently tested tree exactly.
with tempfile.TemporaryDirectory() as tmp:
    env=dict(os.environ,GIT_INDEX_FILE=str(Path(tmp)/'index'))
    git('read-tree',git('write-tree'),env=env)
    git('update-index','--force-remove',HELPER,env=env)
    assert git('write-tree',env=env)==MANIFEST['expectedFinalTree'], 'unexpected final tree'
print(json.dumps({'result':'SAT','checkedFiles':len(MANIFEST['paths']),'expectedFinalTree':MANIFEST['expectedFinalTree'],'sourceHead':os.environ['GITHUB_SHA']},indent=2),flush=True)
