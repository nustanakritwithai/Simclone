"""Offline Chromium fixture. Explicitly does not verify live HTTP or native storage."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import base64,json
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'evidence-ui';OUT.mkdir(exist_ok=True)
from browser_fixture import HTML
html=HTML
checks=[];errors=[]
def check(name,condition=True):
 assert condition,name
 checks.append(name);print('PASS',name,flush=True)
def boot(page,saved=None):
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.evaluate("saved=>{const m=new Map(saved?[['simclone:world:v1',saved]]:[]);Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v))}})}",saved)
 page.set_content(html,wait_until='load')
 page.wait_for_function("window.simclone?.uiVersion==='0.3.3'")
 page.wait_for_timeout(400)
def paused(page):
 if page.locator('#pause').get_attribute('aria-pressed')!='true':page.locator('#pause').click()
def snap(page):return page.evaluate('simclone.snapshot()')
def no_overflow(page):return page.evaluate('document.documentElement.scrollWidth<=innerWidth')
with sync_playwright() as p:
 exe='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None
 b=p.chromium.launch(executable_path=exe,headless=True,args=['--no-sandbox'])
 desktop=b.new_page(viewport={'width':1440,'height':1000});boot(desktop)
 check('desktop boot with UI 0.3.3 and engine 0.3.3',desktop.evaluate('simclone.version')=='0.3.3')
 check('world actually advances',snap(desktop)['tick']>0)
 desktop.screenshot(path=str(OUT/'desktop-world.png'))
 paused(desktop);t=snap(desktop)['tick'];desktop.wait_for_timeout(700);check('pause freezes simulation',snap(desktop)['tick']==t)
 desktop.locator('[data-tab="why"]').click()
 check('actual decision trace displayed',desktop.locator('.trace-row.selected').count()==1)
 # Stable tabs must not be replaced every UI update.
 desktop.locator('[data-tab="why"]').evaluate('(e)=>window.__tabNode=e');desktop.wait_for_timeout(750)
 check('inspector tab DOM is stable across refresh',desktop.evaluate('window.__tabNode===document.querySelector("[data-tab=why]")'))
 desktop.locator('[data-tab="why"]').focus();desktop.keyboard.press('ArrowLeft')
 check('keyboard arrow selects skills tab',desktop.locator('[data-tab="skills"]').get_attribute('aria-selected')=='true')
 desktop.locator('[data-tab="why"]').click();desktop.screenshot(path=str(OUT/'desktop-reasons.png'))
 desktop.locator('#roster').click();desktop.locator('#people-search').fill('kira')
 check('search finds only Kira',desktop.locator('.person-row').count()==1 and 'Kira' in desktop.locator('.person-row').inner_text())
 desktop.locator('#people-search').fill('not-a-person');check('empty state shown',desktop.locator('#roster-list .empty-state').is_visible())
 desktop.locator('#people-search').fill('kira');desktop.locator('[data-person="3"]').click()
 desktop.locator('#clone').click();check('clone preview correct parent', 'Kira' in desktop.locator('.clone-lineage').inner_text())
 s=snap(desktop);desktop.wait_for_timeout(350);check('clone preview spends no resources',snap(desktop)==s)
 desktop.locator('[data-action="confirm-clone"]').click();s2=snap(desktop)
 check('clone commits once from selected Kira',len(s2['agents'])==7 and s2['agents'][-1]['parentId']==3 and s2['stock']['food']==s['stock']['food']-8)
 # Storage fixture verifies shape compatibility, not native storage.
 desktop.locator('#menu').click();desktop.locator('[data-action="save"]').click();saved=desktop.evaluate('localStorage.getItem("simclone:world:v1")');desktop.locator('#dialog-close').click()
 reloadpage=b.new_page(viewport={'width':1440,'height':1000});boot(reloadpage,saved)
 check('old save schema retained and reload works with storage double',len(snap(reloadpage)['agents'])==7)
 # Mobile
 m=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);boot(m);paused(m)
 check('mobile world has no inspector covering it initially',not m.locator('#inspector').is_visible())
 check('mobile quick character rail and SVG dock present',m.locator('#people-rail').is_visible() and m.locator('.mobile-nav .ui-icon').count()==5)
 check('mobile page no horizontal overflow',no_overflow(m))
 m.screenshot(path=str(OUT/'mobile-world.png'))
 m.locator('[data-quick-person="2"]').tap()
 check('quick portrait selects Nira', 'Nira' in m.locator('#inspector .identity').inner_text())
 check('inspector shows derived adult age and lifespan', 'ผู้ใหญ่' in m.locator('#life-label').inner_text() and '18 ปี' in m.locator('#life-label').inner_text() and 'อายุขัย' in m.locator('#life-label').inner_text())
 check('mobile inspector initially compact',not m.locator('#inspector').evaluate('(e)=>e.classList.contains("is-expanded")'))
 box=m.locator('#inspector').bounding_box();stage=m.locator('#stage').bounding_box()
 check('compact inspector occupies less than 40 percent of world',box['height']<stage['height']*.4)
 m.screenshot(path=str(OUT/'mobile-selected.png'))
 m.locator('[data-ux="why"]').tap()
 check('why shortcut expands real reason panel',m.locator('#inspector').evaluate('(e)=>e.classList.contains("is-expanded")') and m.locator('.trace-row.selected').count()==1)
 m.screenshot(path=str(OUT/'mobile-reasons.png'))
 m.locator('[data-ux="expand"]').tap();check('sheet can collapse',not m.locator('#inspector').evaluate('(e)=>e.classList.contains("is-expanded")'))
 m.locator('[data-ux="why"]').tap();m.locator('[data-ui="close"]').tap();check('camera returns after closing expanded sheet',m.locator('.camera').is_visible())
 # Placement preview, dry run, cancel, invalid grid, successful commit.
 m.locator('[data-nav="build"]').tap();check('build shows confirmation controls',m.locator('#placement-panel').is_visible() and m.locator('#confirm-placement').is_disabled())
 s=snap(m);m.locator('#choose-position').tap();m.locator('#grid-x').fill('14');m.locator('#grid-y').fill('11');m.locator('#preview-grid').tap()
 check('valid preview enables confirm but does not spend',not m.locator('#confirm-placement').is_disabled() and snap(m)==s)
 m.screenshot(path=str(OUT/'mobile-build.png'))
 m.locator('#cancel-placement').tap();check('cancel build leaves engine unchanged',snap(m)==s and not m.locator('#placement-panel').is_visible())
 m.locator('[data-nav="build"]').tap();m.locator('#choose-position').tap();idx=s['tiles'].index('water');m.locator('#grid-x').fill(str(idx%30));m.locator('#grid-y').fill(str(idx//30));m.locator('#preview-grid').tap()
 check('water preview rejected by engine',m.locator('#confirm-placement').is_disabled() and snap(m)==s)
 m.locator('#choose-position').tap();m.locator('#grid-x').fill('14');m.locator('#grid-y').fill('11');m.locator('#preview-grid').tap();m.locator('#confirm-placement').tap();after=snap(m)
 check('confirm spends correct cost exactly once',len(after['buildings'])==3 and after['stock']['wood']==s['stock']['wood']-12 and after['stock']['stone']==s['stock']['stone']-6)
 m.locator('#pause').tap();m.locator('[data-speed="5"]').tap();m.wait_for_function('simclone.snapshot().buildings.at(-1).complete',timeout=25000)
 check('house construction still completes autonomously');paused(m)
 m.locator('[data-nav="history"]').tap();m.locator('[data-history-filter="build"]').tap()
 check('chronicle filter shows only construction',m.locator('.history-event').count()>=2 and all('สิ่งปลูกสร้าง' in x for x in m.locator('.history-event').all_inner_texts()))
 m.screenshot(path=str(OUT/'mobile-chronicle.png'));m.locator('#dialog-close').tap()
 m.locator('#menu').tap();before=snap(m);m.locator('#import-file').set_input_files({'name':'broken.json','mimeType':'application/json','buffer':b'{"version":"99"}'})
 check('invalid save import cannot replace world',snap(m)==before);m.locator('#dialog-close').tap()
 # Small and landscape layouts
 for w,h in [(360,800),(320,740),(844,390),(768,1024)]:
  q=b.new_page(viewport={'width':w,'height':h},is_mobile=w<=700,has_touch=True);boot(q);paused(q)
  check(f'layout {w}x{h} no document overflow',no_overflow(q))
  for sel in ['#pause','#menu']:
   r=q.locator(sel).bounding_box();check(f'{w}x{h} {sel} on screen',r['x']>=0 and r['x']+r['width']<=w+1)
  q.screenshot(path=str(OUT/f'world-{w}x{h}.png'))
 check('no JavaScript page errors',not errors)
 result={'result':'PASS','checks':checks,'count':len(checks),'pageErrors':errors,'limitations':['Modules loaded in memory because browser HTTP blocked','Storage is explicit test double, not native browser persistence','Not tested on physical Android','Live Pages load not verified by this fixture']}
 (OUT/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
 print('TOTAL',len(checks),'PASS',flush=True)
 b.close()
