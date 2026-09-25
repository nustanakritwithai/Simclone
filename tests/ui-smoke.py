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
 page.wait_for_function("window.simclone?.uiVersion==='0.5.0'")
 page.wait_for_timeout(400)
def paused(page):
 if page.locator('#pause').get_attribute('aria-pressed')!='true':page.locator('#pause').click()
def snap(page):return page.evaluate('simclone.snapshot()')
def no_overflow(page):return page.evaluate('document.documentElement.scrollWidth<=innerWidth')
with sync_playwright() as p:
 exe='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None
 b=p.chromium.launch(executable_path=exe,headless=True,args=['--no-sandbox'])
 desktop=b.new_page(viewport={'width':1440,'height':1000});boot(desktop)
 check('desktop boot with UI 0.5.0 and engine 0.5.0',desktop.evaluate('simclone.version')=='0.5.0')
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
 desktop.locator('[data-ux="clone"]').click();check('clone preview correct parent', 'Kira' in desktop.locator('.clone-lineage').inner_text())
 check('manual clone is distinguished from autonomous birth', 'อายุ 18 ปี' in desktop.locator('#dialog-body').inner_text() and 'เด็กเริ่มอายุ 0 ปี' in desktop.locator('#dialog-body').inner_text())
 s=snap(desktop);desktop.wait_for_timeout(350);check('clone preview spends no resources',snap(desktop)==s)
 desktop.locator('[data-action="confirm-clone"]').click();s2=snap(desktop)
 check('clone commits once from selected Kira',len(s2['agents'])==7 and s2['agents'][-1]['parentId']==3 and s2['stock']['food']==s['stock']['food']-8)
 # Storage fixture verifies shape compatibility, not native storage.
 desktop.locator('#menu').click();desktop.locator('[data-action="save"]').click();saved=desktop.evaluate('localStorage.getItem("simclone:world:v1")');desktop.locator('#dialog-close').click()
 reloadpage=b.new_page(viewport={'width':1440,'height':1000});boot(reloadpage,saved)
 check('old save schema retained and reload works with storage double',len(snap(reloadpage)['agents'])==7)
 check('death history sub-schema persists through reload',snap(reloadpage)['historyVersion']=='0.1.0')
 inventory_saved=json.loads(saved)
 inventory_saved['rustPossessions']['items']=[{'id':1,'kind':'STONE_AXE','createdBy':2,'createdTick':inventory_saved['tick'],'location':{'kind':'bag','agentId':2}}]
 inventory_saved['rustPossessions']['nextItem']=2;inventory_saved['rustPossessions']['equipment']=[]
 invpage=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);boot(invpage,json.dumps(inventory_saved,ensure_ascii=False));paused(invpage)
 invpage.locator('[data-nav="people"]').tap();invpage.locator('[data-person="2"]').tap();invpage.locator('[data-ux="expand"]').tap();invpage.locator('[data-tab="inventory"]').tap()
 check('personal inventory shows four owned bag slots and hand equipment',invpage.locator('[data-inventory-slot]').count()==4 and '1 / 4 ช่อง' in invpage.locator('#ux-tab-content').inner_text() and 'อุปกรณ์ · มือ' in invpage.locator('#ux-tab-content').inner_text())
 # Housing-only autonomy can equip a useful carried tool during boot; normalize through the same public command before proving manual equip.
 if invpage.locator('[data-ux="unequip-item"]').count():invpage.locator('[data-ux="unequip-item"]').tap()
 check('inventory fixture can reach an explicitly empty hand slot',snap(invpage)['rustPossessions']['equipment']==[] and invpage.locator('[data-ux="equip-item"]').count()==1)
 invpage.locator('[data-ux="equip-item"]').tap();equipped=snap(invpage)['rustPossessions']['equipment']
 check('inventory equip action routes through engine and owns the selected item',equipped==[{'agentId':2,'itemId':1}] and invpage.locator('[data-ux="unequip-item"]').count()==1)
 invpage.locator('[data-ux="unequip-item"]').tap()
 check('inventory unequip keeps item in the same personal bag',snap(invpage)['rustPossessions']['equipment']==[] and snap(invpage)['rustPossessions']['items'][0]['location']=={'kind':'bag','agentId':2})
 knowledge_saved=json.loads(saved);ka=next(a for a in knowledge_saved['agents'] if a['id']==2)
 key='resource:777';eid='know:obs:2:777:10'
 ka['knowledgeState']={'version':'0.5.0','evidence':[{'evidenceId':eid,'type':'observation','ownerAgentId':2,'sourceAgentId':None,'tick':10,'key':key,'originEvidenceId':eid}],
  'beliefs':[{'beliefId':'belief:2:'+key,'key':key,'value':{'resourceId':777,'type':'food','x':9,'y':10},'status':'CONFIRMED','confidence':1,'sourceKind':'direct','sourceAgentId':None,'originEvidenceId':eid,'evidenceIds':[eid],'observedTick':10,'receivedTick':None}],
  'episodes':[{'episodeId':'episode:2:discovery:777','tick':10,'kind':'discovery','event':'พบแหล่ง food #777','perceivedOutcome':'ได้ผลผลิต 2','evidenceIds':[eid],'sourceAgentId':None,'key':key}]}
 knowpage=b.new_page(viewport={'width':1440,'height':1000});boot(knowpage,json.dumps(knowledge_saved,ensure_ascii=False));paused(knowpage)
 knowpage.locator('#roster').click();knowpage.locator('[data-person="2"]').click();knowpage.locator('[data-tab="knowledge"]').click()
 check('knowledge inspector distinguishes direct confirmed evidence','ยืนยันจากประสบการณ์ตรง' in knowpage.locator('#ux-tab-content').inner_text() and 'อาหาร #777' in knowpage.locator('#ux-tab-content').inner_text())
 check('confirmed personal knowledge exposes explicit share action',knowpage.locator('[data-ux="share-knowledge"]').count()==1)
 legacy_unknown=json.loads(saved);legacy_unknown['version']='0.2.0';legacy_unknown.pop('archive',None);legacy_unknown.pop('archiveVersion',None);legacy_unknown.pop('historyVersion',None)
 for a in legacy_unknown['agents']:a.pop('death',None);a.pop('skillProvenance',None);a.pop('knowledgeState',None)
 dead=next(a for a in legacy_unknown['agents'] if a['id']==2);dead['alive']=False;dead['hp']=0;dead['task']=None;dead['moveTick']=0;dead['memory']=[]
 legacy_unknown['events']=[e for e in legacy_unknown['events'] if not (e.get('type')=='death' and e.get('agentId')==2)]
 deadpage=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);boot(deadpage,json.dumps(legacy_unknown,ensure_ascii=False));paused(deadpage)
 deadpage.locator('[data-nav="people"]').tap();deadpage.locator('[data-person="2"]').tap()
 check('legacy death without evidence migrates to explicit unknown',snap(deadpage)['agents'][1]['death']['status']=='legacy-unknown')
 check('dead inspector never substitutes lifespan for unknown death age','อายุไม่ทราบ' in deadpage.locator('#life-label').inner_text() and 'สาเหตุไม่ทราบ' in deadpage.locator('#life-label').inner_text())
 # Mobile
 m=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);boot(m);paused(m)
 check('mobile world has no inspector covering it initially',not m.locator('#inspector').is_visible())
 check('mobile quick character rail and SVG dock present (5 tabs, no build tab)',m.locator('#people-rail').is_visible() and m.locator('.mobile-nav .ui-icon').count()==5 and m.locator('[data-nav="build"]').count()==0)
 check('mobile page no horizontal overflow',no_overflow(m))
 check('systems replaces manual clone in primary mobile navigation',m.locator('[data-nav="systems"]').count()==1 and m.locator('[data-nav="clone"]').count()==0)
 check('world keeps one compact AI autonomy decision surface',m.locator('#autonomy-status').is_visible() and 'AI AUTONOMY' in m.locator('#autonomy-status').inner_text())
 m.locator('#autonomy-status').tap()
 check('AI decision feed opens from world HUD',m.locator('#dialog-title').inner_text()=='AI กำลังตัดสินใจอะไร' and m.locator('[data-ai-person]').count()>=1)
 m.locator('[data-ai-person]').first.tap()
 check('decision feed deep-links to clone why panel',not m.locator('#dialog').evaluate('(e)=>e.open') and m.locator('#inspector').is_visible() and m.locator('[data-tab="why"]').get_attribute('aria-selected')=='true' and m.locator('.trace-row.selected').count()==1)
 m.locator('[data-ui="close"]').tap()
 m.locator('[data-nav="systems"]').tap()
 check('world systems dashboard exposes released and shadow systems',m.locator('#dialog-title').inner_text()=='ระบบที่กำลังขับเคลื่อนโลก' and m.locator('[data-system-card]').count()>=7 and 'LIVE' in m.locator('#dialog-body').inner_text() and 'SHADOW' in m.locator('#dialog-body').inner_text())
 check('systems dashboard exposes housing inventory knowledge and ecology',all(x in m.locator('#dialog-body').inner_text() for x in ['Housing','Inventory + Equipment','Knowledge + Mentor','WorldSim Ecology']))
 check('advanced system catalog is collapsed by default',m.locator('.system-advanced').count()==1 and not m.locator('.system-advanced').evaluate('(e)=>e.open'))
 check('full runtime catalog remains present while progressively disclosed',m.locator('[data-system-status]').count()>=40 and all(x in m.locator('#dialog-body').text_content() for x in ['Climate','Hydrology','Soil','Vegetation','Weighted Routing','K1 Utility + Career','K5 Labor Authority','Skill Provenance','History / Identity Archive','Save / Restore']))
 m.locator('.system-advanced>summary').tap()
 check('advanced catalog can be expanded on demand',m.locator('.system-advanced').evaluate('(e)=>e.open'))
 worldsim_catalog=m.locator('.system-catalog').filter(has_text='WorldSim / นิเวศ')
 worldsim_catalog.locator('summary').tap()
 check('nested WorldSim catalog reveals hidden systems on demand',worldsim_catalog.evaluate('(e)=>e.open') and 'Climate' in worldsim_catalog.inner_text() and 'Hydrology' in worldsim_catalog.inner_text())
 m.locator('#dialog-close').tap()
 m.screenshot(path=str(OUT/'mobile-world.png'))
 m.locator('[data-quick-person="2"]').tap()
 check('quick portrait selects Nira', 'Nira' in m.locator('#inspector .identity').inner_text())
 m.locator('[data-nav="rust"]').tap()
 check('Rust dock exposes the bounded item catalog and craft controls',m.locator('#dialog-title').inner_text()=='ไอเทมและการคราฟต์' and m.locator('[data-rust-catalog-item]').count()==9 and m.locator('[data-ux="craft-item"]').count()==9)
 m.locator('#dialog-close').tap()
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
 # Shelter building is removed from the UI (spec 6.4/7.2): no build button, nav tab, panel or ghost, and tapping the world never builds.
 s=snap(m);check('no shelter build UI remains',m.locator('[data-nav="build"]').count()==0 and m.locator('#build').count()==0 and m.locator('#placement-panel').count()==0 and m.locator('#confirm-placement').count()==0)
 check('no shelter price text in UI','ไม้ 12 + หิน 6' not in m.locator('body').inner_text())
 sb=m.locator('#stage').bounding_box();m.mouse.click(sb['x']+sb['width']*.5,sb['y']+sb['height']*.35)
 check('tapping the world does not build or spend',len(snap(m)['buildings'])==len(s['buildings']) and snap(m)['stock']==s['stock'])
 m.screenshot(path=str(OUT/'mobile-no-build.png'))
 # An unfinished shelter from an old (RS3-0.2) save is still finished by Clones, without refund or second charge.
 legacy_build=json.loads(saved);legacy_build['rustStations']['version']='RS3-0.2';legacy_build['rustStations'].pop('placements',None)
 legacy_build['buildings'].append({'id':legacy_build['nextBuilding'],'type':'shelter','x':14,'y':11,'complete':False,'progress':0});legacy_build['nextBuilding']+=1
 lb=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);boot(lb,json.dumps(legacy_build,ensure_ascii=False))
 check('old save with unfinished shelter loads and migrates Rust stations',snap(lb)['rustStations']['version']=='RS3-0.3' and snap(lb)['buildings'][-1]['complete'] is False)
 lb.locator('[data-speed="5"]').tap();lb.wait_for_function('simclone.snapshot().buildings.at(-1).complete',timeout=25000)
 check('unfinished legacy shelter still completes autonomously');paused(lb)
 lb.locator('[data-nav="history"]').tap();lb.locator('[data-history-filter="build"]').tap()
 check('chronicle filter shows only construction',lb.locator('.history-event').count()>=1 and all('สิ่งปลูกสร้าง' in x for x in lb.locator('.history-event').all_inner_texts()))
 lb.screenshot(path=str(OUT/'mobile-chronicle.png'));lb.locator('#dialog-close').tap()
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

# Separate opt-in gameplay controls; preserve all original observation assertions.
from knowledge_ui import run_knowledge_ui
run_knowledge_ui()
