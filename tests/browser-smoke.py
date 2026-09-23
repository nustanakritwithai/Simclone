from playwright.sync_api import sync_playwright
from pathlib import Path
import json, base64, os
ROOT=Path(__file__).resolve().parents[1]
engine="data:text/javascript;base64,"+base64.b64encode((ROOT/"src/engine.mjs").read_bytes()).decode()
app=(ROOT/"src/app.mjs").read_text().replace("'./engine.mjs'",repr(engine))
HTML=(ROOT/"index.html").read_text().replace('<link rel="stylesheet" href="./src/game.css?v=0.1.0">',"<style>"+(ROOT/"src/game.css").read_text()+"</style>").replace('<script type="module" src="./src/app.mjs?v=0.1.0"></script>','<script type="module">'+app+'</script>')
def boot(page, saved=None):
 # No network access is permitted in this runner. Load exact modules in memory.
 # Storage is an explicit test double, NOT a native localStorage persistence test.
 page.evaluate("""saved => { const data = new Map(saved ? [['simclone:world:v1', saved]] : []); Object.defineProperty(window, 'localStorage', {configurable:true, value:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v))}}); }""", saved)
 page.set_content(HTML,wait_until="load")
 page.wait_for_function("window.simclone?.version === '0.1.0'")
OUT=ROOT/'evidence';OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_BIN','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 boot(page);page.wait_for_timeout(1500)
 print('hook',page.evaluate('window.simclone?.version'))
 print('tick',page.evaluate('window.simclone.snapshot().tick'))
 page.screenshot(path=str(OUT/'desktop.png'),full_page=True)
 # Pause must freeze the model, not merely update the icon.
 page.locator('#pause').click();page.wait_for_timeout(100)
 t1=page.evaluate('simclone.snapshot().tick');page.wait_for_timeout(600);assert page.evaluate('simclone.snapshot().tick')==t1
 page.locator('[data-tab="why"]').click();assert page.locator('.trace-row.selected').count()==1
 page.screenshot(path=str(OUT/'decision.png'))
 # All real agents available through keyboard-accessible roster.
 page.locator('#roster').click();assert page.locator('.person-row').count()==6
 page.locator('[data-person="3"]').click();assert 'Kira' in page.locator('#inspector').inner_text()
 page.locator('#clone').click();page.locator('[data-action="confirm-clone"]').click()
 s=page.evaluate('simclone.snapshot()');assert len(s['agents'])==7 and s['agents'][-1]['parentId']==3
 # Save via explicit UI; restore from same browser.
 page.locator('#menu').click();page.locator('[data-action="save"]').click();page.locator('#dialog-close').click()
 saved=page.evaluate('localStorage.getItem("simclone:world:v1")');boot(page,saved);assert len(page.evaluate('simclone.snapshot().agents'))==7
 # Mobile starts from clean storage; no side panel over the world.
 m=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
 m.on('pageerror',lambda e:errors.append(str(e)));boot(m);m.wait_for_timeout(500)
 assert not m.locator('#inspector').is_visible()
 assert m.locator('.mobile-nav').is_visible()
 assert m.evaluate('document.documentElement.scrollWidth <= innerWidth')
 m.screenshot(path=str(OUT/'mobile-world.png'))
 m.locator('[data-nav="people"]').tap();m.locator('[data-person="2"]').tap();assert m.locator('#inspector').is_visible()
 m.locator('[data-tab="skills"]').tap();assert m.locator('.skill-row').count()==4
 m.screenshot(path=str(OUT/'mobile-inspector.png'))
 # Buttons fit viewport and mobile panel stays above navigation.
 box=m.locator('#inspector').bounding_box();nav=m.locator('.mobile-nav').bounding_box();assert box['y']+box['height']<=nav['y']+1
 # Invalid import must not replace state.
 m.locator('#menu').tap();m.locator('#import-file').set_input_files({'name':'broken.json','mimeType':'application/json','buffer':b'{"version":"99"}'})
 assert len(m.evaluate('simclone.snapshot().agents'))==6
 m.locator('#dialog-close').tap()
 # Build a real house through mobile placement; clone capacity comes from completed structures only.
 m.locator('[data-nav="build"]').tap()
 xy=m.evaluate('simclone.screenPoint(14,11)');stage=m.locator('#world').bounding_box()
 m.mouse.click(stage['x']+xy['x'],stage['y']+xy['y'])
 assert len(m.evaluate('simclone.snapshot().buildings'))==3
 m.locator('[data-speed="5"]').tap();m.wait_for_timeout(15000)
 print('building',m.evaluate('simclone.snapshot().buildings.at(-1)'))
 assert m.evaluate('simclone.snapshot().buildings.at(-1).complete')
 assert not errors,errors
 print('Browser smoke PASS; console errors:',errors)
 (OUT/'browser-result.json').write_text(json.dumps({'result':'PASS','limitations':'Browser network navigation blocked; modules loaded in memory; native localStorage and live HTTP not verified','errors':errors,'desktop':'1440x1000','mobile':'390x844','checks':['boot','tick','pause','decision scores','roster','clone selected parent','save/reload through in-memory Storage double','mobile navigation','mobile inspector','malformed import rejected','build to completion']},indent=2))
 browser.close()
