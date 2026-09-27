"""D1 visual proof. Offline Chromium, no gameplay authority changes."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixture import fixture

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'evidence-display-d1'
OUT.mkdir(exist_ok=True)
HTML=fixture(default_mode='independent')

def boot(page):
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(HTML,wait_until='load')
    page.wait_for_function("window.simclone?.uiVersion==='0.5.0'")
    page.wait_for_timeout(250)
    assert not errors, errors
    return errors

def frame_world(page,x,y):
    box=page.locator('#world').bounding_box()
    safe=page.evaluate('simclone.safeFrame()')
    p=page.evaluate('(q)=>simclone.screenPoint(q.x,q.y)',{'x':x,'y':y})
    tx=(safe['left']+safe['right'])/2
    ty=(safe['top']+safe['bottom'])/2
    sx=(safe['left']+safe['right'])/2
    sy=(safe['top']+safe['bottom'])/2
    page.mouse.move(box['x']+sx,box['y']+sy)
    page.mouse.down()
    page.mouse.move(box['x']+sx+(tx-p['x']),box['y']+sy+(ty-p['y']),steps=10)
    page.mouse.up()
    page.wait_for_timeout(180)

with sync_playwright() as p:
    exe='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None
    browser=p.chromium.launch(executable_path=exe,headless=True,args=['--no-sandbox'])

    desktop=browser.new_page(viewport={'width':1440,'height':1000})
    boot(desktop)
    snap=desktop.evaluate('simclone.snapshot()')
    assert snap['worldBounds']['profile']=='same-world'
    assert len(snap['wildMonsters']['entities'])==12
    frame_world(desktop,71,4)
    desktop.screenshot(path=str(OUT/'desktop-adventure-zones.png'))

    mobile=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    boot(mobile)
    assert mobile.locator('.mobile-nav button').count()==5
    frame_world(mobile,60,25)
    assert mobile.evaluate('document.documentElement.scrollWidth<=innerWidth')
    mobile.screenshot(path=str(OUT/'mobile-adventure-entry.png'))

    browser.close()

print('D1_VISUAL_PROOF',OUT)
