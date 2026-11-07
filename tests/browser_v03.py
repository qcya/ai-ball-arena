"""v0.3 browser acceptance. Requires playwright and a Chromium installation."""
from pathlib import Path
import json, os, shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
checks=[]
def check(ok,name):
    assert ok,name
    checks.append(name)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':900})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    html=ROOT/'dist/ball-arena.html'
    if not html.exists():html=ROOT/'球球竞技场.html'
    page.set_content(html.read_text(encoding='utf-8'),wait_until='load');page.locator('#startGame').click();page.wait_for_timeout(100)
    check(page.evaluate('game.images.every(i=>i.complete&&i.naturalWidth>0)'),'six logos load offline')
    check(page.evaluate('game.sfx.context.state')=='running','audio unlocks')
    def fixture():
        page.evaluate('''()=>{const w=game.world;game.input.clear();game.freeze=true;game.paused=false;w.finished=false;w.time=5;w.food=[];w.pellets=[];w.thorns=[];w.options.foodCount=0;w.options.thornCount=0;for(const p of w.players){p.cells=[];p.respawnAt=Infinity;p.nextSplit=0;p.nextEject=0;}const p=w.players[game.human];p.cells=[w.makeCell(p.id,1000,650,240),w.makeCell(p.id,1400,1050,240)];p.cells.forEach(c=>c.mergeAt=100);game.camera={x:1200,y:850,z:.92};}''')
        page.locator('#arena').focus()
    def point(x,y):
        return page.evaluate('''([x,y])=>{const r=document.querySelector('#arena').getBoundingClientRect(),c=game.camera;return{x:(x-c.x)*c.z+r.width/2+r.left,y:(y-c.y)*c.z+r.height/2+r.top};}''',[x,y])
    fixture()
    target=point(1200,850);page.mouse.move(target['x'],target['y']);page.mouse.down(button='left');page.wait_for_timeout(50);page.mouse.up(button='left')
    result=page.evaluate('game.world.pellets.map(p=>({vx:p.vx,vy:p.vy}))')
    check(len(result)>=2 and result[0]['vx']>0 and result[0]['vy']>0 and result[1]['vx']<0 and result[1]['vy']<0,'mouse between cells produces converging eject vectors')
    page.screenshot(path=str(ROOT/'tests/v03-per-cell-aim.png'))
    fixture();target=point(1600,800);page.mouse.move(target['x'],target['y']);page.keyboard.down('Space');page.wait_for_timeout(140);page.keyboard.up('Space')
    result=page.evaluate('({cells:game.world.players[game.human].cells,pellets:game.world.pellets.length,action:game.record.at(-1).actions[game.human]})')
    check(len(result['cells'])==2 and result['pellets']==0,'Space neither splits nor ejects')
    check(all(c['x']>initial for c,initial in zip(result['cells'],[1000,1400])),'all cells gather toward mouse on the right, not centroid')
    check(result['action'].get('gather') is True and 'gatherAtX' in result['action'],'gather point recorded in replay')
    page.screenshot(path=str(ROOT/'tests/v03-gather.png'))
    page.wait_for_timeout(30)
    check(page.evaluate('game.record.at(-1).actions[game.human].gather') is False,'releasing Space stops gathering')
    fixture();target=point(1600,850);page.mouse.move(target['x'],target['y']);page.mouse.click(target['x'],target['y'],button='right');page.wait_for_timeout(70)
    check(page.evaluate('game.world.players[game.human].cells.length')==4,'right-click still splits')
    check(page.evaluate('(game.sfx.played.split||0)>0'),'split SFX remains')
    fixture();page.evaluate('''()=>{const w=game.world,c=w.players[game.human].cells[0];w.addFood(c.x,c.y);game.sfx.played={};}''');page.wait_for_timeout(70)
    check(page.evaluate('game.world.events.some(e=>e.type==="foodEat")'),'food is still consumed')
    check(page.evaluate('(game.sfx.played.foodEat||0)')==0,'ordinary food produces no SFX')
    check(page.locator('[data-sfx="foodEat"]').count()==0,'food audition removed')
    fixture();page.keyboard.down('w');page.wait_for_timeout(90);page.keyboard.up('w')
    check(page.evaluate('game.world.players[game.human].cells[0].y')<650,'WASD preserved')
    page.keyboard.down('Space');page.evaluate('window.dispatchEvent(new Event("blur"))');page.keyboard.up('Space')
    check(page.evaluate('game.paused&&!game.input.keys.size'),'focus loss clears gathering and pauses')
    for mode in ['team','storm','solo']:
        page.locator('[data-mode="'+mode+'"]').click();page.wait_for_timeout(60)
        check(page.evaluate('game.world.mode')==mode,mode+' mode starts')
    check(not errors,'no browser exceptions')
    page.screenshot(path=str(ROOT/'tests/v03-gameplay.png'))
    browser.close()
(ROOT/'tests/browser-v03-report.json').write_text(json.dumps({'checks':checks,'passed':len(checks),'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'passed':len(checks),'errors':errors},ensure_ascii=False))
