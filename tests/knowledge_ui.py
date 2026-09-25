"""Optional knowledge-policy and cultural-archive UI, exact modules, offline storage double."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixture import HTML, storage
import json,subprocess
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'evidence-ui';OUT.mkdir(exist_ok=True)

def run_knowledge_ui():
    # Earn knowledge through actual productive simulation, rather than granting it
    # via the UI or asserting that a fabricated belief proves gameplay discovery.
    source="""
import {createWorld,step,serialize,validate} from './src/engine.mjs';
const s=createWorld(42),camp=s.buildings[0],near=a=>Math.abs(a.x-camp.x)+Math.abs(a.y-camp.y)<=4;
let result;
for(let i=0;i<5000;i++){
 step(s);
 const author=s.agents.find(a=>a.alive&&near(a)&&a.knowledgeState.beliefs.some(b=>b.status==='CONFIRMED'));
 const reader=author&&s.agents.find(a=>a.alive&&a.id!==author.id&&near(a));
 if(author&&reader){
  if(validate(s).length)throw Error(validate(s).join(','));
  result={saved:serialize(s),author:author.id,reader:reader.id,key:author.knowledgeState.beliefs.find(b=>b.status==='CONFIRMED').key};break;
 }
}
if(!result)throw Error('No earned knowledge fixture');
console.log(JSON.stringify(result));
"""
    data=json.loads(subprocess.check_output(['node','--input-type=module','-e',source],cwd=ROOT,text=True))
    checks=[];errors=[]
    def check(name,condition):
        assert condition,name
        checks.append(name);print('PASS',name,flush=True)
    def snap(page):return page.evaluate('simclone.snapshot()')
    def boot(browser,saved):
        page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        page.on('pageerror',lambda e:errors.append(str(e)))
        storage(page,saved);page.set_content(HTML,wait_until='load')
        page.wait_for_function('window.simclone?.uiVersion==="0.5.0"')
        page.wait_for_selector('#boot-screen',state='detached')
        if page.locator('#pause').get_attribute('aria-pressed')!='true':page.locator('#pause').click()
        return page
    def tap_building(page,building_type):
        s=snap(page);b=next(x for x in s['buildings'] if x['type']==building_type)
        p=page.evaluate('(q)=>simclone.screenPoint(q.x,q.y)',{'x':b['x'],'y':b['y']});box=page.locator('#world').bounding_box()
        page.mouse.click(box['x']+p['x'],box['y']+p['y'])
        page.wait_for_function("document.querySelector('#dialog')?.open")
    def person(page,id):
        page.locator('[data-nav="people"]').click();page.locator(f'[data-person="{id}"]').click()
        if not page.locator('[data-tab="knowledge"]').is_visible():page.locator('[data-ux="why"]').click()
        page.locator('[data-tab="knowledge"]').click()
    with sync_playwright() as p:
        exe='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None
        browser=p.chromium.launch(executable_path=exe,headless=True,args=['--no-sandbox'])
        page=boot(browser,data['saved']);before=snap(page)
        tap_building(page,'camp')
        check('opening camp archive controls does not alter the world',snap(page)==before and page.locator('#dialog').get_attribute('data-kind')=='structure')
        page.locator('[data-ux="create-archive"]').click();built=snap(page)
        check('archive UI pays exact materials through engine command',built['stock']['wood']==before['stock']['wood']-6 and built['stock']['stone']==before['stock']['stone']-2)
        check('constructed archive has no duplicate purchase control',page.locator('[data-ux="create-archive"]').count()==0 and built['culture']['entries']==[])
        page.locator('[data-ux="culture-automation"]').click()
        check('archive automation can be explicitly paused',snap(page)['culture']['automation'] is False)
        page.locator('#dialog-close').click();page.locator('.resources [role="button"]').click();page.locator('[data-ux="planning-policy"]').click()
        check('personal planner opt-in is explicit and saved',snap(page)['planningPolicy']=='personal-knowledge-1' and json.loads(page.evaluate('localStorage.getItem("simclone:world:v1")'))['planningPolicy']=='personal-knowledge-1')
        page.locator('#dialog-close').click();person(page,data['author'])
        skills=next(a['skills'] for a in snap(page)['agents'] if a['id']==data['author'])
        page.locator(f'[data-ux="publish-knowledge"][data-key="{data["key"]}"]').click()
        check('earned knowledge can be published from its inspector',len(snap(page)['culture']['entries'])==1)
        page.locator(f'[data-ux="verify-knowledge"][data-key="{data["key"]}"]').click()
        author=next(a for a in snap(page)['agents'] if a['id']==data['author'])
        check('verification creates evidence without awarding XP',author['skills']==skills and any(e['evidenceId'].startswith('know:verify:') for e in author['knowledgeState']['evidence']))
        person(page,data['reader']);tap_building(page,'camp')
        check('camp renders archive knowledge graph from retained entries',page.locator('.knowledge-graph-card').count()==1 and page.locator('[data-kg-key]').count()>=1 and page.locator('.kg-edge').count()>=1)
        page.locator(f'[data-kg-key="{data["key"]}"]').click()
        check('knowledge graph node selection updates evidence detail',page.locator('#kg-detail').get_attribute('data-kg-selected')==data['key'])
        page.locator('[data-kg-filter="food"]').click()
        check('knowledge graph filter is interactive',page.locator('[data-kg-filter="food"]').get_attribute('class').find('active')>=0)
        page.locator(f'[data-ux="read-archive"][data-key="{data["key"]}"]').click()
        reader=next(a for a in snap(page)['agents'] if a['id']==data['reader'])
        belief=next(b for b in reader['knowledgeState']['beliefs'] if b['key']==data['key'])
        check('reading a publication produces unverified knowledge with original author',belief['status']=='UNVERIFIED' and belief['sourceAgentId']==data['author'])
        page.locator('#dialog-close').click();page.locator('[data-tab="knowledge"]').click()
        check('knowledge UI distinguishes archive evidence from live sharing','อ่านคลังที่บันทึกโดย' in page.locator('#ux-tab-content').inner_text())
        check('knowledge controls fit mobile width',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        page.screenshot(path=str(OUT/'mobile-cultural-knowledge.png'))
        saved=page.evaluate('localStorage.getItem("simclone:world:v1")');loaded=boot(browser,saved)
        check('knowledge policy and archive survive a fresh document',snap(loaded).get('planningPolicy')=='personal-knowledge-1' and len(snap(loaded)['culture']['entries'])==1)
        check('knowledge UI has no uncaught runtime errors',not errors)
        (OUT/'knowledge-results.json').write_text(json.dumps({'result':'SAT','passed':len(checks),'checks':checks,'pageErrors':errors,'scope':'Offline Chromium 390x844; earned simulation fixture; explicit Storage double. Not native/public HTTP or physical Android.'},ensure_ascii=False,indent=2))
        browser.close()

if __name__=='__main__':run_knowledge_ui()
