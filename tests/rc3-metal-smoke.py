"""RC3.2 native/public real-button Furnace -> Iron/Steel -> T2 tool proof."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright
import argparse,json,os,subprocess,time
ROOT=Path(__file__).resolve().parents[1]
P=argparse.ArgumentParser();P.add_argument('--native',action='store_true');P.add_argument('--public',action='store_true');P.add_argument('--width',type=int);A=P.parse_args();assert not(A.native and A.public)
MODE='public' if A.public else 'native' if A.native else 'offline';SHA=os.environ.get('RELEASE_SHA','local')
OUT=ROOT/('evidence-public-metal' if A.public else 'evidence-ui/metal-'+MODE);OUT.mkdir(parents=True,exist_ok=True)
SAVED=subprocess.check_output(['node','scripts/rc3-metal-fixture.mjs'],cwd=ROOT,text=True)
checks=[];errors=[];server=None;browser=None;pw=None;page=None;failure=None;success=False
def check(name,ok=True): assert ok,name;checks.append(name);print('PASS',name,flush=True)
def snap(): return page.evaluate('simclone.snapshot()')
def pause():
    if page.locator('#pause').inner_text()!='▶': page.locator('#pause').click()
def close():
    if page.locator('#dialog').evaluate('(e)=>e.open'): page.locator('#dialog-close').click()
def no_overflow(): return page.evaluate('document.documentElement.scrollWidth<=innerWidth+1 && (!document.querySelector("#dialog").open || document.querySelector("#dialog-body").scrollWidth<=document.querySelector("#dialog-body").clientWidth+1)')
def select_actor(aid):
    close()
    q=page.locator(f'[data-quick-person="{aid}"]')
    if q.is_visible(): q.click()
    else:
        n=page.locator('[data-nav="people"]');n.click();page.locator(f'[data-person="{aid}"]').first.click()
def open_rust(aid):
    select_actor(aid);b=page.locator('#rust');(b if b.is_visible() else page.locator('[data-nav="rust"]')).click()
def click_station(st):
    close();box=page.locator('#world').bounding_box()
    p=page.evaluate('(x)=>simclone.screenPoint(x.x,x.y)',st);safe=page.evaluate('simclone.safeFrame()')
    tx=(safe['left']+safe['right'])/2;ty=(safe['top']+safe['bottom'])/2
    page.mouse.move(box['x']+tx,box['y']+ty);page.mouse.down();page.mouse.move(box['x']+tx+tx-p['x'],box['y']+ty+ty-p['y'],steps=10);page.mouse.up();page.wait_for_timeout(100)
    p=page.evaluate('(x)=>simclone.screenPoint(x.x,x.y)',st);page.mouse.click(box['x']+p['x'],box['y']+p['y']);page.wait_for_selector('[data-furnace-materials]')
def wait_process():
    close();page.locator('[data-speed="5"]').click()
    if page.locator('#pause').inner_text()=='▶': page.locator('#pause').click()
    page.wait_for_function('simclone.snapshot().rustMaterials.orders.length===0',timeout=30000);pause()
try:
    if A.public: assert len(SHA)==40;BASE=os.environ['PAGE_URL'].rstrip('/')
    elif A.native:
        class Quiet(SimpleHTTPRequestHandler):
            def log_message(self,*args): pass
        server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start();BASE=f'http://127.0.0.1:{server.server_port}'
    else: BASE=None
    pw=sync_playwright().start();exe='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None;browser=pw.chromium.launch(executable_path=exe,headless=True,args=['--no-sandbox'])
    for width,height in [(1440,1000),(390,844)]:
        if A.width and width!=A.width: continue
        ctx=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<700,has_touch=True);page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.set_default_timeout(30000)
        if BASE:
            page.add_init_script("if(!sessionStorage.getItem('metal-proof')){localStorage.clear();localStorage.setItem('simclone:world:v1',"+json.dumps(SAVED)+");sessionStorage.setItem('metal-proof','1');}")
            r=page.goto(BASE+'/?release='+SHA,wait_until='load',timeout=60000);check(f'{width}: {MODE} HTTP',r and r.ok);page.wait_for_function("window.simclone?.uiVersion==='0.5.0'");pause()
            for path in ['index.html','src/material-schema.mjs','src/material-economy.mjs','src/rust-materials.mjs','src/crafting-catalog.mjs','src/rust-possessions.mjs','src/rust-runtime.mjs','src/engine.mjs','src/crafting-ui.mjs','src/ux.mjs']:
                expected=(ROOT/path).read_bytes();actual=None
                for attempt in range(4):
                    rr=ctx.request.get(BASE+'/'+path+'?release='+SHA,headers={'Cache-Control':'no-cache'})
                    if rr.ok: actual=rr.body()
                    if actual==expected: break
                    if attempt<3: time.sleep(2)
                check(f'{width}: {MODE} exact bytes {path}',actual==expected)
        else:
            from browser_fixture import fixture,storage
            storage(page,SAVED);page.set_content(fixture(default_mode='independent'),wait_until='load');page.wait_for_function("window.simclone?.uiVersion==='0.5.0'");pause()
        s=snap();a=s['agents'][0];aid=a['id'];furnace=next(x for x in s['rustStations']['stations'] if x['kind']=='FURNACE')
        before=(s['rustMaterials']['personalStores'][0] if s.get('worldMode',{}).get('kind')=='independent' else s['rustMaterials'])
        check(f'{width}: seeded real metal balances',before['ironOre']>=2 and before['charcoal']>=2 and before['ironIngot']>=2)
        select_actor(aid);click_station(furnace);check(f'{width}: Furnace shows Iron and Steel controls',page.locator('[data-ux="process-iron"]').is_visible() and page.locator('[data-ux="process-steel"]').is_visible())
        check(f'{width}: Furnace fits viewport',no_overflow());page.screenshot(path=str(OUT/f'{width}-furnace.png'))
        ore0=before['ironOre'];iron0=before['ironIngot'];char0=before['charcoal'];page.locator('[data-ux="process-iron"]').click();wait_process()
        now=snap();store=now['rustMaterials']['personalStores'][0];check(f'{width}: real Iron process commits once',store['ironOre']==ore0-2 and store['ironIngot']==iron0+1 and store['charcoal']==char0-1)
        click_station(furnace);iron1=store['ironIngot'];steel0=store['steelIngot'];char1=store['charcoal'];page.locator('[data-ux="process-steel"]').click();wait_process()
        now=snap();store=now['rustMaterials']['personalStores'][0];check(f'{width}: real Steel process commits once',store['ironIngot']==iron1-2 and store['steelIngot']==steel0+1 and store['charcoal']==char1-2)
        open_rust(aid);card=page.locator('[data-recipe-id="STONE_AXE_T2"]');card.scroll_into_view_if_needed()
        check(f'{width}: T2 is visibly Iron-backed',card.get_attribute('data-known')=='true' and 'ขวานเหล็ก' in card.inner_text() and 'เหล็กแท่ง ×2' in card.inner_text())
        check(f'{width}: Rust material HUD visible',page.locator(f'[data-metal-economy="{aid}"]').is_visible());check(f'{width}: Rust dialog fits viewport',no_overflow());page.screenshot(path=str(OUT/f'{width}-t2-iron.png'))
        pre=snap();prestore=pre['rustMaterials']['personalStores'][0];page.locator('[data-recipe-id="STONE_AXE_T2"] [data-ux="craft-item"]').click();accepted=snap();astore=accepted['rustMaterials']['personalStores'][0]
        check(f'{width}: T2 accepts and reserves Iron once',astore['ironIngot']==prestore['ironIngot']-2 and accepted['rustPossessions']['orders'][0]['reservedProcessed']['ironIngot']==2)
        wait_process();final=snap();item=max([i for i in final['rustPossessions']['items'] if i.get('craft',{}).get('recipeId')=='STONE_AXE_T2'],key=lambda x:x['id'])
        check(f'{width}: physical T2 crafted item keeps outcome identity',item['craft']['tier']==2 and item['createdBy']==aid)
        close();page.locator('#menu').click();page.locator('[data-action="save"]').click();saved=page.evaluate("localStorage.getItem('simclone:world:v1')");check(f'{width}: Save retains metals and T2 item',json.loads(saved)['rustMaterials']==final['rustMaterials'])
        check(f'{width}: no browser errors',not errors);ctx.close()
    success=True
except Exception as e:
    failure=str(e)
    raise
finally:
    if browser:
        try:
            if page: page.screenshot(path=str(OUT/'failure.png'))
            browser.close()
        except Exception: pass
    if pw: pw.stop()
    if server: server.shutdown()
    (OUT/'report.json').write_text(json.dumps({'mode':MODE,'releaseSha':SHA,'result':'SAT' if success else 'VIOL','checks':checks,'errors':errors,'failure':failure},ensure_ascii=False,indent=2))
print(json.dumps({'mode':MODE,'checks':len(checks),'result':'SAT'}))
