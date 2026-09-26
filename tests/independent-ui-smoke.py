"""Independent UI smoke: offline Storage double by default; --native uses local HTTP.
Evidence scopes stay separate. Neither scope proves public Pages or physical Android.
"""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from functools import partial
import argparse, json, subprocess
from browser_fixture import fixture, storage
NATIVE=argparse.ArgumentParser()
NATIVE.add_argument("--native", action="store_true")
NATIVE.add_argument("--width",type=int)
ARGS=NATIVE.parse_args();NATIVE=ARGS.native
HTML=fixture(default_mode="independent")
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'evidence-ui'/'independent';OUT.mkdir(parents=True,exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
handler=partial(Quiet,directory=str(ROOT))
server=ThreadingHTTPServer(('127.0.0.1',0),handler) if NATIVE else None
if server:
    thread=Thread(target=server.serve_forever,daemon=True);thread.start()
url=f'http://127.0.0.1:{server.server_port}/' if server else None
scope='native local HTTP/storage' if NATIVE else 'offline DOM / explicit Storage double'
print('EVIDENCE SCOPE:',scope,flush=True)
# This fixture was earned through real engine work, without prebuilt structures or free items.
script="import{createWorld,step,serialize}from './src/engine.mjs';const s=createWorld(230926,{mode:'independent'});step(s,1400);console.log(serialize(s));"
earned=subprocess.check_output(['node','--input-type=module','-e',script],cwd=ROOT,text=True).strip()
checks=[];errors=[]
def check(name,condition=True):
    assert condition,name
    checks.append(name);print('PASS',name,flush=True)
def pause(page):
    if page.locator('#pause').inner_text()!='▶':page.locator('#pause').click()
def boot(page,saved=None):
    if NATIVE:
        # Seed the requested save before app modules execute. Writing localStorage
        # and then reloading is incorrect here because app.mjs saves the current
        # world on pagehide and would overwrite the fixture before reload.
        if saved is not None:
            page.evaluate('(s)=>sessionStorage.setItem("__simclone_test_seed",s)',saved)
        page.goto(url,wait_until='load')
    else:
        page.goto('about:blank');storage(page,saved);page.set_content(HTML)
    page.wait_for_function('window.simclone && simclone.snapshot().worldMode?.kind === "independent"')
def snap(page):return page.evaluate('simclone.snapshot()')
def select_person(page,person_id):
    quick=page.locator(f'[data-quick-person="{person_id}"]')
    if quick.is_visible():quick.click()
    else:
        page.locator('#roster').click();page.locator(f'[data-person="{person_id}"]').first.click()
def visual_point(page,x,y,offset):
    return page.evaluate('(q)=>{const p=simclone.screenPoint(q.x,q.y),b=document.querySelector("#world").getBoundingClientRect();return{x:b.x+p.x,y:b.y+p.y-q.offset*simclone.camera().zoom}}',dict(x=x,y=y,offset=offset))
try:
 with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,headless=True,args=['--no-sandbox'])
    for width,height in [(w,h) for w,h in [(1440,1000),(390,844),(320,740),(844,390)] if ARGS.width is None or ARGS.width==w]:
        context=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<=700,has_touch=True)
        page=context.new_page()
        if NATIVE:
            page.add_init_script("""const seed=sessionStorage.getItem('__simclone_test_seed');if(seed!==null){localStorage.setItem('simclone:world:v1',seed);sessionStorage.removeItem('__simclone_test_seed');}""")
        page.on('pageerror',lambda e:errors.append(str(e)));boot(page);pause(page)
        first=snap(page)
        check(f'{width}: new browser starts independent with no central buildings',first['buildings']==[] and first['stock']=={'food':0,'wood':0,'stone':0})
        check(f'{width}: six separated people',len({(a['x'],a['y']) for a in first['agents']})==6)
        check(f'{width}: no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
        check(f'{width}: individual mode does not advertise a central village','หมู่บ้านต้นกำเนิด' not in page.locator('.settlement').inner_text())
        page.screenshot(path=str(OUT/f'fresh-{width}.png'))
        # Actual canvas taps, not calls to a menu-opening test hook.
        target=page.evaluate('''()=>{const s=simclone.snapshot(),box=document.querySelector('#world').getBoundingClientRect(),z=simclone.camera().zoom;for(const n of s.nodes){const p=simclone.screenPoint(n.x,n.y),x=box.x+p.x,y=box.y+p.y-(n.type==='wood'?(n.amount>0?42:5):8)*z;if(x<10||x>innerWidth-10||y<10||y>innerHeight-10||document.elementFromPoint(x,y)?.id!=='world')continue;const hit=simclone.worldObjectTargetAtScreen(x-box.x,y-box.y);if(hit?.type==='resource'&&hit.id===n.id&&s.agents.every(a=>{const q=simclone.screenPoint(a.x,a.y);return Math.hypot(p.x-q.x,(y-box.y)-(q.y-19*z))>40}))return {id:n.id,x,y};}return null;}''')
        check(f'{width}: at least one resource is directly tappable',target is not None)
        before=snap(page);page.mouse.click(target['x'],target['y']);page.wait_for_selector('#dialog[open] [data-resource]')
        check(f'{width}: canvas resource tap resolves exact instance without mutation',page.locator('[data-resource]').get_attribute('data-resource')==str(target['id']) and snap(page)==before)
        page.locator('#dialog-close').click()

        if width==1440:
            burst=page.evaluate('simclone.worldFeedback().lifeBursts[0]');select_person(page,burst['agentId'])
            page.wait_for_timeout(150);before=snap(page);point=visual_point(page,burst['x'],burst['y'],30)
            page.mouse.click(point['x'],point['y']);page.wait_for_selector('#dialog[open] [data-event-evidence-status]')
            check('UX1: visible birth marker opens existing evidence without mutation',page.locator('#dialog').get_attribute('data-kind')=='event' and snap(page)==before)
            page.locator('#dialog-close').click()
        # Restore a real earned world; offline scope explicitly uses the Storage double.
        boot(page,earned);page.wait_for_function('window.simclone && simclone.personalHomes().length===6');pause(page)
        page.screenshot(path=str(OUT/f'earned-world-{width}.png'))
        homes=page.evaluate('simclone.personalHomes()');check(f'{width}: six authoritative owned homes',len(homes)==6 and all(h['complete'] for h in homes))
        if page.locator('[data-quick-person="1"]').is_visible():
            page.locator('[data-quick-person="1"]').click()
        else:
            page.locator('#roster').click();page.locator('[data-person="1"]').first.click()
        if width<=700:page.locator('[data-ux="expand"]').click()
        page.wait_for_selector('#personal-home-summary:not([hidden])')
        check(f'{width}: inspector discloses actual personal stock',page.locator('.personal-stock').get_attribute('data-owner')=='1')
        page.screenshot(path=str(OUT/f'owner-{width}.png'))
        page.locator('[data-own-home="1"]').click()
        check(f'{width}: own home opens with correct authoritative owner',page.locator('[data-house][data-owner="1"]').count()==1)
        page.screenshot(path=str(OUT/f'home-{width}.png'))
        page.locator('#dialog-close').click();page.locator('[data-ui="close"]').click()
        before=snap(page);page.locator('#pause').click();page.wait_for_function('(t)=>simclone.snapshot().tick>t',arg=before['tick']);pause(page)
        check(f'{width}: real browser simulation advances after load',snap(page)['tick']>before['tick'])
        page.locator('#menu').click();page.locator('[data-action="save"]').click();page.locator('#dialog-close').click()
        stored=page.evaluate('JSON.parse(localStorage.getItem("simclone:world:v1"))');check(f'{width}: {scope} keeps independent schema',stored['version']=='0.6.0' and len(stored['rustMaterials']['personalStores'])>=6)
        if NATIVE:
            page.reload(wait_until='load');page.wait_for_function('window.simclone');pause(page)
        else:
            boot(page,json.dumps(stored));pause(page)
        check(f'{width}: {scope} restore keeps all house identities',len(page.evaluate('simclone.personalHomes()'))==6)
        if width==1440:
            # Synthetic drop-location fixture using an actually crafted Hammer; no new item is created.
            drop=json.loads(earned);owner=next(a for a in drop['agents'] if a['id']==1)
            item=next(i for i in drop['rustPossessions']['items'] if i['kind']=='HAMMER' and i['createdBy']==1)
            item['location']={'kind':'drop','sourceAgentId':1,'tick':drop['tick'],'x':owner['x'],'y':owner['y']}
            drop['rustPossessions']['equipment']=[e for e in drop['rustPossessions']['equipment'] if e['itemId']!=item['id']]
            boot(page,json.dumps(drop));pause(page);select_person(page,1);page.wait_for_timeout(150)
            before=snap(page);point=visual_point(page,owner['x'],owner['y'],7);page.mouse.click(point['x'],point['y'])
            page.wait_for_selector('#dialog[open] [data-drop]')
            check('UX1: actual drop tap identifies exact instance and creator',page.locator('[data-drop]').get_attribute('data-drop')==str(item['id']) and 'createdBy #1' in page.locator('#dialog-body').inner_text())
            page.locator('[data-pickup-world]').click();after=snap(page)
            picked=next(i for i in after['rustPossessions']['items'] if i['id']==item['id'])
            check('UX1: pickup uses engine command and never duplicates the item',picked['location']=={'kind':'bag','agentId':1} and len(after['rustPossessions']['items'])==len(before['rustPossessions']['items']))
        context.close()
    check('no browser JavaScript errors',not errors)
    browser.close()
finally:
 if server: server.shutdown();server.server_close()
(OUT/('results-'+str(ARGS.width)+'.json' if ARGS.width else 'results.json')).write_text(json.dumps({'result':'PASS','checks':checks,'count':len(checks),'pageErrors':errors,'evidenceScope':scope+'; Chromium desktop/mobile emulation; earned engine fixture; not public Pages, GPU profiling or physical Android'},ensure_ascii=False,indent=2))
print('TOTAL',len(checks),'PASS',flush=True)
