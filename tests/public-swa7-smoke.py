"""SWA7 public GitHub Pages lifecycle proof.

Loads the deployed PAGE_URL, seeds only a validated localStorage save, then uses
the public canvas/UI/engine path for Monster tap -> Hunt -> Combat -> Victory ->
despawn -> Continue -> deterministic respawn.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os, subprocess

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'evidence-public-swa7'
OUT.mkdir(exist_ok=True)

PAGE_URL=os.environ['PAGE_URL'].rstrip('/')
RELEASE_SHA=os.environ['RELEASE_SHA']
URL=f"{PAGE_URL}/?release={RELEASE_SHA}"
SAVED=subprocess.check_output(
    ['node','scripts/swa7-public-fixture.mjs'],
    cwd=ROOT,text=True
).strip()

checks=[]
errors=[]
def check(name,condition=True):
    assert condition,name
    checks.append(name)
    print('PASS',name,flush=True)

def snap(page):
    return page.evaluate('simclone.snapshot()')

def paused(page):
    if page.locator('#pause').inner_text()!='▶':
        page.locator('#pause').click()

def running(page):
    if page.locator('#pause').inner_text()=='▶':
        page.locator('#pause').click()

with sync_playwright() as p:
    exe='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None
    browser=p.chromium.launch(executable_path=exe,headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    page=context.new_page()
    page.on('pageerror',lambda e:errors.append(str(e)))
    seed_literal=json.dumps(SAVED)
    # Freeze simulation before public modules execute. This mirrors a background
    # tab and prevents autonomy from claiming the deterministic Adventurer
    # before the proof can press the real Pause control.
    page.add_init_script(
        "window.__swa7Hidden=true;"
        "Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__swa7Hidden});"
        "localStorage.clear();localStorage.setItem('simclone:world:v1',"+seed_literal+");"
    )
    response=page.goto(URL,wait_until='load',timeout=60000)
    check('SWA7 public Pages HTTP loads',response is not None and response.ok)
    page.wait_for_function("window.simclone?.version==='0.5.0'",timeout=30000)
    paused(page)

    initial=snap(page)
    world=page.evaluate('simclone.worldSize()')
    check('SWA7 public exact runtime boots Same-World 84x52',
          world.get('profile')=='same-world' and world.get('w')==84 and world.get('h')==52)
    monsters=initial.get('wildMonsters',{}).get('entities',[])
    check('SWA7 public runtime owns 12 physical Wild Monsters',len(monsters)==12)
    hero=initial['agents'][0]
    check('SWA7 public fixture is a real Adventurer save',
          hero.get('profession')=='adventurer' and hero.get('skills',{}).get('ADVENTURE',0)>0)

    monster=sorted(
        [m for m in monsters if m['zoneId']=='z1' and m['status']=='IDLE'],
        key=lambda m:m['worldMonsterId']
    )[0]
    old_id=monster['worldMonsterId']
    old_epoch=monster['spawnEpoch']

    # Bring the physical Monster into the navigation-owned safe playfield using
    # normal pointer pan. This does not alter simulation coordinates.
    box=page.locator('#world').bounding_box()
    mp=page.evaluate('(m)=>simclone.screenPoint(m.x,m.y)',monster)
    safe=page.evaluate('simclone.safeFrame()')
    zoom=page.evaluate('simclone.camera().zoom')
    target_x=(safe['left']+safe['right'])/2
    target_y=(safe['top']+safe['bottom'])/2
    monster_y=mp['y']-20*zoom
    dx=target_x-mp['x']
    dy=target_y-monster_y
    start_x=target_x
    start_y=target_y
    page.mouse.move(box['x']+start_x,box['y']+start_y)
    page.mouse.down()
    page.mouse.move(box['x']+start_x+dx,box['y']+start_y+dy,steps=10)
    page.mouse.up()
    page.wait_for_timeout(150)

    mp2=page.evaluate('(m)=>simclone.screenPoint(m.x,m.y)',monster)
    zoom=page.evaluate('simclone.camera().zoom')
    tap_y=mp2['y']-20*zoom
    hit=page.evaluate(
        '(q)=>simclone.worldObjectTargetAtScreen(q.x,q.y)',
        {'x':mp2['x'],'y':tap_y}
    )
    check('SWA7 public canvas hit resolves exact worldMonsterId',
          hit is not None and hit.get('type')=='monster' and hit.get('id')==old_id)
    check('SWA7 public Monster target is unobstructed canvas',
          page.evaluate(
              '(q)=>document.elementFromPoint(q.x,q.y)?.id==="world"',
              {'x':box['x']+mp2['x'],'y':box['y']+tap_y}
          ))

    before_tap=snap(page)
    page.mouse.click(box['x']+mp2['x'],box['y']+tap_y)
    page.wait_for_selector('#dialog[open][data-kind="monster"] [data-world-monster]',timeout=10000)
    check('SWA7 actual public canvas tap opens exact Monster card read-only',
          page.locator('[data-world-monster]').get_attribute('data-world-monster')==old_id
          and snap(page)==before_tap)
    page.screenshot(path=str(OUT/'01-public-monster.png'),full_page=True)

    page.locator('[data-action="hunt-monster"]').tap()
    hunted=snap(page)['agents'][0]
    check('SWA7 public Hunt uses engine task without teleport',
          hunted.get('task',{}).get('adventureHunt',{}).get('worldMonsterId')==old_id
          and (hunted['x'],hunted['y'])==(hero['x'],hero['y'])
          and len(hunted['task']['path'])>0)
    check('SWA7 Hunt target is adjacent to the physical Monster',
          abs(hunted['task']['x']-monster['x'])+abs(hunted['task']['y']-monster['y'])==1)

    page.locator('[data-speed="5"]').tap()
    page.evaluate("window.__swa7Hidden=false")
    running(page)
    page.wait_for_function(
        '(id)=>simclone.snapshot().agents[0].adventureEncounter?.worldMonsterId===id',
        arg=old_id,timeout=20000
    )
    paused(page)
    ready=snap(page)['agents'][0]['adventureEncounter']
    check('SWA7 READY encounter keeps exact hunted worldMonsterId',ready['worldMonsterId']==old_id)

    page.wait_for_selector('[data-adv-action="start-combat"]',timeout=10000)
    page.locator('[data-adv-action="start-combat"]').tap()
    combat_state=snap(page)
    combat=combat_state['agents'][0]['adventureCombat']
    engaged=next(m for m in combat_state['wildMonsters']['entities'] if m['worldMonsterId']==old_id)
    check('SWA7 Combat binds same entity ENGAGED with single HP authority',
          combat.get('worldMonsterId')==old_id
          and 'monsterHpCurrent' not in combat
          and engaged['status']=='ENGAGED'
          and engaged['engagedByAgentId']==combat_state['agents'][0]['id'])
    page.screenshot(path=str(OUT/'02-public-combat.png'),full_page=True)

    for _ in range(100):
        current=snap(page)['agents'][0]['adventureCombat']
        if current['status']!='ACTIVE':
            break
        page.locator('[data-adv-action="attack"]').tap()
        page.wait_for_timeout(30)

    terminal=snap(page)
    terminal_combat=terminal['agents'][0]['adventureCombat']
    defeated=next(m for m in terminal['wildMonsters']['entities'] if m['worldMonsterId']==old_id)
    check('SWA7 public combat reaches VERIFIED Victory',
          terminal_combat['status']=='VICTORY'
          and terminal_combat.get('reward',{}).get('status')=='COMMITTED')
    check('SWA7 Victory hides physical Monster as DEFEATED',
          defeated['status']=='DEFEATED'
          and defeated['hpCurrent']==0
          and defeated['engagedByAgentId'] is None)

    oldp=page.evaluate('(m)=>simclone.screenPoint(m.x,m.y)',defeated)
    oldhit=page.evaluate(
        '(q)=>simclone.worldObjectTargetAtScreen(q.x,q.y)',
        {'x':oldp['x'],'y':oldp['y']-20*page.evaluate('simclone.camera().zoom')}
    )
    check('SWA7 DEFEATED incarnation is absent from public hit targets',
          oldhit is None or not(oldhit.get('type')=='monster' and oldhit.get('id')==old_id))
    page.screenshot(path=str(OUT/'03-public-victory-hidden.png'),full_page=True)

    page.wait_for_selector('[data-adv-action="finish-result"]',timeout=10000)
    page.locator('[data-adv-action="finish-result"]').tap()
    check('SWA7 Continue closes terminal combat',
          snap(page)['agents'][0].get('adventureCombat') is None)

    page.locator('[data-speed="5"]').tap()
    running(page)
    page.wait_for_function(
        """q=>simclone.snapshot().wildMonsters.entities.some(m=>
        m.zoneId===q.zoneId&&m.spawnSlot===q.spawnSlot&&
        m.spawnEpoch===q.epoch+1&&m.status==='IDLE')""",
        arg={'zoneId':defeated['zoneId'],'spawnSlot':defeated['spawnSlot'],'epoch':old_epoch},
        timeout=20000
    )
    paused(page)
    final=snap(page)
    respawned=next(
        m for m in final['wildMonsters']['entities']
        if m['zoneId']==defeated['zoneId'] and m['spawnSlot']==defeated['spawnSlot']
    )
    check('SWA7 public Monster respawns as deterministic new incarnation',
          respawned['spawnEpoch']==old_epoch+1
          and respawned['worldMonsterId']!=old_id
          and respawned['status']=='IDLE'
          and respawned['hpCurrent']==respawned['hpMax'])
    page.screenshot(path=str(OUT/'04-public-respawn.png'),full_page=True)

    check('SWA7 public browser has no JavaScript page errors',not errors)
    (OUT/'results.json').write_text(json.dumps({
        'result':'PASS',
        'releaseSha':RELEASE_SHA,
        'pageUrl':PAGE_URL,
        'checks':checks,
        'count':len(checks),
        'pageErrors':errors,
        'oldWorldMonsterId':old_id,
        'newWorldMonsterId':respawned['worldMonsterId'],
        'spawnEpoch':respawned['spawnEpoch'],
    },ensure_ascii=False,indent=2))
    print('TOTAL',len(checks),'PASS',flush=True)
    context.close()
    browser.close()
