"""Verify the deployed Rust release over public HTTPS and native Chromium storage.
This is not the offline fixture. Only fresh, isolated browser contexts are used.
Runtime state is read via snapshot(); all gameplay changes use real UI controls.
"""
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urljoin, urlsplit
import json
import re
import time
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'evidence-live-rust'
OUT.mkdir(exist_ok=True)
URL = 'https://nustanakritwithai.github.io/Simclone/'
RELEASE = '3096da3b50864c74aa0870511ac09f3845aeeb08'
checks, errors = [], []
report = {'release': RELEASE, 'url': URL, 'scope': 'Public HTTPS, fresh mobile Chromium contexts, native localStorage; not physical Android', 'result': 'UNKNOWN', 'checks': checks, 'pageErrors': errors}

def check(name, condition):
    if not condition:
        raise AssertionError(name)
    checks.append(name)
    print('PASS ' + name, flush=True)

def get_bytes(url):
    req = Request(url, headers={'User-Agent': 'Simclone-Release-Proof/1.0', 'Cache-Control': 'no-cache'})
    with urlopen(req, timeout=30) as response:
        if response.status != 200:
            raise AssertionError(f'HTTP {response.status}: {url}')
        return response.read()

def source_check():
    expected = (ROOT / 'index.html').read_bytes()
    actual = get_bytes(URL)
    if actual != expected:
        raise AssertionError('Public index does not match the exact release checkout')
    text = actual.decode('utf-8')
    mapping = json.loads(re.search(r'<script type="importmap" id="runtime-import-map">(.*?)</script>', text, re.S).group(1))['imports']
    urls = list(mapping.values()) + re.findall(r'<link rel="stylesheet" href="([^"]+)"', text)
    def verify(relative):
        path = urlsplit(relative).path.removeprefix('./')
        if not path.startswith('src/') or '..' in Path(path).parts:
            raise AssertionError('Unexpected public source path')
        source = get_bytes(urljoin(URL, relative))
        if source != (ROOT / path).read_bytes():
            raise AssertionError('Public source mismatch: ' + path)
        return {'path': path, 'sha256': sha256(source).hexdigest()}
    with ThreadPoolExecutor(max_workers=6) as pool:
        return list(pool.map(verify, urls))

def boot(browser):
    context = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    page = context.new_page()
    page.set_default_timeout(15000)
    page.on('pageerror', lambda error: errors.append(str(error)))
    response = page.goto(URL, wait_until='load', timeout=60000)
    check('Public game document responds HTTP 200', response.status == 200)
    page.wait_for_function("window.simclone?.version === '0.5.0'")
    page.wait_for_selector('#boot-screen', state='detached')
    page.wait_for_function("document.querySelector('#auto-start') !== null")
    pause(page)
    return context, page

def pause(page):
    if page.locator('#pause').get_attribute('aria-pressed') != 'true':
        page.locator('#pause').tap()
    page.wait_for_function("document.querySelector('#pause').getAttribute('aria-pressed') === 'true'")

def run(page):
    page.locator('[data-speed="5"]').tap()
    if page.locator('#pause').get_attribute('aria-pressed') == 'true':
        page.locator('#pause').tap()

def snap(page):
    return page.evaluate('simclone.snapshot()')

def save_world(page):
    pause(page)
    page.locator('#menu').tap()
    page.locator('[data-action="save"]').tap()
    saved = page.evaluate("localStorage.getItem('simclone:world:v1')")
    check('Native browser storage contains a valid saved world', bool(saved) and json.loads(saved)['version'] == '0.5.0')
    page.locator('#dialog-close').tap()
    return json.loads(saved)

