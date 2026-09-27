"""D3 Adventure journey browser visual proof.

Runs the released SWA public fixture through the real Hunt/Combat/Lifecycle UI
on desktop and mobile. Screenshots are visual evidence; phase assertions read
only the D3 presentation projection.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, subprocess

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'evidence-display-d3'
OUT.mkdir(exist_ok=True)

from browser_fixture import fixture
HTML=fixture(default_mode='independent')
SAVED=subprocess.check_output(['node','scripts/swa7-public-fixture.mjs'],cwd=ROOT,text=True).strip()

def snap(page): return page.evaluate('simclone.snapshot()')
def view(page): return page.evaluate('simclone.adventureJourneyVisuals()')

def paused(page):
    if page.locator('#pause').inner_text()!='▶': page.locator('#pause').click()

def running(page):
    if page.locator('#pause').inner_text()=='▶': page.locator('#pause').click()

def boot(page):
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.evaluate("""saved=>{
      const map=new Map([['simclone:world:v1',saved]]);
      Object.defineProperty(window,'localStorage',{configurable:true,value:{
        getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v))
      }});
      window.__d3Hidden=true;
      Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__d3Hidden});
    }""",SAVED)
    page.set_content(HTML,wait_until='load')
    page.wait_for_function("window.simclone?.uiVersion==='0.5.0'")
    paused(page)
    return errors

def pan_point_to(page,x,y,target_x=None,target_y=None):
    box=page.locator('#world').bounding_box()
    safe=page.evaluate('simclone.safeFrame()')
    if target_x is None: target_x=(safe['left']+safe['right'])/2
    if target_y is None: target_y=(safe['top']+safe['bottom'])/2
    p=page.evaluate('(q)=>simclone.screenPoint(q.x,q.y)',{'x':x,'y':y})
    sx=(safe['left']+safe['right'])/2
    sy=(safe['top']+safe['bottom'])/2
    page.mouse.move(box['x']+sx,box['y']+sy)
    page.mouse.down()
    page.mouse.move(box['x']+sx+(target_x-p['x']),box['y']+sy+(target_y-p['y']),steps=10)
    page.mouse.up()
    page.wait_for_timeout(120)

def screenshot(page,label,phase):
    page.wait_for_timeout(80)
    page.screenshot(path=str(OUT/(label+'-'+phase+'.png')))

def run_flow(browser,label,width,height,mobile):
    context=browser.new_context(viewport={'width':width,'height':height},is_mobile=mobile,has_touch=mobile)
    page=context.new_page()
    errors=boot(page)
    initial=snap(page)
    hero=initial['agents'][0]
    monster=sorted([m for m in initial['wildMonsters']['entities'] if m['zoneId']=='z1' and m['status']=='IDLE'],key=lambda m:m['worldMonsterId'])[0]
    old_id=monster['worldMonsterId'];old_epoch=monster['spawnEpoch']

    # Select the physical Monster through the real canvas path.
    pan_point_to(page,monster['x'],monster['y'])
    box=page.locator('#world').bounding_box()
    mp=page.evaluate('(m)=>simclone.screenPoint(m.x,m.y)',monster)
    zoom=page.evaluate('simclone.camera().zoom');tap_y=mp['y']-20*zoom
    hit=page.evaluate('(q)=>simclone.worldTargetAtScreen(q.x,q.y)',{'x':mp['x'],'y':tap_y})
    assert hit and hit['kind']=='monster' and hit['id']==old_id,(label,'initial-hit',hit)
    page.mouse.click(box['x']+mp['x'],box['y']+tap_y)
    page.wait_for_selector('#dialog[open][data-kind="monster"] [data-action="hunt-monster"]')

    page.locator('[data-action="hunt-monster"]').click()
    hunt=view(page)
    assert len(hunt['journeys'])==1 and hunt['journeys'][0]['phase']=='HUNT',(label,hunt)
    assert hunt['journeys'][0]['targetWorldMonsterId']==old_id
    assert len(hunt['journeys'][0]['path'])>1
    # Frame the target end of the authoritative route for visual proof.
    pan_point_to(page,monster['x'],monster['y'])
    screenshot(page,label,'01-hunt')

    # Complete Hunt using the real simulation.
    page.locator('[data-speed="5"]').click()
    page.evaluate("window.__d3Hidden=false");running(page)
    page.wait_for_function('(id)=>simclone.snapshot().agents[0].adventureEncounter?.worldMonsterId===id',arg=old_id,timeout=20000)
    paused(page);page.evaluate("window.__d3Hidden=true")
    ready=view(page)
    assert ready['journeys'][0]['phase']=='READY',(label,ready)
    ready_target=ready['journeys'][0]['target']
    pan_point_to(page,ready_target['x'],ready_target['y'])
    screenshot(page,label,'02-ready')

    page.wait_for_selector('[data-adv-action="start-combat"]')
    page.locator('[data-adv-action="start-combat"]').click()
    engaged=view(page)
    assert engaged['journeys'][0]['phase']=='ENGAGED',(label,engaged)
    assert engaged['journeys'][0]['monsterStatus']=='ENGAGED'
    screenshot(page,label,'03-engaged')

    # One real attack must surface verified last-turn damage/HP evidence.
    page.locator('[data-adv-action="attack"]').click()
    damaged=view(page)
    assert damaged['journeys'][0]['phase'] in ('ENGAGED','VICTORY'),(label,damaged)
    assert damaged['journeys'][0]['lastTurn'] is not None
    assert damaged['journeys'][0]['lastTurn']['monsterHpAfter'] is not None
    screenshot(page,label,'04-damage')

    for _ in range(100):
        combat=snap(page)['agents'][0]['adventureCombat']
        if combat['status']!='ACTIVE': break
        page.locator('[data-adv-action="attack"]').click()
        page.wait_for_timeout(20)

    terminal=snap(page)
    defeated=next(m for m in terminal['wildMonsters']['entities'] if m['worldMonsterId']==old_id)
    victory=view(page)
    assert terminal['agents'][0]['adventureCombat']['status']=='VICTORY'
    assert victory['journeys'][0]['phase']=='VICTORY',(label,victory)
    assert any(c['kind']=='DEFEAT' for c in victory['lifecycle']),(label,victory)
    assert defeated['status']=='DEFEATED' and defeated['hpCurrent']==0
    oldp=page.evaluate('(m)=>simclone.screenPoint(m.x,m.y)',defeated)
    oldhit=page.evaluate('(q)=>simclone.worldTargetAtScreen(q.x,q.y)',{'x':oldp['x'],'y':oldp['y']-20*page.evaluate('simclone.camera().zoom')})
    assert oldhit is None or not(oldhit['kind']=='monster' and oldhit['id']==old_id),(label,'defeated-hit',oldhit)
    pan_point_to(page,defeated['x'],defeated['y'])
    screenshot(page,label,'05-victory-defeat')

    page.wait_for_selector('[data-adv-action="finish-result"]')
    page.locator('[data-adv-action="finish-result"]').click()
    assert snap(page)['agents'][0].get('adventureCombat') is None

    page.evaluate("window.__d3Hidden=false");running(page)
    page.wait_for_function("""q=>simclone.snapshot().wildMonsters.entities.some(m=>
      m.zoneId===q.zoneId&&m.spawnSlot===q.spawnSlot&&m.spawnEpoch===q.epoch+1&&m.status==='IDLE')""",
      arg={'zoneId':defeated['zoneId'],'spawnSlot':defeated['spawnSlot'],'epoch':old_epoch},timeout=20000)
    paused(page);page.evaluate("window.__d3Hidden=true")
    final=snap(page)
    respawned=next(m for m in final['wildMonsters']['entities'] if m['zoneId']==defeated['zoneId'] and m['spawnSlot']==defeated['spawnSlot'])
    respawn_view=view(page)
    assert respawned['spawnEpoch']==old_epoch+1 and respawned['worldMonsterId']!=old_id
    assert any(c['kind']=='RESPAWN' and c['worldMonsterId']==respawned['worldMonsterId'] for c in respawn_view['lifecycle']),(label,respawn_view)
    pan_point_to(page,respawned['x'],respawned['y'])
    screenshot(page,label,'06-respawn')

    assert not errors,(label,errors)
    context.close()
    return {'old':old_id,'new':respawned['worldMonsterId'],'epoch':respawned['spawnEpoch']}

with sync_playwright() as p:
    exe='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None
    browser=p.chromium.launch(executable_path=exe,headless=True,args=['--no-sandbox'])
    desktop=run_flow(browser,'desktop-1440x1000',1440,1000,False)
    mobile=run_flow(browser,'mobile-390x844',390,844,True)
    assert desktop['old']==mobile['old']
    assert desktop['new']==mobile['new']
    browser.close()

(OUT/'results.json').write_text(json.dumps({'result':'PASS','desktop':desktop,'mobile':mobile},ensure_ascii=False,indent=2))
print('D3_VISUAL_PROOF',OUT)
