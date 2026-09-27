"""D2 browser proof: unified hit priority + real canvas selection across target viewports."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'evidence-display-d2'
OUT.mkdir(exist_ok=True)

from browser_fixture import fixture
HTML=fixture(default_mode='independent')

VIEWPORTS=[
    ('desktop-1440x1000',1440,1000,False),
    ('mobile-390x844',390,844,True),
    ('mobile-320x740',320,740,True),
    ('landscape-844x390',844,390,True),
]

TIE_CASES=[
    ('monster-clone','agent',101,[
        {'kind':'monster','id':'wm:z1:0:0','distance':10,'hitRadius':40,'source':'monster'},
        {'kind':'agent','id':101,'distance':10,'hitRadius':40,'source':'agent'},
    ]),
    ('monster-resource','monster','wm:z1:0:0',[
        {'kind':'resource','id':7,'distance':10,'hitRadius':40,'source':'resource'},
        {'kind':'monster','id':'wm:z1:0:0','distance':10,'hitRadius':40,'source':'monster'},
    ]),
    ('drop-clone','agent',101,[
        {'kind':'drop','id':55,'distance':10,'hitRadius':40,'source':'drop'},
        {'kind':'agent','id':101,'distance':10,'hitRadius':40,'source':'agent'},
    ]),
    ('building-agent','agent',101,[
        {'kind':'building','id':9,'distance':10,'hitRadius':40,'source':'building'},
        {'kind':'agent','id':101,'distance':10,'hitRadius':40,'source':'agent'},
    ]),
    ('station-building','station',3,[
        {'kind':'building','id':9,'distance':10,'hitRadius':40,'source':'building'},
        {'kind':'station','id':3,'distance':10,'hitRadius':40,'source':'station'},
    ]),
    ('two-monsters','monster','wm:z1:1:0',[
        {'kind':'monster','id':'wm:z1:2:0','distance':10,'hitRadius':40,'source':'monster'},
        {'kind':'monster','id':'wm:z1:1:0','distance':10,'hitRadius':40,'source':'monster'},
    ]),
]

def boot(page):
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(HTML,wait_until='load')
    page.wait_for_function("window.simclone?.uiVersion==='0.5.0'")
    page.wait_for_timeout(180)
    assert not errors, errors

def pan_marker_to(page,monster,target_x,target_y):
    box=page.locator('#world').bounding_box()
    safe=page.evaluate('simclone.safeFrame()')
    p=page.evaluate('(m)=>simclone.screenPoint(m.x,m.y)',monster)
    zoom=page.evaluate('simclone.camera().zoom')
    marker_y=p['y']-20*zoom
    sx=(safe['left']+safe['right'])/2
    sy=(safe['top']+safe['bottom'])/2
    page.mouse.move(box['x']+sx,box['y']+sy)
    page.mouse.down()
    page.mouse.move(box['x']+sx+(target_x-p['x']),box['y']+sy+(target_y-marker_y),steps=10)
    page.mouse.up()
    page.wait_for_timeout(120)

with sync_playwright() as p:
    exe='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None
    browser=p.chromium.launch(executable_path=exe,headless=True,args=['--no-sandbox'])

    for label,width,height,mobile in VIEWPORTS:
        page=browser.new_page(viewport={'width':width,'height':height},is_mobile=mobile,has_touch=mobile)
        boot(page)

        for case,expected_kind,expected_id,candidates in TIE_CASES:
            hit=page.evaluate('(rows)=>simclone.resolveWorldHit(rows)',candidates)
            assert hit is not None,(label,case)
            assert hit['kind']==expected_kind,(label,case,hit)
            assert hit['id']==expected_id,(label,case,hit)

        snap=page.evaluate('simclone.snapshot()')
        monster=next(m for m in snap['wildMonsters']['entities'] if m['status'] not in ('DEFEATED','RESPAWNING'))
        safe=page.evaluate('simclone.safeFrame()')
        target_x=safe['left']+max(30,min(52,(safe['right']-safe['left'])*.12))
        target_y=safe['top']+max(34,min(58,(safe['bottom']-safe['top'])*.12))
        pan_marker_to(page,monster,target_x,target_y)

        mp=page.evaluate('(m)=>simclone.screenPoint(m.x,m.y)',monster)
        zoom=page.evaluate('simclone.camera().zoom')
        tap_y=mp['y']-20*zoom
        hit=page.evaluate('(q)=>simclone.worldTargetAtScreen(q.x,q.y)',{'x':mp['x'],'y':tap_y})
        assert hit is not None,(label,'real-monster-no-hit')
        assert hit['kind']=='monster' and hit['id']==monster['worldMonsterId'],(label,hit)

        box=page.locator('#world').bounding_box()
        assert page.evaluate('(q)=>document.elementFromPoint(q.x,q.y)?.id==="world"',{
            'x':box['x']+mp['x'],'y':box['y']+tap_y
        }),(label,'hud-boundary-covered')

        if mobile:
            for _ in range(4): page.locator('#zoom-out').tap()
        else:
            for _ in range(4): page.locator('#zoom-out').click()
        page.wait_for_timeout(80)
        safe=page.evaluate('simclone.safeFrame()')
        pan_marker_to(page,monster,(safe['left']+safe['right'])/2,(safe['top']+safe['bottom'])/2)
        mp=page.evaluate('(m)=>simclone.screenPoint(m.x,m.y)',monster)
        zoom=page.evaluate('simclone.camera().zoom')
        tap_y=mp['y']-20*zoom
        hit=page.evaluate('(q)=>simclone.worldTargetAtScreen(q.x,q.y)',{'x':mp['x'],'y':tap_y})
        assert hit and hit['kind']=='monster' and hit['id']==monster['worldMonsterId'],(label,'zoomed-out',hit)

        box=page.locator('#world').bounding_box()
        if mobile:
            page.touchscreen.tap(box['x']+mp['x'],box['y']+tap_y)
        else:
            page.mouse.click(box['x']+mp['x'],box['y']+tap_y)
        page.wait_for_selector('#dialog[open][data-kind="monster"]')
        sel=page.evaluate('simclone.worldSelection()')
        assert sel=={'kind':'monster','id':monster['worldMonsterId']},(label,'selection',sel)

        page.screenshot(path=str(OUT/(label+'.png')))
        page.close()

    browser.close()

print('D2_VISUAL_PROOF',OUT)
