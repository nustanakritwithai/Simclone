"""RC3.1 real-button Hunt -> physical Blueprint -> Learn -> Save/reload.
Prepared fixture starts with a qualified high-level tester, not free Blueprint
items or known advanced recipes. No browser-side command or state writes.
"""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright
import argparse, json, os, subprocess, time
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--native',action='store_true');parser.add_argument('--public',action='store_true');parser.add_argument('--width',type=int)
ARGS=parser.parse_args();assert not (ARGS.native and ARGS.public)
MODE='public' if ARGS.public else 'native' if ARGS.native else 'offline'
SHA=os.environ.get('RELEASE_SHA','local');OUT=ROOT/('evidence-public-blueprint' if ARGS.public else 'evidence-ui/blueprint-'+MODE);OUT.mkdir(parents=True,exist_ok=True)
SAVED=subprocess.check_output(['node','scripts/blueprint-fixture.mjs'],cwd=ROOT,text=True)
checks=[];errors=[];server=None;browser=None;page=None;p=None;success=False;failure=None

def check(name,condition=True):
    assert condition,name
    checks.append(name);print('PASS',name,flush=True)
def snap(page):return page.evaluate('simclone.snapshot()')
def pause(page):
    if page.locator('#pause').inner_text()!='▶':page.locator('#pause').click()
def close(page):
    if page.locator('#dialog').evaluate('(e)=>e.open'):page.locator('#dialog-close').click()
def open_rust(page,agent):
    close(page)
    quick=page.locator(f'[data-quick-person="{agent}"]')
    if quick.is_visible():quick.click()
    else:
        roster=page.locator('#roster');(roster if roster.is_visible() else page.locator('[data-nav="people"]')).click()
        page.locator(f'[data-person="{agent}"]').first.click()
    desktop=page.locator('#rust');(desktop if desktop.is_visible() else page.locator('[data-nav="rust"]')).click()
def offline(page,saved):
    from browser_fixture import fixture,storage
    storage(page,saved)
    page.evaluate("window.__blueprintHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__blueprintHidden});")
    page.set_content(fixture(default_mode='independent'),wait_until='load');page.wait_for_function("window.simclone?.uiVersion==='0.5.0'");pause(page)
