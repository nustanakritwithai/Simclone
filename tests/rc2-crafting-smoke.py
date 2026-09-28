"""RC2 real-button lifecycle. Offline, native HTTP, and deployed Pages are distinct.

Only scenario preparation seeds a validated save. No browser-side simulation
state mutation or direct command/step test hook is used to make gameplay pass.
"""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright
import argparse, hashlib, json, os, subprocess, time

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--native',action='store_true')
parser.add_argument('--public',action='store_true')
parser.add_argument('--width',type=int)
ARGS=parser.parse_args()
assert not (ARGS.native and ARGS.public)
MODE='public' if ARGS.public else 'native' if ARGS.native else 'offline'
SHA=os.environ.get('RELEASE_SHA','local')
OUT=ROOT/('evidence-public-rc2' if ARGS.public else 'evidence-ui/rc2-'+MODE)
OUT.mkdir(parents=True,exist_ok=True)
SAVED=subprocess.check_output(['node','scripts/rc2-crafting-fixture.mjs'],cwd=ROOT,text=True)
INITIAL=json.loads(SAVED)
A,B=[a['id'] for a in INITIAL['agents']]
checks=[];errors=[];server=None;browser=None;page=None;p=None;success=False;failure=None

def check(name,condition=True):
    assert condition,name
    checks.append(name);print('PASS',name,flush=True)

def snap(page):return page.evaluate('simclone.snapshot()')
def pause(page):
    if page.locator('#pause').inner_text()!='▶':page.locator('#pause').click()
def run(page):
    page.evaluate('window.__rc2Hidden=false')
    page.locator('[data-speed="5"]').click()
    if page.locator('#pause').inner_text()=='▶':page.locator('#pause').click()
def close(page):
    if page.locator('#dialog').evaluate('(e)=>e.open'):page.locator('#dialog-close').click()
def select(page,person):
    close(page)
    quick=page.locator(f'[data-quick-person="{person}"]')
    if quick.is_visible():quick.click()
    else:
        roster=page.locator('#roster')
        (roster if roster.is_visible() else page.locator('[data-nav="people"]')).click()
        page.locator(f'[data-person="{person}"]').first.click()
    desktop=page.locator('#rust')
    (desktop if desktop.is_visible() else page.locator('[data-nav="rust"]')).click()
def tier(page,n):
    target=page.locator(f'[data-craft-tier="{n}"]')
    if target.get_attribute('open') is None:target.locator('summary').first.click()
def item_signature(state):
    return [(i['id'],i['kind'],i['createdBy'],i.get('craft')) for i in state['rustPossessions']['items']]
def no_overflow(page):
    return page.evaluate('document.documentElement.scrollWidth<=innerWidth+1 && document.querySelector("#dialog-body").scrollWidth<=document.querySelector("#dialog-body").clientWidth+1')

def boot_offline(page,saved):
    from browser_fixture import fixture,storage
    storage(page,saved)
    page.evaluate("window.__rc2Hidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__rc2Hidden});")
    page.set_content(fixture(default_mode='independent'),wait_until='load')
    page.wait_for_function("window.simclone?.uiVersion==='0.5.0'")
    pause(page)

