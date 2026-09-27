"""Browser proof for Autonomous Adventurer V1.

No Hunt / Start Combat / Attack button is pressed. The browser only boots a
validated Adventurer save and accelerates simulation time.
"""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from functools import partial
from playwright.sync_api import sync_playwright
import json, subprocess

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'evidence-ui'/'autonomous-adventure'
OUT.mkdir(parents=True,exist_ok=True)
saved=subprocess.check_output(
    ['node','scripts/swa7-public-fixture.mjs'],cwd=ROOT,text=True
).strip()

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass

server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/'

checks=[]
def check(name,condition=True):
    assert condition,name
    checks.append(name)
    print('PASS',name,flush=True)

try:
  with sync_playwright() as p:
    exe='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None
    browser=p.chromium.launch(executable_path=exe,headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    seed_literal=json.dumps(saved)
    page.add_init_script(
      "localStorage.clear();localStorage.setItem('simclone:world:v1',"+seed_literal+");"
    )
    page.goto(url,wait_until='load')
    page.wait_for_function("window.simclone?.version==='0.5.0'")
    initial=page.evaluate('simclone.snapshot()')
    hero=initial['agents'][0]
    start_pos=(hero['x'],hero['y'])
    check('AUTO-ADV browser fixture starts with safe idle Adventurer',
          hero['profession']=='adventurer' and hero['task'] is None and
          hero.get('adventureEncounter') is None and hero.get('adventureCombat') is None)

    page.locator('[data-speed="5"]').tap()

    page.wait_for_function(
      "()=>Boolean(simclone.snapshot().agents[0].task?.adventureHunt?.worldMonsterId)",
      timeout=10000
    )
    hunted=page.evaluate('simclone.snapshot()')
    agent=hunted['agents'][0]
    target_id=agent['task']['adventureHunt']['worldMonsterId']
    check('AUTO-ADV browser starts Hunt without Hunt button',
          target_id.startswith('wm:') and (agent['x'],agent['y'])==start_pos and len(agent['task']['path'])>0)
    page.screenshot(path=str(OUT/'01-autonomous-hunt.png'),full_page=True)

    page.wait_for_function(
      """id=>{const a=simclone.snapshot().agents[0];
      return a.adventureCombat?.worldMonsterId===id&&a.adventureCombat.turn>=1;}""",
      arg=target_id,timeout=30000
    )
    fighting=page.evaluate('simclone.snapshot()')
    agent=fighting['agents'][0]
    monster=next(m for m in fighting['wildMonsters']['entities'] if m['worldMonsterId']==target_id)
    check('AUTO-ADV browser starts Combat and BASIC_ATTACK without combat buttons',
          agent['adventureCombat']['worldMonsterId']==target_id and
          agent['adventureCombat']['turn']>=1 and monster['status'] in ['ENGAGED','DEFEATED'])
    check('AUTO-ADV browser keeps world Monster HP authority',
          'monsterHpCurrent' not in agent['adventureCombat'])
    page.screenshot(path=str(OUT/'02-autonomous-combat.png'),full_page=True)

    (OUT/'results.json').write_text(json.dumps({
      'result':'PASS','checks':checks,'count':len(checks),
      'worldMonsterId':target_id,'combatTurn':agent['adventureCombat']['turn']
    },ensure_ascii=False,indent=2))
    browser.close()
finally:
  server.shutdown();server.server_close()

print('TOTAL',len(checks),'PASS',flush=True)
