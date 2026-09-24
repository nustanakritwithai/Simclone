"""Native Chromium HTTP-origin/disk-profile checks; synthetic 200-identity fixture, not device proof."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
from urllib.parse import urlsplit
import json
import subprocess
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'evidence-history'
KEY = 'simclone:world:v1'

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_GET(self):
        if urlsplit(self.path).path == '/__storage_setup__':
            body = b'<!doctype html><title>Native storage fixture setup</title>'
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            super().do_GET()


def boundary_fixture():
    # This is deliberately synthetic boundary data; the separate 1800-year proof is unmodified.
    code = """
import {createWorld,step,adultLife,lifespanYears} from './src/engine.mjs';
const s=createWorld(42),a=s.agents[0];a.life=adultLife(0,lifespanYears(s,a));step(s);
const template=s.agents[1];
for(let id=7;id<=200;id++)s.agents.push({...structuredClone(template),id,name:'Ancestor '+id,alive:false,hp:0,task:null,moveTick:0,
 death:{status:'recorded',tick:s.tick,cause:'starvation',ageYears:18},memory:[{tick:s.tick,text:'Synthetic boundary fixture'}]});
s.nextAgent=201;s.stock.food=100;s.stock.wood=100;
s.version='0.2.0';delete s.archive;delete s.archiveVersion;
console.log(JSON.stringify(s));
"""
    return subprocess.check_output(['node', '--input-type=module', '-e', code], cwd=ROOT, text=True).strip()


def run_native_storage():
    OUT.mkdir(exist_ok=True)
    checks, errors = [], []
    def check(name, condition):
        assert condition, name
        checks.append(name)
        print('PASS native HTTP:', name, flush=True)

    fixture = boundary_fixture()
    expected_death = json.loads(fixture)['agents'][0]['death']
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT)))
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    origin = f'http://127.0.0.1:{server.server_port}'
    context = None
    try:
        with TemporaryDirectory(prefix='simclone-native-profile-') as profile, sync_playwright() as p:
            executable = '/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None
            def launch():
                return p.chromium.launch_persistent_context(profile, executable_path=executable, headless=True,
                    viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True,
                    accept_downloads=True, args=['--no-sandbox'])
            def loaded(page):
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(origin + '/index.html', wait_until='load')
                page.wait_for_function("window.simclone?.version==='0.3.6'")
                page.wait_for_selector('#boot-screen', state='detached')
                if page.locator('#pause').get_attribute('aria-pressed') != 'true':
                    page.locator('#pause').tap()

            context = launch()
            page = context.new_page()
            page.goto(origin + '/__storage_setup__')
            page.evaluate('(text)=>localStorage.setItem("simclone:world:v1",text)', fixture)
            loaded(page)
            check('real HTTP origin and unmodified native Storage prototype', page.evaluate(
                'location.protocol==="http:" && Object.getPrototypeOf(localStorage)===Storage.prototype'))
            initial = page.evaluate('simclone.snapshot()')
            check('0.2.0 fixture migrates without discarding any of the 200 identities',
                initial['version'] == '0.3.0' and len(initial['agents']) == 200 and initial['archive'] == [])
            page.locator('[data-quick-person="2"]').tap()
            before = page.evaluate('JSON.stringify(simclone.snapshot())')
            page.locator('[data-nav="clone"]').tap()
            check('preview at old history cap is read-only and allows confirmation',
                page.evaluate('JSON.stringify(simclone.snapshot())') == before and page.locator('[data-action="confirm-clone"]').is_enabled())
            page.locator('[data-action="confirm-clone"]').tap()
            world = page.evaluate('simclone.snapshot()')
            check('UI confirmation creates identity 201 and archives dead history',
                len(world['agents']) + len(world['archive']) == 201 and len(world['archive']) == 195 and len(world['agents']) == 6)
            before_world = json.loads(before)
            check('native UI clone spends exactly once', world['stock']['food'] == before_world['stock']['food']-8 and world['stock']['wood'] == before_world['stock']['wood']-4)
            page.locator('[data-ui="close"]').tap()
            page.locator('[data-quick-person="2"]').tap()
            check('living descendant resolves its archived parent in inspector', 'Original' in page.locator('#ux-tab-content').inner_text())
            page.locator('[data-ui="close"]').tap()
            page.locator('[data-nav="people"]').tap()
            check('roster renders bounded first page', page.locator('.person-row').count() == 80)
            page.locator('[data-ux="more-people"]').tap()
            check('roster expands one bounded page at a time', page.locator('.person-row').count() == 160)
            page.locator('[data-roster-filter="archived"]').tap()
            page.locator('#people-search').fill('Original')
            check('archived identity is searchable', page.locator('.person-row').count() == 1)
            page.locator('[data-person="1"]').tap()
            check('archived inspector preserves exact death age and tick',
                f"อายุ {expected_death['ageYears']} ปี" in page.locator('#life-label').inner_text() and f"tick {expected_death['tick']}" in page.locator('#life-label').inner_text())
            check('dead ancestor cannot be cloned or followed', page.locator('[data-ux="clone"]').is_disabled() and page.locator('[data-ui="follow"]').is_disabled())
            page.locator('[data-ux="why"]').tap()
            check('discarded transient scores are disclosed rather than fabricated', 'ไม่เก็บคะแนนตัดสินใจชั่วคราว' in page.locator('#ux-tab-content').inner_text())
            check('archive inspector has no document overflow', page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
            page.screenshot(path=str(OUT/'mobile-ancestor.png'))
            page.locator('[data-ui="close"]').tap()
            page.locator('#menu').tap()
            page.locator('[data-action="save"]').tap()
            saved = page.evaluate('localStorage.getItem("simclone:world:v1")')
            check('native saved bytes equal paused authoritative state', saved == page.evaluate('JSON.stringify(simclone.snapshot())'))
            archived_bytes = json.loads(saved)['archive']
            context.close()
            context = launch()  # New Chromium process with the same on-disk profile.
            page = context.new_page()
            page.goto(origin + '/__storage_setup__')
            check('exact native storage bytes survive Chromium process restart', page.evaluate('localStorage.getItem("simclone:world:v1")') == saved)
            loaded(page)
            restored = page.evaluate('simclone.snapshot()')
            check('restarted game restores archived identity, lineage, XP and death history',
                restored['archive'] == archived_bytes and restored['archiveVersion'] == '0.1.0' and page.evaluate('simclone.saveStatus().kind') == 'loaded')
            # Leave the running app BEFORE setting corrupt bytes, so its pagehide save cannot mask this test.
            page.goto(origin + '/__storage_setup__')
            damaged = json.loads(saved)
            damaged['archive'][0]['parentId'] = 999999
            damaged = json.dumps(damaged, ensure_ascii=False)
            page.evaluate('(text)=>localStorage.setItem("simclone:world:v1",text)', damaged)
            loaded(page)
            check('malformed archive is protected on the actual HTTP origin', page.evaluate('simclone.saveStatus().protected') is True)
            page.locator('#menu').tap()
            page.locator('[data-action="save"]').tap()
            page.evaluate('dispatchEvent(new Event("pagehide"))')
            check('manual save and pagehide cannot overwrite native damaged archive bytes', page.evaluate('localStorage.getItem("simclone:world:v1")') == damaged)
            with page.expect_download() as download:
                page.locator('[data-action="export-original"]').tap()
            check('recovery export returns exact native damaged bytes', Path(download.value.path()).read_text() == damaged)
            check('no uncaught native HTTP JavaScript errors', not errors)
            report = {'result': 'PASS', 'count': len(checks), 'checks': checks, 'pageErrors': errors,
                'scope': 'Real loopback HTTP origin, native localStorage, on-disk Chromium profile and browser-process restart, 390x844 emulated touch viewport; synthetic 200-identity fixture. Not public Pages or physical Android.'}
            (OUT/'native-storage.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
            print('TOTAL native HTTP', len(checks), 'PASS', flush=True)
            context.close()
            context = None
            return report
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


if __name__ == '__main__':
    run_native_storage()