try:
    if ARGS.public:
        assert len(SHA)==40,'public proof requires exact RELEASE_SHA'
        BASE=os.environ['PAGE_URL'].rstrip('/')
    elif ARGS.native:
        class QuietHandler(SimpleHTTPRequestHandler):
            def log_message(self,*args):pass
        server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT)))
        Thread(target=server.serve_forever,daemon=True).start()
        BASE=f'http://127.0.0.1:{server.server_port}'
    else:BASE=None
    p=sync_playwright().start()
    exe='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None
    browser=p.chromium.launch(executable_path=exe,headless=True,args=['--no-sandbox'])
    sizes=[(1440,1000),(390,844)]
    for width,height in [s for s in sizes if ARGS.width is None or s[0]==ARGS.width]:
        context=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<700,has_touch=True)
        page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_default_timeout(30000)
        if BASE:
            page.add_init_script("window.__rc2Hidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__rc2Hidden});"
                "if(!sessionStorage.getItem('rc2-proof-seeded')){localStorage.clear();localStorage.setItem('simclone:world:v1',"+json.dumps(SAVED)+");sessionStorage.setItem('rc2-proof-seeded','1');}")
            response=page.goto(BASE+'/?release='+SHA,wait_until='load',timeout=60000)
            check(f'{width} {MODE}: HTTP response',response is not None and response.ok)
            page.wait_for_function("window.simclone?.uiVersion==='0.5.0'");pause(page)
            # Verify actual deployed bytes, not just a title or a status label.
            for path in ['index.html','src/engine.mjs','src/ux.mjs','src/craft-training.mjs','src/crafting-ui.mjs','src/crafting-ui.css','src/rust-stations.mjs','src/individual-home-planning.mjs','src/production-planning.mjs','src/app.mjs']:
                expected=(ROOT/path).read_bytes();actual=None
                for attempt in range(4):
                    r=context.request.get(BASE+'/'+path+'?release='+SHA,headers={'Cache-Control':'no-cache'})
                    if r.ok:actual=r.body()
                    if actual==expected:break
                    if attempt<3:time.sleep(2)
                check(f'{width} {MODE}: exact bytes {path}',actual==expected)
        else:boot_offline(page,SAVED)
        initial=snap(page)
        check(f'{width}: native Independent world and real personal houses',initial['worldMode']['kind']=='independent' and len(page.evaluate('simclone.personalHomes()'))==2)
        check(f'{width}: seed retained real quality/mastery',item_signature(initial)==item_signature(INITIAL))
        select(page,A)
        check(f'{width}: all 38 recipes and six tiers',page.locator('[data-recipe-id]').count()==38 and page.locator('[data-craft-tier]').count()==6)
        check(f'{width}: personal advanced unlock visible',page.locator('[data-recipe-id="STONE_AXE_T1"]').get_attribute('data-known')=='true')
        check(f'{width}: unknown T5 remains disabled',page.locator('[data-ux="craft-item"][data-recipe="STONE_AXE_T5"]').is_disabled())
        armor=next(i for i in initial['rustPossessions']['items'] if i['kind']=='HIDE_ARMOR')
        row=page.locator(f'.rust-bag-grid [data-item-id="{armor["id"]}"]')
        check(f'{width}: gear has creator and exact stored quality',row.locator('[data-craft-quality]').get_attribute('data-craft-quality')==str(armor['craft']['quality']) and 'Original' in row.inner_text())
        check(f'{width}: gear is not placeable',row.locator('[data-ux="place-station"]').count()==0)
        check(f'{width}: item name is visually rendered',row.locator(':scope > b').is_visible() and row.locator(':scope > b').inner_text()=='เกราะหนัง')
        check(f'{width}: stored tier is visually rendered',row.locator('.rc2-item-score > b').is_visible() and row.locator('.rc2-item-score > b').inner_text()=='T'+str(armor['craft']['tier']))
        row.screenshot(path=str(OUT/f'{width}-crafted-gear.png'))
        page.screenshot(path=str(OUT/f'{width}-crafter-inventory.png'))
        row.locator('[data-ux="equip-craft-gear"]').click()
        equipped=snap(page)['rustPossessions']['equipment']
        check(f'{width}: real gear equip keeps hand tool',any(e['agentId']==A and e.get('slot')=='ARMOR' and e['itemId']==armor['id'] for e in equipped) and any(e['agentId']==A and e.get('slot','hand')=='hand' for e in equipped))
        # The teacher and pupil begin within the real command's range.
        page.locator('#rc2-teach-recipe').select_option('STONE_AXE_T1')
        page.locator('#rc2-teach-student').select_option(str(B))
        page.locator('[data-ux="teach-craft-recipe"]').click()
        taught=next(a for a in snap(page)['agents'] if a['id']==B)['knowledgeState']['recipes']['entries']
        learned=next(e for e in taught if e['recipeId']=='STONE_AXE_T1')
        check(f'{width}: teaching via button preserves source and grants no mastery',learned['learned']['method']=='teaching' and learned['learned']['teacherId']==A and learned['retiredCompletions']==0 and learned['receipts']==[])
        tier(page,1)
        page.locator('[data-recipe-id="STONE_AXE_T1"]').scroll_into_view_if_needed()
        check(f'{width}: crafting UI has no horizontal overflow',no_overflow(page))
        page.screenshot(path=str(OUT/f'{width}-recipe-book.png'))
        before=snap(page);old_next=before['rustPossessions']['nextItem']
        page.locator('[data-ux="craft-item"][data-recipe="STONE_AXE_T1"]').click()
        accepted=snap(page);order=next(o for o in accepted['rustPossessions']['orders'] if o['agentId']==A)
        check(f'{width}: button queues existing frozen order and escrows one ingredient',order['recipe']=='STONE_AXE_T1' and order['work']==0 and len(order['reservedItems'])==1 and 'craftSpec' in order)
        close(page);run(page)
        page.wait_for_function("id=>{const a=simclone.snapshot().agents.find(a=>a.id===id);return a.task?.kind==='CRAFT';}",arg=A,timeout=30000)
        page.screenshot(path=str(OUT/f'{width}-world-crafting.png'))
        page.wait_for_function("q=>simclone.snapshot().rustPossessions.items.some(i=>i.id>=q.next&&i.createdBy===q.a&&i.craft?.recipeId==='STONE_AXE_T1')",arg={'a':A,'next':old_next},timeout=60000)
        pause(page);made=snap(page);output=next(i for i in made['rustPossessions']['items'] if i['id']>=old_next and i['createdBy']==A)
        check(f'{width}: real path/work produces the same accepted roll ticket',output['craft']['ticket']==order['craftSpec']['ticket'] and output['craft']['orderId']==order['id'] and output['craft']['tier']==1 and len(output['craft']['abilities'])>0)
        select(page,B);tier(page,1)
        check(f'{width}: pupil sees personal teacher provenance','เรียนจาก Original' in page.locator('[data-recipe-id="STONE_AXE_T1"]').inner_text())
        page.locator('[data-ux="craft-train"][data-recipe="STONE_AXE"]').click()
        trained=snap(page);pupil=next(a for a in trained['agents'] if a['id']==B)
        check(f'{width}: practice button only arms bounded preference',pupil['craftTraining']['targetCompletions']-pupil['craftTraining']['startCompletions']==2 and not any(o['agentId']==B for o in trained['rustPossessions']['orders']))
        close(page);run(page)
        page.wait_for_function("id=>{const s=simclone.snapshot(),a=s.agents.find(a=>a.id===id),r=a.knowledgeState.recipes?.entries.find(e=>e.recipeId==='STONE_AXE');return r&&r.retiredCompletions+r.receipts.length===2&&!s.rustPossessions.orders.some(o=>o.agentId===id);}",arg=B,timeout=60000)
        pause(page);completed=snap(page);pupil=next(a for a in completed['agents'] if a['id']==B)
        outputs=[i for i in completed['rustPossessions']['items'] if i['createdBy']==B and i['kind']=='STONE_AXE']
        check(f'{width}: quota means two physical outputs and two real receipts',len(outputs)==2 and len({i['craft']['ticket'] for i in outputs})==2)
        last=completed['tick'];close(page);run(page)
        page.wait_for_function('t=>simclone.snapshot().tick>=t+70',arg=last,timeout=30000);pause(page)
        final=snap(page)
        check(f'{width}: practice stops instead of filling bags or escalating tiers',[(i['id'],i['craft']) for i in final['rustPossessions']['items'] if i['createdBy']==B and i['kind']=='STONE_AXE']==[(i['id'],i['craft']) for i in outputs])
        select(page,B)
        check(f'{width}: completed practice is visible',page.locator('[data-training-status]').get_attribute('data-training-status')=='COMPLETE')
        check(f'{width}: final modal still fits',no_overflow(page))
        page.locator('[data-training-status]').scroll_into_view_if_needed()
        page.screenshot(path=str(OUT/f'{width}-practice-complete.png'))
        close(page);page.locator('#menu').click();page.locator('[data-action="save"]').click()
        saved=page.evaluate("localStorage.getItem('simclone:world:v1')")
        check(f'{width}: real Save control preserves outputs',item_signature(json.loads(saved))==item_signature(final))
        (OUT/f'{width}-final-world.json').write_text(saved)
        if BASE:
            page.reload(wait_until='load');page.wait_for_function("window.simclone?.uiVersion==='0.5.0'");pause(page)
        else:
            page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));boot_offline(page,saved)
        restored=snap(page)
        check(f'{width}: reload preserves every crafted instance and ticket',item_signature(restored)==item_signature(final))
        check(f'{width}: reload preserves practice quota and receipts',next(a for a in restored['agents'] if a['id']==B)['craftTraining']==pupil['craftTraining'])
        check(f'{width}: no browser runtime errors',not errors)
        context.close()
    browser.close();browser=None
    success=True
except Exception as exc:
    failure=str(exc)
    raise
finally:
    if browser:
        try:
            if page:page.screenshot(path=str(OUT/'failure.png'))
            browser.close()
        except Exception:pass
    if p:p.stop()
    if server:server.shutdown()
    (OUT/'report.json').write_text(json.dumps({'mode':MODE,'releaseSha':SHA,'result':'SAT' if success else ('UNKNOWN' if failure and 'ERR_BLOCKED_BY_ADMINISTRATOR' in failure else 'VIOL'),'failure':failure,'checks':checks,'errors':errors},ensure_ascii=False,indent=2))
print(json.dumps({'mode':MODE,'checks':len(checks),'result':'SAT'},ensure_ascii=False),flush=True)
