"""Manual-controls and smooth-camera regression, using deterministic display timestamps."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,statistics,os,shutil
R=Path(__file__).resolve().parents[1]
CLOCK="window.__clock=0;window.requestAnimationFrame=f=>{window.__frame=f;return 1;};Object.defineProperty(performance,'now',{value:()=>window.__clock});window.advance=ms=>{window.__clock+=ms;window.__frame(window.__clock)};"
FIXTURE="""()=>{const w=game.world;game.input.clear();game.freeze=true;game.paused=false;w.finished=false;w.time=5;w.food=[];w.pellets=[];w.thorns=[];w.options.foodCount=0;w.options.thornCount=0;for(const p of w.players){p.cells=[];p.respawnAt=Infinity;p.nextSplit=0;p.nextEject=0;}const p=w.players[game.human];p.cells=[w.makeCell(p.id,1000,900,240)];game.camera={x:1000,y:900,z:.96};game.view='follow';game.zoom=1;game.render.reset(w);advance(1000/60);}"""
checks=[];motion=[]
def check(ok,name):
 assert ok,name
 checks.append(name)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.evaluate("(()=>{"+CLOCK+"})();");page.set_content((R/'index.html').read_text(),wait_until='load')
 page.locator('#humanEnabled').check();page.locator('#startGame').click();page.wait_for_function('game.started&&!game.paused&&game.agents.ready')
 check(page.evaluate('game.world.activeIds.join()')=='0','manual practice has no invisible opponent')
 page.evaluate(FIXTURE);page.evaluate("()=>{const w=game.world,p=w.players[0];p.cells=[w.makeCell(0,1000,650,240),w.makeCell(0,1400,1050,240)];p.cells.forEach(c=>c.mergeAt=100);game.render.reset(w);advance(1000/60)}")
 point=page.evaluate("()=>{const p=game.screenPoint(1200,850),r=document.querySelector('#arena').getBoundingClientRect();return{x:p.x+r.left,y:p.y+r.top}}")
 page.mouse.move(point['x'],point['y']);page.mouse.down(button='left');page.evaluate('advance(1000/60)');page.mouse.up(button='left');vel=page.evaluate('game.world.pellets.map(p=>[p.vx,p.vy])');check(len(vel)==2 and vel[0][0]>0 and vel[1][0]<0,'per-cell aim retained')
 page.keyboard.down('Space');page.evaluate('advance(1000/60)');action=page.evaluate('game.record.at(-1).actions[0]');check(action['gather'] and not action['split'] and not action['eject'],'Space only gathers');page.keyboard.up('Space')
 page.evaluate(FIXTURE);page.evaluate("()=>{const w=game.world,c=w.players[0].cells[0];w.addFood(c.x,c.y);game.sfx.played={};advance(1000/60)}");check(page.evaluate('(game.sfx.played.foodEat||0)')==0,'food remains silent')
 page.evaluate(FIXTURE);page.evaluate("()=>{const w=game.world,c=w.players[0].cells[0];c.mass=400;c.shieldUntil=0;w.addThorn(c.x,c.y);advance(1000/60)}");check(page.evaluate('game.world.mass(0)')==480,'thorn reward +20 percent');check(page.evaluate('game.world.players[0].cells.length')==4,'thorn exactly four fragments')
 page.evaluate(FIXTURE);page.evaluate("()=>{const w=game.world,c=w.players[0].cells[0];c.mass=120;for(let i=0;i<8;i++){const f=w.addPellet(c.x-20,c.y,10,0);f.born=w.time-1;}w.players[1].cells=[w.makeCell(1,c.x+24,c.y,150)];advance(1000/60)}");check(page.evaluate('game.world.mass(0)')==350,'bait recovery followed by enemy eating still works')
 for hz in [60,120,144,165,240,260]:
  page.evaluate(FIXTURE);xs=page.evaluate("hz=>{game.input.key('KeyD',true);const xs=[];for(let i=0;i<hz*3;i++){advance(1000/hz);if(i>=hz){const c=game.render.cell(game.world.players[0].cells[0]);xs.push((c.x-game.camera.x)*game.camera.z);}}game.input.clear();return xs}",hz)
  ds=[b-a for a,b in zip(xs,xs[1:])];std=statistics.pstdev(ds);check(std<.04,'smooth simulated '+str(hz)+'Hz');motion.append({'hz':hz,'screen_delta_std_px':std})
 # New round, then exact state replay without importing any scripts.
 page.evaluate('game.freeze=false');page.evaluate('game.startMatch("solo",1234)');page.wait_for_function('!game.paused&&game.agents.ready');page.keyboard.down('d');page.evaluate('for(let i=0;i<100;i++)advance(1000/60)');page.keyboard.up('d');rep=page.evaluate('game.exportReplay()');expected=page.evaluate('game.world.snapshot()');page.evaluate('r=>game.importReplay(r)',rep);page.evaluate('n=>{for(let i=0;i<n;i++)advance(1000/60)}',len(rep['frames']));check(page.evaluate('game.world.snapshot()')==expected,'manual v0.5 replay exact state')
 check(not errors,'no browser errors');b.close()
(R/'tests/browser-visual-v05-report.json').write_text(json.dumps({'checks':checks,'motion':motion},ensure_ascii=False,indent=2));print('PASS',len(checks),'visual/input/replay checks')
