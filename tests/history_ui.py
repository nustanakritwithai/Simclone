"""Archive observation UI on exact local modules, offline Storage double (not native persistence)."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixture import HTML, storage
from history_storage import boundary_fixture
import json

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'evidence-history'

def run_archive_ui():
    OUT.mkdir(exist_ok=True)
    checks, errors = [], []
    def check(name, condition):
        assert condition, name
        checks.append(name)
        print('PASS archive UI:', name, flush=True)
    fixture = boundary_fixture()
    death = json.loads(fixture)['agents'][0]['death']
    with sync_playwright() as p:
        executable = '/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None
        browser = p.chromium.launch(executable_path=executable, headless=True, args=['--no-sandbox'])
        page = browser.new_page(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True)
        page.on('pageerror', lambda error: errors.append(str(error)))
        storage(page, fixture)
        page.set_content(HTML, wait_until='load')
        page.wait_for_function("window.simclone?.version==='0.4.0'")
        page.wait_for_selector('#boot-screen', state='detached')
        page.locator('#pause').tap()
        initial = page.evaluate('simclone.snapshot()')
        check('legacy boundary preserves 200 identities before an admitted birth', initial['version']=='0.4.0' and len(initial['agents'])==200 and initial['archive']==[])
        page.locator('[data-quick-person="2"]').tap()
        before = page.evaluate('JSON.stringify(simclone.snapshot())')
        page.locator('[data-nav="clone"]').tap()
        check('boundary clone preview neither compacts nor spends resources', page.evaluate('JSON.stringify(simclone.snapshot())')==before and page.locator('[data-action="confirm-clone"]').is_enabled())
        page.locator('[data-action="confirm-clone"]').tap()
        world = page.evaluate('simclone.snapshot()')
        check('one confirmed clone crosses 200 and moves dead records into archive', len(world['agents'])+len(world['archive'])==201 and len(world['archive'])==195 and len(world['agents'])==6)
        original = json.loads(before)
        check('confirmation costs Food 8 and Wood 4 exactly once', world['stock']['food']==original['stock']['food']-8 and world['stock']['wood']==original['stock']['wood']-4)
        page.locator('[data-ui="close"]').tap()
        page.locator('[data-quick-person="2"]').tap()
        check('living descendant resolves archived Original parent', 'Original' in page.locator('#ux-tab-content').inner_text())
        page.locator('[data-ui="close"]').tap()
        page.locator('[data-nav="people"]').tap()
        check('roster first page is bounded to 80 identities', page.locator('.person-row').count()==80)
        page.locator('[data-ux="more-people"]').tap()
        check('load-more adds only the next 80 identities', page.locator('.person-row').count()==160)
        page.locator('[data-roster-filter="archived"]').tap()
        page.locator('#people-search').fill('Original')
        check('archived Original remains searchable', page.locator('.person-row').count()==1)
        page.locator('[data-person="1"]').tap()
        check('archived inspector displays evidenced death age/tick', f"อายุ {death['ageYears']} ปี" in page.locator('#life-label').inner_text() and f"tick {death['tick']}" in page.locator('#life-label').inner_text())
        check('archived identity cannot be cloned or followed', page.locator('[data-ux="clone"]').is_disabled() and page.locator('[data-ui="follow"]').is_disabled())
        page.locator('[data-ux="why"]').tap()
        check('missing transient decision scores are explicitly disclosed', 'ไม่เก็บคะแนนตัดสินใจชั่วคราว' in page.locator('#ux-tab-content').inner_text())
        page.locator('[data-tab="memory"]').tap()
        check('retained death memory is visible after compaction', 'เสียชีวิตตามวัย' in page.locator('#ux-tab-content').inner_text())
        check('archive inspector has no horizontal document overflow', page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        page.screenshot(path=str(OUT/'mobile-ancestor-offline.png'))
        check('no uncaught archive UI errors', not errors)
        report={'result':'PASS','count':len(checks),'checks':checks,'pageErrors':errors,
            'scope':'Offline exact-module Chromium fixture, 390x844 touch emulation, Storage double, synthetic 200-identity boundary. Not HTTP/native persistence/physical Android.'}
        (OUT/'archive-ui.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
        print('TOTAL archive UI',len(checks),'PASS',flush=True)
        browser.close()
        return report

if __name__=='__main__':
    run_archive_ui()