def no_overflow(page):return page.evaluate('document.documentElement.scrollWidth<=innerWidth+1 && document.querySelector("#dialog-body").scrollWidth<=document.querySelector("#dialog-body").clientWidth+1')
try:
    if ARGS.public:
        assert len(SHA)==40,'exact public SHA required';BASE=os.environ['PAGE_URL'].rstrip('/')
    elif ARGS.native:
        class Quiet(SimpleHTTPRequestHandler):
            def log_message(self,*args):pass
        server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start();BASE=f'http://127.0.0.1:{server.server_port}'
    else:BASE=None
    p=sync_playwright().start();exe='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None
    browser=p.chromium.launch(executable_path=exe,headless=True,args=['--no-sandbox'])
    for width,height in [(w,h) for w,h in [(1440,1000),(390,844)] if ARGS.width is None or w==ARGS.width]:
        context=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<700,has_touch=True)
        page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.set_default_timeout(30000)
        if BASE:
            page.add_init_script("window.__blueprintHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__blueprintHidden});if(!sessionStorage.getItem('blueprint-proof-seeded')){localStorage.clear();localStorage.setItem('simclone:world:v1',"+json.dumps(SAVED)+");sessionStorage.setItem('blueprint-proof-seeded','1');}")
            response=page.goto(BASE+'/?release='+SHA,wait_until='load',timeout=60000);check(f'{width}: {MODE} HTTP',response is not None and response.ok)
            page.wait_for_function("window.simclone?.uiVersion==='0.5.0'");pause(page)
            for path in ['index.html','src/craft-blueprints.mjs','src/adventure-combat-session.mjs','src/adventure-loot-commit.mjs','src/rust-possessions.mjs','src/rust-runtime.mjs','src/craft-recipe-knowledge.mjs','src/crafting-catalog.mjs','src/crafting-ui.mjs','src/adventure-ui.mjs','src/ux.mjs']:
                expected=(ROOT/path).read_bytes();actual=None
                for attempt in range(4):
                    response=context.request.get(BASE+'/'+path+'?release='+SHA,headers={'Cache-Control':'no-cache'})
                    if response.ok:actual=response.body()
                    if actual==expected:break
                    if attempt<3:time.sleep(2)
                check(f'{width}: {MODE} exact bytes {path}',actual==expected)
        else:offline(page,SAVED)
        initial=snap(page);a=initial['agents'][0];aid=a['id']
        check(f'{width}: no seeded Blueprint or advanced knowledge',not any(i['kind']=='RECIPE_BLUEPRINT' for i in initial['rustPossessions']['items']) and a['knowledgeState'].get('recipes') is None)
        monster=sorted([m for m in initial['wildMonsters']['entities'] if m['zoneId']=='z1'],key=lambda m:m['worldMonsterId'])[0]
        box=page.locator('#world').bounding_box();point=page.evaluate('(m)=>simclone.screenPoint(m.x,m.y)',monster);safe=page.evaluate('simclone.safeFrame()');zoom=page.evaluate('simclone.camera().zoom')
        tx=(safe['left']+safe['right'])/2;ty=(safe['top']+safe['bottom'])/2
        page.mouse.move(box['x']+tx,box['y']+ty);page.mouse.down();page.mouse.move(box['x']+tx+tx-point['x'],box['y']+ty+ty-(point['y']-20*zoom),steps=10);page.mouse.up();page.wait_for_timeout(100)
        point=page.evaluate('(m)=>simclone.screenPoint(m.x,m.y)',monster);zoom=page.evaluate('simclone.camera().zoom');q={'x':point['x'],'y':point['y']-20*zoom}
        hit=page.evaluate('(q)=>simclone.worldObjectTargetAtScreen(q.x,q.y)',q)
        check(f'{width}: actual canvas resolves target',hit and hit.get('id')==monster['worldMonsterId'])
        page.mouse.click(box['x']+q['x'],box['y']+q['y']);page.wait_for_selector('[data-action="hunt-monster"]');page.locator('[data-action="hunt-monster"]').click()
        hunted=snap(page)['agents'][0];check(f'{width}: Hunt creates real path without teleport',(hunted['x'],hunted['y'])==(a['x'],a['y']) and len(hunted['task']['path'])>0)
        page.locator('[data-speed="5"]').click();page.evaluate('window.__blueprintHidden=false')
        if page.locator('#pause').inner_text()=='▶':page.locator('#pause').click()
        page.wait_for_function('simclone.snapshot().agents[0].adventureEncounter?.status==="READY"',timeout=30000);pause(page)
        page.locator('[data-adv-action="start-combat"]').click();started=snap(page)['agents'][0]['adventureCombat'];offer=started['blueprintOffer']
        check(f'{width}: new combat stores deterministic offer but no grant',offer['recipeId']=='EMBER_CHARM' and not any(i['kind']=='RECIPE_BLUEPRINT' for i in snap(page)['rustPossessions']['items']))
        for turn in range(100):
            if snap(page)['agents'][0]['adventureCombat']['status']!='ACTIVE':break
            page.locator('[data-adv-action="attack"]').click()
        terminal=snap(page)['agents'][0]['adventureCombat'];check(f'{width}: actual attack reaches VERIFIED victory',terminal['status']=='VICTORY' and terminal['reward']['evidence']=='VERIFIED')
        check(f'{width}: Blueprint result is visibly labelled',page.locator('[data-blueprint-drop="EMBER_CHARM"]').is_visible())
        page.screenshot(path=str(OUT/f'{width}-victory.png'))
        page.locator('[data-adv-action="claim-loot"]').click();claimed=snap(page);item=next(i for i in claimed['rustPossessions']['items'] if i['kind']=='RECIPE_BLUEPRINT')
        check(f'{width}: claim creates actual Rust Blueprint',item['location']=={'kind':'bag','agentId':aid} and item['blueprint']['offer']==offer)
        page.locator('[data-adv-action="finish-result"]').click();check(f'{width}: Continue closes result',snap(page)['agents'][0].get('adventureCombat') is None)
        open_rust(page,aid);card=page.locator(f'[data-item-id="{item["id"]}"]').first
        card.scroll_into_view_if_needed()
        check(f'{width}: inventory recipe and tier actually visible',card.locator('[data-blueprint-recipe="EMBER_CHARM"] strong').is_visible() and card.locator('.rc2-item-score b').is_visible())
        check(f'{width}: learn button enabled',not card.locator('[data-ux="learn-blueprint"]').is_disabled())
        check(f'{width}: dialog fits viewport',no_overflow(page));page.screenshot(path=str(OUT/f'{width}-physical-blueprint.png'))
        before=snap(page);page.locator('[data-ux="learn-blueprint"]').click();after=snap(page);learner=after['agents'][0]
        check(f'{width}: Learn consumes physical item once',not any(i['id']==item['id'] for i in after['rustPossessions']['items']))
        entry=next(e for e in learner['knowledgeState']['recipes']['entries'] if e['recipeId']=='EMBER_CHARM')
        check(f'{width}: recipe gains exact item provenance',entry['learned']['method']=='blueprint' and entry['learned']['itemId']==item['id'] and entry['learned']['blueprint']==item['blueprint'])
        check(f'{width}: learning gives no mastery or XP',entry['retiredCompletions']==0 and entry['receipts']==[] and learner['skills']==before['agents'][0]['skills'])
        check(f'{width}: no second use button',page.locator('[data-ux="learn-blueprint"]').count()==0)
        group=page.locator('[data-craft-tier="1"]')
        if group.get_attribute('open') is None:group.locator('summary').first.click()
        recipe=page.locator('[data-recipe-id="EMBER_CHARM"]');recipe.scroll_into_view_if_needed()
        check(f'{width}: known recipe and Blueprint provenance visible',recipe.get_attribute('data-known')=='true' and 'พิมพ์เขียว' in recipe.inner_text())
        check(f'{width}: learning still requires station and real materials',recipe.locator('[data-ux="craft-item"]').is_disabled())
        page.screenshot(path=str(OUT/f'{width}-learned-recipe.png'))
        close(page);page.locator('#menu').click();page.locator('[data-action="save"]').click();saved=page.evaluate("localStorage.getItem('simclone:world:v1')")
        check(f'{width}: actual Save retains consumed item and knowledge',json.loads(saved)['rustPossessions']['items']==after['rustPossessions']['items'] and json.loads(saved)['agents'][0]['knowledgeState']['recipes']==learner['knowledgeState']['recipes'])
        (OUT/f'{width}-final-world.json').write_text(saved)
        if BASE:page.reload(wait_until='load');page.wait_for_function("window.simclone?.uiVersion==='0.5.0'");pause(page)
        else:page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));offline(page,saved)
        restored=snap(page);check(f'{width}: reload retains source and never resurrects Blueprint',restored['rustPossessions']['items']==after['rustPossessions']['items'] and restored['agents'][0]['knowledgeState']['recipes']==learner['knowledgeState']['recipes'])
        check(f'{width}: no browser errors',not errors);context.close()
    browser.close();browser=None;success=True
except Exception as exc:
    failure=str(exc)
    try:
        if page:(OUT/'failure-world.json').write_text(json.dumps(snap(page),ensure_ascii=False))
    except Exception:pass
    raise
finally:
    if browser:
        try:
            if page:page.screenshot(path=str(OUT/'failure.png'))
            browser.close()
        except Exception:pass
    if p:p.stop()
    if server:server.shutdown()
    (OUT/'report.json').write_text(json.dumps({'mode':MODE,'releaseSha':SHA,'result':'SAT' if success else ('UNKNOWN' if failure and 'ERR_BLOCKED_BY_ADMINISTRATOR' in failure else 'VIOL'),'checks':checks,'errors':errors,'failure':failure},ensure_ascii=False,indent=2))
print(json.dumps({'mode':MODE,'checks':len(checks),'result':'SAT'}),flush=True)
