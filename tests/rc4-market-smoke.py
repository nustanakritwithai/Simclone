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
    page.wait_for_selector('.help-block, [data-action^="rc4-"]')
def click_locator(locator,label):
    b=locator.first;b.scroll_into_view_if_needed();check(label+' visible',b.is_visible());b.click()
def action(name):
    return page.locator(f'[data-action="{name}"]')
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
        s=snap();producer=s['agents'][0];merchant=s['agents'][1];customer=s['agents'][2]
        sale=next(i for i in s['rustPossessions']['items'] if i['kind']=='STONE_AXE' and i['createdBy']==producer['id'] and i['location']=={'kind':'bag','agentId':producer['id']})
        check(f'{width}: canonical Producer item provenance',sale['createdBy']==producer['id'])
        check(f'{width}: wallet bootstrap',all(a['balance']==100 for a in s['currencyWallet']['accounts']))

        # B prepares a CLOSED Home Market and a canonical BuyOffer before profession adoption.
        select_actor(merchant['id']);open_market()
        click_locator(action('rc4-create-market'),f'{width}: prepare Home Market')
        click_locator(page.locator('[data-action="rc4-create-offer"][data-kind="STONE_AXE"]'),f'{width}: create BuyOffer 70')
        click_locator(action('rc4-become-merchant'),f'{width}: qualify Merchant')
        check(f'{width}: Merchant profession',snap()['agents'][1]['profession']=='merchant')
        click_locator(action('rc4-open-market'),f'{width}: open Home Market')
        s=snap();market=s['homeMarkets']['markets'][0];offer=s['merchantBuyOffers']['buyOffers'][0]
        check(f'{width}: Home Market OPEN',market['status']=='open')
        check(f'{width}: BuyOffer OPEN 70',offer['status']=='OPEN' and offer['unitPrice']==70 and offer['itemKind']=='STONE_AXE')
        check(f'{width}: market dialog fits',no_overflow())
        page.screenshot(path=str(OUT/f'{width}-merchant-open-buyoffer.png'))

        # Producer A answers BuyOffer using the exact crafted item.
        select_actor(producer['id']);open_market()
        click_locator(page.locator(f'[data-action="rc4-accept-offer"][data-item="{sale["id"]}"]'),f'{width}: Producer accepts BuyOffer')
        s=snap();procurement=next(l for l in s['merchantListings']['listings'] if l['sellerId']==producer['id'] and l['itemInstanceId']==sale['id'])
        check(f'{width}: procurement Listing 70',procurement['status']=='OPEN' and procurement['unitPrice']==70)

        # Merchant B physically walks to own market and buys A's exact item for 70.
        select_actor(merchant['id']);open_market()
        click_locator(action('rc4-travel-market'),f'{width}: Merchant walks to market')
        resume5()
        page.wait_for_function(f"""()=>{{const a=simclone.snapshot().agents.find(a=>a.id==={merchant['id']});return a?.task?.rc4MarketTravel&&a.task.path.length===0;}}""",timeout=30000)
        pause();open_market()
        check(f'{width}: Merchant NAVIGATION VERIFIED','NAVIGATION VERIFIED' in page.locator('#dialog-body').inner_text())
        click_locator(action('rc4-buy-listing'),f'{width}: Merchant buys Producer item 70')
        s=snap()
        check(f'{width}: exact item A->B',next(i for i in s['rustPossessions']['items'] if i['id']==sale['id'])['location']=={'kind':'bag','agentId':merchant['id']})
        check(f'{width}: Merchant balance 30',next(a for a in s['currencyWallet']['accounts'] if a['agentId']==merchant['id'])['balance']==30)
        check(f'{width}: Producer balance 170',next(a for a in s['currencyWallet']['accounts'] if a['agentId']==producer['id'])['balance']==170)

        # Merchant lists the acquired physical item for 100.
        select_actor(merchant['id']);open_market()
        click_locator(page.locator(f'[data-action="rc4-list-item"][data-item="{sale["id"]}"]'),f'{width}: Merchant lists exact item 100')
        s=snap();resale=next(l for l in s['merchantListings']['listings'] if l['sellerId']==merchant['id'] and l['itemInstanceId']==sale['id'] and l['status']=='OPEN')
        check(f'{width}: resale Listing canonical',resale['unitPrice']==100 and resale['revision']==1)

        # Customer C physically walks and purchases for 100.
        select_actor(customer['id']);open_market()
        click_locator(action('rc4-travel-market'),f'{width}: Customer walks to market')
        resume5()
        page.wait_for_function(f"""()=>{{const a=simclone.snapshot().agents.find(a=>a.id==={customer['id']});return a?.task?.rc4MarketTravel&&a.task.path.length===0;}}""",timeout=30000)
        pause();open_market()
        check(f'{width}: Customer NAVIGATION VERIFIED','NAVIGATION VERIFIED' in page.locator('#dialog-body').inner_text())
        click_locator(action('rc4-buy-listing'),f'{width}: Customer buys 100')
        final=snap()
        fm=next(a for a in final['agents'] if a['id']==merchant['id']);fc=next(a for a in final['agents'] if a['id']==customer['id'])
        check(f'{width}: money conserved',sum(a['balance'] for a in final['currencyWallet']['accounts'])==len(final['agents'])*100)
        check(f'{width}: Customer balance 0',next(a for a in final['currencyWallet']['accounts'] if a['agentId']==customer['id'])['balance']==0)
        check(f'{width}: Merchant final balance 130',next(a for a in final['currencyWallet']['accounts'] if a['agentId']==merchant['id'])['balance']==130)
        check(f'{width}: Producer final balance 170',next(a for a in final['currencyWallet']['accounts'] if a['agentId']==producer['id'])['balance']==170)
        moved=next(i for i in final['rustPossessions']['items'] if i['id']==sale['id'])
        check(f'{width}: exact item B->C',moved['location']=={'kind':'bag','agentId':customer['id']})
        filled=next(l for l in final['merchantListings']['listings'] if l['id']==resale['id'])
        check(f'{width}: resale FILLED revision 2',filled['status']=='FILLED' and filled['quantity']==0 and filled['revision']==2)
        check(f'{width}: two committed Reservations',sum(1 for x in final['merchantReservations']['reservations'] if x['status']=='COMMITTED')==2)
        ledger=next(l for l in final['merchantLedgers']['ledgers'] if l['merchantId']==merchant['id'])
        check(f'{width}: Ledger 100/70/30',ledger['revenue']==100 and ledger['costOfGoodsSold']==70 and ledger['realizedProfit']==30)
        check(f'{width}: acquisition basis consumed',len(ledger['purchases'])==1 and ledger['purchases'][0]['unitPrice']==70 and ledger['purchases'][0]['remainingItemIds']==[])
        check(f'{width}: Career counted two committed trades',fm.get('merchantTransactions')==2 and fm.get('merchantExperience')==2)
        check(f'{width}: customer travel task cleared',fc.get('task') is None)
        check(f'{width}: UI shows accounting','Revenue 100' in page.locator('#dialog-body').inner_text() and 'COGS 70' in page.locator('#dialog-body').inner_text() and 'Profit 30' in page.locator('#dialog-body').inner_text())
        check(f'{width}: final dialog fits',no_overflow())
        page.screenshot(path=str(OUT/f'{width}-verified-vertical-100-70-30.png'))
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
