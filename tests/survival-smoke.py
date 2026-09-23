"""Survival UI contract checks on exact modules; offline, Storage test double."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixture import HTML,storage
import json,subprocess
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'evidence-survival';OUT.mkdir(exist_ok=True)
checks=[];errors=[]
def check(name,ok):
 assert ok,name
 checks.append(name);print('PASS',name,flush=True)
with sync_playwright() as p:
 exe='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None
 b=p.chromium.launch(executable_path=exe,headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
 page.on('pageerror',lambda e:errors.append(str(e)))
 legacy=subprocess.check_output(['node','--input-type=module','-e',"import * as old from './tests/fixtures/legacy-engine-0.1.0.mjs';const s=old.createWorld(230926);old.step(s,87);console.log(old.serialize(s));"],cwd=ROOT,text=True).strip();storage(page,legacy)
 page.set_content(HTML,wait_until='load');page.wait_for_function("window.simclone?.version==='0.3.3'")
 page.wait_for_selector('#boot-screen',state='detached');page.wait_for_timeout(500);page.locator('#pause').tap()
 check('old world migrates into lifecycle save schema',page.evaluate('simclone.snapshot().version')=='0.2.0')
 before=page.evaluate('JSON.stringify(simclone.snapshot())')
 page.locator('.resources [role="button"]').tap()
 check('food tile opens survival summary',page.locator('#dialog-title').inner_text()=='หมู่บ้านอยู่รอดอย่างไร')
 s=json.loads(before);reserved=sum(1 for a in s['agents'] if a['alive'] and a['task'] and a['task']['kind']=='EAT')
 values=page.locator('.life-summary b').all_inner_texts()
 check('summary free and reserved meals match engine jobs',values==[str(s['stock']['food']-reserved)+' หน่วย',str(reserved)+' หน่วย'])
 check('inspecting summary never changes the world',page.evaluate('JSON.stringify(simclone.snapshot())')==before)
 check('shared-stock, birth and age-death rules disclosed','คลังรวม' in page.locator('#dialog-body').inner_text() and 'สถานะการเกิดอัตโนมัติ' in page.locator('#dialog-body').inner_text() and 'parent คนเดิมพัก 4 ปี' in page.locator('#dialog-body').inner_text() and 'อายุขัย derive 78–92 ปี' in page.locator('#dialog-body').inner_text())
 page.screenshot(path=str(OUT/'mobile-survival.png'))
 page.locator('#dialog-close').tap();page.locator('#menu').tap();page.locator('[data-action="survival"]').tap()
 check('menu also opens survival panel',page.locator('#dialog-title').inner_text()=='หมู่บ้านอยู่รอดอย่างไร')
 page.locator('#dialog-close').tap();page.locator('[data-nav="people"]').tap();page.locator('[data-person="2"]').tap();page.locator('[data-ux="why"]').tap()
 chosen=next(t for t in page.evaluate('simclone.snapshot().agents.find(a=>a.id===2).trace') if t['status']=='selected')
 check('selected decision always present',page.locator('.trace-row.selected').count()==1)
 check('trace shows actual route length',f"ระยะเดินตอนเลือก {chosen['travelSteps']} ช่อง" in page.locator('#ux-tab-content').inner_text())
 page.screenshot(path=str(OUT/'mobile-route-trace.png'))
 check('no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
 check('no uncaught JavaScript errors',not errors)
 (OUT/'browser-survival.json').write_text(json.dumps({'checks':checks,'passed':len(checks),'pageErrors':errors,'scope':'offline Chromium 390x844, exact modules, in-memory Storage double'},ensure_ascii=False,indent=2))
 b.close()
