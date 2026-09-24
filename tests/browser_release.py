"""One release contract for secondary browser suites; save version is independent."""
from pathlib import Path
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def read_release_contract(root=ROOT):
    """Read the actual engine exports without conflating save and UI versions."""
    package = json.loads((root / 'package.json').read_text(encoding='utf-8'))
    code = "import {VERSION,SAVE_VERSION} from './src/engine.mjs'; console.log(JSON.stringify({engine:VERSION,save:SAVE_VERSION}));"
    result = subprocess.check_output(
        ['node', '--input-type=module', '-e', code], cwd=root, text=True, timeout=20
    )
    contract = json.loads(result)
    if contract.get('engine') != package.get('version'):
        raise AssertionError('Engine/package release mismatch')
    if not isinstance(contract.get('save'), str) or not contract['save']:
        raise AssertionError('Missing save schema version')
    return contract


RELEASE = read_release_contract()


def wait_for_release(page):
    """Wait for startup, then fail immediately on wrong engine/UI metadata."""
    page.wait_for_function('Boolean(window.simclone)')
    actual = page.evaluate('({engine:simclone.version,ui:simclone.uiVersion})')
    expected = {'engine': RELEASE['engine'], 'ui': RELEASE['engine']}
    if actual != expected:
        raise AssertionError(f'Browser release mismatch: expected {expected}, got {actual}')
