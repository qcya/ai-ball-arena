"""Offline browser acceptance and deterministic display-clock regression (no external network)."""
from pathlib import Path
import json, os, shutil, statistics
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
checks=[]; errors=[]; motion=[]
def check(ok,name):
    assert ok,name
    checks.append(name)
CLOCK='''window.__clock=0;window.requestAnimationFrame=f=>{window.__frame=f;return 1;};Object.defineProperty(performance,'now',{value:()=>window.__clock});window.advance=(ms)=>{window.__clock+=ms;const f=window.__frame;if(f)f(window.__clock);};'''
FIXTURE='''()=>{const w=game.world;game.input.clear();game.freeze=true;game.paused=false;w.finished=false;w.time=5;w.food=[];w.pellets=[];w.thorns=[];w.options.foodCount=0;w.options.thornCount=0;for(const p of w.players){p.cells=[];p.respawnAt=Infinity;p.nextSplit=0;p.nextEject=0;}const p=w.players[game.human];p.cells=[w.makeCell(p.id,1000,900,240)];game.camera={x:1000,y:900,z:.96};game.view='follow';game.zoom=1;if(game.render)game.render.reset(w);advance(1000/60);}'''
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':900});page.add_init_script(CLOCK)
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.evaluate(CLOCK);page.set_content((ROOT/'index.html').read_text(encoding='utf-8'),wait_until='load');page.locator('#startGame').click()
    check(page.evaluate('game.images.every(i=>i.complete&&i.naturalWidth>0)'),'six offline logos load')
    check(page.evaluate('game.sfx.context.state')=='running','sound unlocks after click')
    page.evaluate(FIXTURE)
    page.evaluate('''()=>{const w=game.world,p=w.players[game.human];p.cells=[w.makeCell(p.id,1000,650,240),w.makeCell(p.id,1400,1050,240)];p.cells.forEach(c=>c.mergeAt=100);game.render.reset(w);advance(1000/60);}''')
    def point(x,y):
        return page.evaluate('''([x,y])=>{const r=document.querySelector('#arena').getBoundingClientRect(),c=game.camera;return{x:(x-c.x)*c.z+r.width/2+r.left,y:(y-c.y)*c.z+r.height/2+r.top};}''',[x,y])
    target=point(1200,850);page.mouse.move(target['x'],target['y']);page.mouse.down(button='left');page.evaluate('advance(1000/60)');page.mouse.up(button='left')
    vectors=page.evaluate('game.world.pellets.map(p=>[p.vx,p.vy])')
    check(len(vectors)==2 and vectors[0][0]>0 and vectors[1][0]<0,'left-click still aims from each cell toward mouse')
    target=point(1600,800);page.mouse.move(target['x'],target['y']);page.keyboard.down('Space');page.evaluate('advance(1000/60)')
    action=page.evaluate('game.record.at(-1).actions[game.human]')
    check(action['gather'] and not action['split'] and not action['eject'] and 'gatherAtX' in action,'Space gathers only, independent target recorded')
    page.keyboard.up('Space');page.evaluate('advance(1000/60)')
    check(not page.evaluate('game.record.at(-1).actions[game.human].gather'),'Space release stops gathering')
    page.evaluate(FIXTURE);page.keyboard.down('d');page.evaluate('for(let i=0;i<30;i++)advance(1000/120)');page.keyboard.up('d')
    check(page.evaluate('game.world.players[game.human].cells[0].x')>1000,'WASD works at high refresh')
    page.evaluate(FIXTURE);page.evaluate('''()=>{const w=game.world,c=w.players[game.human].cells[0];w.addFood(c.x,c.y);game.sfx.played={};advance(1000/60);}''')
    check(page.evaluate('(game.sfx.played.foodEat||0)')==0,'food stays silent')
    check(page.locator('[data-sfx="foodEat"]').count()==0,'no food audition button')
    page.evaluate(FIXTURE);page.evaluate('''()=>{const w=game.world,c=w.players[game.human].cells[0];c.mass=400;c.shieldUntil=0;w.addThorn(c.x,c.y);game.render.reset(w);advance(1000/60);}''')
    check(page.evaluate('game.world.mass(game.human)')==480,'thorn visibly grants +20 percent')
    check(page.evaluate('game.world.players[game.human].cells.length')==4,'thorn creates exactly four fragments')
    check(page.evaluate('game.world.players[game.human].cells.every(c=>c.mass===120&&c.mergeAt>game.world.time)'),'fragments have correct mass and merge cooldown')
    check('+20%' in page.locator('#toast').inner_text(),'thorn toast describes reward, not damage')
    check(page.evaluate('(game.sfx.played.burst||0)>0'),'thorn SFX kept')
    page.evaluate('for(let i=0;i<24;i++)advance(1000/120)')
    page.screenshot(path=str(ROOT/'tests/v04-thorn.png'))
    # Persisted DOM must survive HUD updates; old innerHTML loop replaced every SVG element.
    page.evaluate('window.rankImage=document.querySelector("#rankList img")')
    page.evaluate('for(let i=0;i<100;i++)advance(1000/120)')
    check(page.evaluate('rankImage.isConnected'),'leaderboard SVG nodes not recreated on HUD ticks')
    # Verify burst growth from physical pellets is available, not a bot-specific cheat.
    page.evaluate(FIXTURE);page.evaluate('''()=>{const w=game.world,c=w.players[game.human].cells[0];c.mass=120;for(let i=0;i<8;i++){const f=w.addPellet(c.x-20,c.y,10,c.owner);f.born=w.time-1;}const id=(c.owner+1)%6;w.players[id].cells=[w.makeCell(id,c.x+24,c.y,150)];advance(1000/60);}''')
    check(page.evaluate('game.world.mass(game.human)')==350,'eat eight cached pellets then swallow 150-mass opponent in one step')
    check(page.evaluate('game.world.pellets.length')==0,'cached pellets removed once')
    # Versioned replay produces exactly the same simulation, independent of render sampling.
    page.locator('[data-mode="solo"]').click();page.evaluate('for(let i=0;i<120;i++)advance(1000/120)');page.keyboard.down('d');page.evaluate('for(let i=0;i<90;i++)advance(1000/120)');page.keyboard.up('d')
    rep=page.evaluate('game.exportReplay()');expected=page.evaluate('game.world.snapshot()')
    check(rep['engine']=='0.4.0','new replay version is 0.4.0')
    page.evaluate('(data)=>game.importReplay(data)',rep);page.evaluate('(n)=>{for(let i=0;i<n;i++)advance(1000/60)}',len(rep['frames']))
    check(page.evaluate('game.world.snapshot()')==expected,'replay and original authoritative states identical')
    check(page.evaluate('''()=>{try{game.importReplay({...game.exportReplay(),engine:'0.3.0'});return false}catch{return true}}'''),'old-physics replay rejected explicitly')
    for mode in ['team','storm','solo']:
        page.locator('[data-mode="'+mode+'"]').click();page.evaluate('advance(1000/60)');check(page.evaluate('game.world.mode')==mode,mode+' starts')
    page.evaluate(FIXTURE);page.keyboard.down('Space');page.evaluate('window.dispatchEvent(new Event("blur"))');page.keyboard.up('Space')
    check(page.evaluate('game.paused&&!game.input.keys.size'),'focus loss clears controls and pauses')
    # Comparison uses identical deterministic display timestamps and constant WASD input.
    baseline=Path(os.environ.get('BASELINE_HTML','/mnt/data/AI_Ball_Arena_v0.3.html'))
    sources=[('v0.4',ROOT/'index.html')]
    if baseline.exists():sources.insert(0,('v0.3',baseline))
    for label,html in sources:
        mp=browser.new_page(viewport={'width':1440,'height':900});mp.add_init_script(CLOCK);mp.on('pageerror',lambda e:errors.append(str(e)))
        mp.evaluate(CLOCK);mp.set_content(html.read_text(encoding='utf-8'),wait_until='load');mp.locator('#startGame').click()
        for hz in [60,120,144,165,240,260]:
            mp.locator('[data-mode="solo"]').click();mp.evaluate(FIXTURE)
            result=mp.evaluate('''(hz)=>{game.input.key('KeyD',true);const xs=[];for(let i=0;i<hz*3;i++){advance(1000/hz);if(i>=hz){const c=game.world.players[game.human].cells[0],v=game.render?game.render.cell(c):c;const rect=document.querySelector('#arena').getBoundingClientRect();xs.push((v.x-game.camera.x)*game.camera.z+rect.width/2);}}game.input.clear();return xs;}''',hz)
            delta=[b-a for a,b in zip(result,result[1:])];row={'version':label,'hz':hz,'screen_delta_std_px':round(statistics.pstdev(delta),6),'max_screen_step_px':round(max(abs(x) for x in delta),6)};motion.append(row)
            if label=='v0.4':check(row['screen_delta_std_px']<.04,f'smooth camera + ball at {hz} Hz')
        mp.close()
    page.locator('[data-mode="solo"]').click();page.evaluate('for(let i=0;i<150;i++)advance(1000/120)');page.screenshot(path=str(ROOT/'tests/v04-gameplay.png'))
    check(not errors,'no browser exceptions')
    browser.close()
report={'checks':checks,'passed':len(checks),'errors':errors,'motion':motion,'note':'Synthetic refresh clocks test synchronization, not actual monitor FPS. Browser/headless hardware differs from the user device.'}
(ROOT/'tests/browser-v04-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
