"""Actual offline HTML: per-cell speed display, WASD movement and final team labels."""
from pathlib import Path
import json, os, shutil
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
CLOCK="window.__clock=0;window.requestAnimationFrame=f=>{window.__frame=f;return 1;};Object.defineProperty(performance,'now',{value:()=>window.__clock});window.advance=ms=>{window.__clock+=ms;window.__frame(window.__clock)};"
checks=[]
def check(ok,name):
    assert ok,name
    checks.append(name)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1440,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.evaluate('(()=>{'+CLOCK+'})();');page.set_content((R/'index.html').read_text(),wait_until='load')
    page.locator('#humanEnabled').check();page.locator('#startGame').click();page.wait_for_function('game.started&&!game.paused&&game.agents.ready')
    check(page.locator('#speedInfo').count()==1,'HUD has a base locomotion readout')
    setup="""m=>{game.input.clear();const w=game.world;w.time=5;w.food=[];w.pellets=[];w.thorns=[];w.options.foodCount=0;w.options.thornCount=0;const c=w.players[0].cells[0];Object.assign(c,{x:1000,y:900,mass:m,vx:0,vy:0});game.render.reset(w);advance(120);advance(120);}"""
    for mass,label,ratio in [(120,'100.0%',1),(240,'100.0%',1),(264,'98.6%',.9856169958682428),(480,'90.0%',.9),(960,'81.0%',.81)]:
        page.evaluate(setup,mass)
        check(label in page.locator('#speedInfo').inner_text(),f'mass {mass}: readable relative base speed')
        before=page.evaluate('({x:game.world.players[0].cells[0].x,t:game.world.time})')
        page.keyboard.down('KeyD');page.evaluate('for(let i=0;i<60;i++)advance(1000/60)');page.keyboard.up('KeyD')
        after=page.evaluate('({x:game.world.players[0].cells[0].x,t:game.world.time})')
        speed=(after['x']-before['x'])/(after['t']-before['t'])
        check(abs(speed-176.65175237370477*ratio)<1e-6,f'mass {mass}: real WASD speed matches curve')
    page.evaluate(setup,240)
    page.evaluate("()=>{const w=game.world,c=w.players[0].cells[0];c.mergeAt=999;const d=w.makeCell(0,1500,1200,960);d.mergeAt=999;w.players[0].cells.push(d);advance(120);advance(120)}")
    check('81.0–100.0%' in page.locator('#speedInfo').inner_text(),'mixed fragments show a speed range, not aggregate speed')
    page.evaluate('game.startMatch("team",42)');page.wait_for_function('!game.paused&&game.agents.ready')
    page.evaluate("()=>{game.agents.stop();game.freeze=true;game.world=new Arena.World({mode:'team',activeIds:[0,1,2,3],foodCount:0,thornCount:0,seed:42});game.world.players.forEach((p,id)=>p.team=id<2?0:1);const w=game.world;for(const id of [2,3]){w.players[id].cells=[];w.markDeath(w.players[id]);}game.render.reset(w);advance(120);advance(120)}")
    check(page.locator('#resultTitle').inner_text()=='蓝队获胜','team wipe still ends match')
    check('待重生' not in page.locator('#resultRanks').inner_text(),'ended team result never promises a respawn')
    check('已淘汰' in page.locator('#resultRanks').inner_text(),'ended team result labels eliminated members')
    check(not errors,'no page JavaScript errors')
    b.close()
(R/'tests/browser-speed-v06-report.json').write_text(json.dumps({'checks':checks},ensure_ascii=False,indent=2),encoding='utf-8')
print('PASS',len(checks),'browser speed and finished-team checks')