try:
    # Bounded CDN propagation retries; a mismatch is never counted as a pass.
    for attempt in range(1, 7):
        try:
            report['publicFiles'] = source_check()
            break
        except Exception as error:
            print(f'PUBLIC_SOURCE_ATTEMPT {attempt}: {error}', flush=True)
            if attempt == 6:
                raise
            time.sleep(10)
    check('Public HTML, every pinned module and every stylesheet match release 3096da3b', bool(report['publicFiles']))

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context, page = boot(browser)
        try:
            page.locator('[data-nav="rust"]').tap()
            catalog = page.locator('[data-rust-catalog-item]')
            ids = catalog.evaluate_all('(elements) => elements.map(e => e.dataset.rustCatalogItem)')
            check('Nine real Rust catalog entries are visible without selecting a Clone', len(ids) == 9)
            check('Foundation, Wall, Doorway and Roof are shipped in the public catalog', all(kind in ids for kind in ['WOOD_FOUNDATION', 'WOOD_WALL', 'WOOD_DOORWAY', 'WOOD_ROOF']))
            page.screenshot(path=str(OUT / 'public-mobile-nine-recipes.png'))
            page.locator('#dialog-close').tap()
            page.locator('[data-nav="people"]').tap()
            page.locator('[data-person="1"]').tap()
            page.locator('[data-nav="rust"]').tap()
            check('Selected living Clone has nine actual craft buttons', page.locator('[data-ux="craft-item"]').count() == 9)
            before = snap(page)
            page.locator('[data-ux="craft-item"][data-recipe="WOOD_FOUNDATION"]').tap()
            accepted = snap(page)
            check('Foundation craft accepts exactly one authoritative order', len(accepted['rustPossessions']['orders']) == 1 and accepted['rustPossessions']['orders'][0]['recipe'] == 'WOOD_FOUNDATION')
            check('Foundation acceptance spends Wood 8 once and no stone', accepted['stock']['wood'] == before['stock']['wood'] - 8 and accepted['stock']['stone'] == before['stock']['stone'])
            page.locator('#dialog-close').tap()
            run(page)
            page.wait_for_function("simclone.snapshot().rustPossessions.items.some(i => i.kind === 'WOOD_FOUNDATION' && i.location.kind === 'bag' && i.location.agentId === 1)", timeout=45000)
            pause(page)
            saved = save_world(page)
            foundation = next(i for i in saved['rustPossessions']['items'] if i['kind'] == 'WOOD_FOUNDATION')
            check('Timed UI craft completes into one physical foundation item', sum(i['kind'] == 'WOOD_FOUNDATION' for i in saved['rustPossessions']['items']) == 1)
            page.reload(wait_until='load')
            page.wait_for_function("window.simclone?.version === '0.5.0'")
            page.wait_for_selector('#boot-screen', state='detached')
            pause(page)
            restored = snap(page)
            check('Native public-page reload preserves the exact physical item ID without duplication', sum(i['id'] == foundation['id'] and i['kind'] == 'WOOD_FOUNDATION' for i in restored['rustPossessions']['items']) == 1)
        except Exception:
            page.screenshot(path=str(OUT / 'manual-proof-failure.png'))
            raise
        finally:
            context.close()

        context, page = boot(browser)
        try:
            check('Fresh mobile world exposes the one-tap autonomy button', page.locator('#auto-start').is_visible())
            before = snap(page)
            page.locator('#auto-start').tap()
            enabled = snap(page)
            check('One tap enables autonomy without resetting the world or spending while paused', enabled['productionPlan']['enabled'] and enabled['seed'] == before['seed'] and enabled['stock'] == before['stock'])
            run(page)
            page.wait_for_function('simclone.snapshot().buildings.length > 2', timeout=10000)
            pause(page)
            plan = snap(page)
            check('Autonomy creates one real unfinished shelter on the public game', len(plan['buildings']) == 3 and not plan['buildings'][-1]['complete'])
            page.screenshot(path=str(OUT / 'public-mobile-shelter-plan.png'))
            run(page)
            page.wait_for_function('simclone.snapshot().stats.built >= 1', timeout=90000)
            page.wait_for_function("(() => {const s = simclone.snapshot(); return ['CRAFTING_TABLE_LV1','FURNACE'].every(k => s.rustStations.stations.some(st => st.kind === k)) && ['STONE_AXE','STONE_PICKAXE','HAMMER'].every(k => s.rustPossessions.items.some(i => i.kind === k)) && s.rustMaterials.charcoal >= 4;})()", timeout=180000)
            pause(page)
            completed = snap(page)
            check('Clones finish an actual shelter through the live fixed-step scheduler', completed['stats']['built'] >= 1 and any(b['id'] == plan['buildings'][-1]['id'] and b['complete'] for b in completed['buildings']))
            check('One-tap live production completes Axe, Pickaxe, Hammer, Table, Furnace and Charcoal', completed['rustMaterials']['charcoal'] >= 4)
            check('Public mobile layout has no horizontal overflow', page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
            report['autonomyResult'] = {'tick': completed['tick'], 'built': completed['stats']['built'], 'items': [i['kind'] for i in completed['rustPossessions']['items']], 'stations': [s['kind'] for s in completed['rustStations']['stations']], 'charcoal': completed['rustMaterials']['charcoal']}
            page.screenshot(path=str(OUT / 'public-mobile-completed-world.png'))
        except Exception:
            report['autonomyFailureState'] = snap(page)
            page.screenshot(path=str(OUT / 'autonomy-proof-failure.png'))
            raise
        finally:
            context.close()
        browser.close()
    check('Public mobile browser has no uncaught JavaScript errors', not errors)
    report['result'] = 'SAT'
except Exception as error:
    report['result'] = 'VIOL'
    report['error'] = str(error)
    raise
finally:
    (OUT / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    compact = {key: value for key, value in report.items() if key not in ['publicFiles', 'autonomyFailureState']}
    print('LIVE_RUST_REPORT ' + json.dumps(compact, ensure_ascii=False), flush=True)
