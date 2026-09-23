"""Presentation regression on actual source modules; offline Storage double only."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixture import HTML, fixture, storage
import json
OUT=Path(__file__).resolve().parents[1]/'evidence-navigation';OUT.mkdir(exist_ok=True)
checks=[];errors=[]
def check(name,condition):
 assert condition,name
 checks.append(name);print('PASS',name,flush=True)
def boot(browser,width=390,height=844,saved=None,deny_get=False,deny_set=False,broken=False):
 page=browser.new_page(viewport={'width':width,'height':height},is_mobile=width<=700,has_touch=True)
 page.on('pageerror',lambda e:errors.append(str(e)))
 storage(page,saved,deny_get,deny_set)
 page.set_content(fixture(True) if broken else HTML,wait_until='load')
 if broken:page.wait_for_function('document.querySelector("#boot-screen")?.dataset.status==="error"')
 else:
  page.wait_for_function('window.simclone?.uiVersion==="0.3.3"')
  page.wait_for_selector('#boot-screen',state='detached');page.wait_for_timeout(500)
  page.locator('#pause').click();page.wait_for_timeout(400)
 return page
def state(p):return p.evaluate('JSON.stringify(simclone.snapshot())')
def is_visible_target(p):
 return p.evaluate('''()=>{const a=simclone.snapshot().agents.find(a=>a.id===2),v=simclone.screenPoint(a.x,a.y),r=simclone.safeFrame(),z=simclone.camera().zoom;return v.x-12*z>=r.left&&v.x+12*z<=r.right&&v.y-38*z>=r.top&&v.y+10*z<=r.bottom}''')
with sync_playwright() as p:
 exe='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None
 b=p.chromium.launch(executable_path=exe,headless=True,args=['--no-sandbox'])
 m=boot(b);before=state(m)
 check('successful boot removes loader only after ready',m.locator('#boot-screen').count()==0)
 check('new world does not pretend to be saved',m.locator('#save-indicator').get_attribute('data-state')=='new')
 m.locator('#map-toggle').tap();check('minimap opens and explains camera-only interaction',m.locator('#mini-map').is_visible() and 'ไม่ใช่สั่งคนเดิน' in m.locator('#mini-map').inner_text())
 m.locator('#map-canvas').click(position={'x':90,'y':70});check('minimap click changes view not world',state(m)==before)
 f=m.evaluate('simclone.camera().focus');m.locator('#map-canvas').focus();m.keyboard.press('ArrowRight');check('minimap keyboard pans exactly one world cell',m.evaluate('simclone.camera().focus.x')==f['x']+1)
 check('minimap has no resource cost',state(m)==before)
 m.screenshot(path=str(OUT/'mobile-minimap.png'))
 m.keyboard.press('Escape');check('minimap escape returns focus to map button',not m.locator('#mini-map').is_visible() and m.locator('#map-toggle').evaluate('(e)=>e===document.activeElement'))
 m.locator('[data-quick-person="2"]').tap();m.wait_for_timeout(600)
 check('selected character fits unobscured compact viewport',is_visible_target(m))
 m.locator('[data-ux="why"]').tap();m.wait_for_timeout(700)
 m.screenshot(path=str(OUT/'mobile-camera-sheet.png'))
 print('FRAME',m.evaluate('simclone.safeFrame()'),flush=True)
 check('selected character still fits above expanded sheet',is_visible_target(m))
 check('camera reframing does not run extra simulation ticks',state(m)==before)
 m.screenshot(path=str(OUT/'mobile-camera-sheet.png'))
 m.locator('[data-ui="close"]').tap();m.locator('#menu').tap();m.locator('[data-action="save"]').tap();m.wait_for_timeout(400)
 check('successful storage write updates badge',m.locator('#save-indicator').get_attribute('data-state')=='saved')
 saved=m.evaluate('localStorage.getItem("simclone:world:v1")');check('saved bytes retain original schema',json.loads(saved)['version']=='0.2.0')
 restored=boot(b,saved=saved);check('saved world restored in a fresh document',restored.evaluate('simclone.snapshot().seed')==json.loads(saved)['seed'] and restored.evaluate('simclone.saveStatus().kind')=='loaded')
 bad=boot(b,saved='original damaged save');check('corrupt save reported as protected',bad.locator('#save-indicator').get_attribute('data-state')=='protected')
 bad.locator('#menu').tap();check('exact original backup is available',bad.locator('[data-action="export-original"]').is_visible())
 with bad.expect_download() as dl:bad.locator('[data-action="export-original"]').tap()
 check('exported recovery bytes are unchanged',Path(dl.value.path()).read_text()=='original damaged save')
 bad.locator('[data-action="save"]').tap();check('manual save cannot overwrite corrupt original',bad.evaluate('__saveMap.get("simclone:world:v1")')=='original damaged save')
 bad.evaluate('dispatchEvent(new Event("pagehide"))');check('pagehide autosave cannot overwrite corrupt original',bad.evaluate('__saveMap.get("simclone:world:v1")')=='original damaged save')
 bad.screenshot(path=str(OUT/'mobile-save-recovery.png'))
 denied=boot(b,deny_set=True);denied.locator('#menu').tap();denied.locator('[data-action="save"]').tap();denied.wait_for_timeout(400)
 check('quota failure is visible rather than false success',denied.locator('#save-indicator').get_attribute('data-state')=='unavailable')
 check('quota failure does not erase running world',denied.evaluate('simclone.snapshot().agents.length')==6)
 denied.evaluate('__denySet=false');denied.locator('[data-action="save"]').tap();denied.wait_for_timeout(400)
 check('storage can recover after availability returns',denied.locator('#save-indicator').get_attribute('data-state')=='saved')
 unread=boot(b,saved='hidden original',deny_get=True);unread.evaluate('dispatchEvent(new Event("pagehide"))')
 check('read-denied browser never overwrites unknown original',unread.evaluate('__saveMap.get("simclone:world:v1")')=='hidden original')
 check('read-denied is not mislabeled as corrupt',unread.locator('#save-indicator').get_attribute('data-state')=='unavailable')
 failure=boot(b,saved=saved,broken=True)
 check('injected startup failure has visible retry UI',failure.locator('#boot-screen').is_visible() and failure.get_by_role('button',name='โหลดใหม่',exact=True).is_visible())
 check('startup failure leaves saved data intact',failure.evaluate('__saveMap.get("simclone:world:v1")')==saved)
 failure.screenshot(path=str(OUT/'startup-recovery.png'))
 for width,height in [(320,740),(360,800),(768,1024),(844,390),(1440,1000)]:
  page=boot(b,width,height);check(f'layout {width}x{height} no overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  if width<=700:page.locator('[data-quick-person="2"]').tap()
  page.locator('[data-tab="why"]').click() if width>700 else page.locator('[data-ux="why"]').tap()
  page.wait_for_timeout(600);check(f'target visible with inspector {width}x{height}',is_visible_target(page))
  page.screenshot(path=str(OUT/f'camera-{width}x{height}.png'))
 check('no uncaught JavaScript errors',not errors)
 (OUT/'results.json').write_text(json.dumps({'result':'PASS','count':len(checks),'checks':checks,'pageErrors':errors,'scope':'Offline Chromium, exact modules, injected storage/failure cases; not live HTTP or physical Android'},ensure_ascii=False,indent=2))
 print('TOTAL',len(checks),'PASS',flush=True)
 b.close()
