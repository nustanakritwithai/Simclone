"""RC4 Merchant Economy native browser proof: real UI clicks and real simulation movement."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright
import json,subprocess

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'evidence-ui'/'rc4-market-native';OUT.mkdir(parents=True,exist_ok=True)
SAVED=subprocess.check_output(['node','scripts/rc4-market-fixture.mjs'],cwd=ROOT,text=True)
checks=[];errors=[];success=False;failure=None;server=None;browser=None;pw=None;page=None

def check(name,ok=True):
    assert ok,name;checks.append(name);print('PASS',name,flush=True)
def snap(): return page.evaluate('simclone.snapshot()')
def close():
    if page.locator('#dialog').evaluate('(e)=>e.open'): page.locator('#dialog-close').click()
def pause():
    if page.locator('#pause').inner_text()!='▶': page.locator('#pause').click()
def resume5():
    close();page.locator('[data-speed="5"]').click()
    if page.locator('#pause').inner_text()=='▶': page.locator('#pause').click()
def select_actor(aid):
    close()
    q=page.locator(f'[data-quick-person="{aid}"]')
    if q.count() and q.first.is_visible(): q.first.click()
    else:
        page.locator('[data-nav="people"]').click()
        page.locator(f'[data-person="{aid}"]').first.click()
def open_market():
    close()
    b=page.locator('#market')
    if b.count() and b.is_visible(): b.click()
    else:
        page.locator('#menu').click()
        page.locator('[data-action="market"]').click()
    page.wait_for_selector('[data-action="rc4-become-merchant"], [data-action="rc4-create-market"], [data-action="rc4-open-market"], [data-action="rc4-close-market"], .help-block')
def click_action(name):
    b=page.locator(f'[data-action="{name}"]').first
    b.scroll_into_view_if_needed();check(name+' visible',b.is_visible());b.click()
def no_overflow():
    return page.evaluate('document.documentElement.scrollWidth<=innerWidth+1 && (!document.querySelector("#dialog").open || document.querySelector("#dialog-body").scrollWidth<=document.querySelector("#dialog-body").clientWidth+1)')

try:
    class Quiet(SimpleHTTPRequestHandler):
        def log_message(self,*args): pass
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
    Thread(target=server.serve_forever,daemon=True).start();BASE=f'http://127.0.0.1:{server.server_port}'
    pw=sync_playwright().start();exe='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None
    browser=pw.chromium.launch(executable_path=exe,headless=True,args=['--no-sandbox'])
    for width,height in [(1440,1000),(390,844)]:
        errors=[]
        ctx=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<700,has_touch=True)
        page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.set_default_timeout(30000)
        page.add_init_script("localStorage.clear();localStorage.setItem('simclone:world:v1',"+json.dumps(SAVED)+");")
        r=page.goto(BASE+'/?rc4-native=1',wait_until='load',timeout=60000);check(f'{width}: HTTP',r and r.ok)
        page.wait_for_function("window.simclone?.uiVersion==='0.5.0'");pause()
        s=snap();merchant=s['agents'][0];buyer=s['agents'][1]
        sale=next(i for i in s['rustPossessions']['items'] if i['kind']=='STONE_AXE' and i['createdBy']==merchant['id'] and i['location']['kind']=='bag')
        check(f'{width}: canonical fixture sale provenance',sale['createdBy']==merchant['id'])
        check(f'{width}: wallet bootstrap visible',next(a for a in s['currencyWallet']['accounts'] if a['agentId']==merchant['id'])['balance']==100)

        select_actor(merchant['id']);open_market()
        click_action('rc4-become-merchant')
        check(f'{width}: Merchant profession through UI',snap()['agents'][0]['profession']=='merchant')
        click_action('rc4-create-market');click_action('rc4-open-market')
        click_action('rc4-list-item')
        s=snap();market=s['homeMarkets']['markets'][0];listing=s['merchantListings']['listings'][0]
        check(f'{width}: Home Market OPEN',market['status']=='open')
        check(f'{width}: Listing canonical OPEN/revision',listing['status']=='OPEN' and listing['revision']==1 and listing['itemInstanceId']==sale['id'])
        check(f'{width}: Market dialog fits',no_overflow())
        page.screenshot(path=str(OUT/f'{width}-merchant-market.png'))

        select_actor(buyer['id']);open_market();click_action('rc4-travel-market')
        resume5()
        page.wait_for_function(f"""()=>{{const a=simclone.snapshot().agents.find(a=>a.id==={buyer['id']});return a?.task?.rc4MarketTravel&&a.task.path.length===0;}}""",timeout=30000)
        pause();open_market()
        check(f'{width}: NAVIGATION VERIFIED shown','NAVIGATION VERIFIED' in page.locator('#dialog-body').inner_text())
        click_action('rc4-buy-listing')
        final=snap()
        fm=next(a for a in final['agents'] if a['id']==merchant['id']);fb=next(a for a in final['agents'] if a['id']==buyer['id'])
        check(f'{width}: money conserved',sum(a['balance'] for a in final['currencyWallet']['accounts'])==len(final['agents'])*100)
        check(f'{width}: buyer pays 100',next(a for a in final['currencyWallet']['accounts'] if a['agentId']==buyer['id'])['balance']==0)
        check(f'{width}: merchant receives 100',next(a for a in final['currencyWallet']['accounts'] if a['agentId']==merchant['id'])['balance']==200)
        moved=next(i for i in final['rustPossessions']['items'] if i['id']==sale['id'])
        check(f'{width}: exact item moved once',moved['location']=={'kind':'bag','agentId':buyer['id']})
        filled=next(l for l in final['merchantListings']['listings'] if l['id']==listing['id'])
        check(f'{width}: Listing FILLED revision 2',filled['status']=='FILLED' and filled['quantity']==0 and filled['revision']==2)
        reservation=final['merchantReservations']['reservations'][-1]
        check(f'{width}: Reservation COMMITTED',reservation['status']=='COMMITTED' and reservation.get('transactionId'))
        ledger=next(l for l in final['merchantLedgers']['ledgers'] if l['merchantId']==merchant['id'])
        check(f'{width}: Ledger Revenue/COGS/Profit',ledger['revenue']==100 and ledger['costOfGoodsSold']==0 and ledger['realizedProfit']==100)
        check(f'{width}: Career counted once',fm.get('merchantTransactions')==1 and fm.get('merchantExperience')==1)
        check(f'{width}: buyer travel task cleared',fb.get('task') is None)
        check(f'{width}: UI shows accounting','Revenue 100' in page.locator('#dialog-body').inner_text())
        check(f'{width}: final dialog fits',no_overflow())
        page.screenshot(path=str(OUT/f'{width}-verified-sale.png'))
        check(f'{width}: no browser errors',not errors)
        ctx.close()
    success=True
except Exception as e:
    failure=str(e);raise
finally:
    if browser:
        try: browser.close()
        except Exception: pass
    if pw: pw.stop()
    if server: server.shutdown()
    (OUT/'report.json').write_text(json.dumps({'result':'SAT' if success else 'VIOL','checks':checks,'failure':failure},ensure_ascii=False,indent=2))
print(json.dumps({'result':'SAT','checks':len(checks)}))
