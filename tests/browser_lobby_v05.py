"""Acceptance of the actual offline file. Each import executes only inside the isolated runner."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1]
checks=[]
def check(v,n):
 assert v,n
 checks.append(n)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=__import__('os').environ.get('CHROMIUM_PATH') or __import__('shutil').which('chromium'),headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((ROOT/'index.html').read_text(),wait_until='load');page.wait_for_timeout(250)
 check(page.locator('#agentRows').count()==1,'registration lobby exists')
 check(page.evaluate('game.world.players.every(p=>p.cells.length===0)'),'zero players before imports')
 script=lambda mode,d:f"module.exports={{apiVersion:'1.0',name:'accept-{mode}',mode:'{mode}',act(o,m){{return {{action:{{dx:{d},dy:0}},memory:{{n:(m.n||0)+1}}}}}}}};"
 for id,d in [(0,1),(1,-1)]:
  for mode in ['solo','team','storm']:
   result=page.evaluate('''async([id,mode,source])=>{await game.lobby.importFiles(id,[{name:mode+'.js',size:source.length,text:async()=>source}]);return game.lobby.slots[id].files[mode].status;}''',[id,mode,script(mode,d)])
   check(result=='ready',f'{id} {mode} registered')
 page.screenshot(path=str(ROOT/'tests/v05-lobby.png'))
 page.locator('#startGame').click();page.wait_for_function('game.started && !game.paused && game.world.tick>20')
 check(page.evaluate('game.world.activeIds.join()')=='0,1','only two imported competitors spawn')
 check(page.evaluate('game.world.players.slice(2).every(p=>!p.cells.length)'),'missing slots do not secretly spawn')
 check(page.evaluate('game.record.some(f=>f.actions[0]?.dx===1&&f.actions[1]?.dx===-1)'),'both scripts drive match')
 check(page.evaluate('!game.humanEnabled'),'default is spectator, not disguised human')
 page.locator('.modes [data-mode="team"]').click();page.wait_for_function('game.mode==="team"&&game.world.tick>10')
 check(page.evaluate('game.world.players[0].team!==game.world.players[1].team'),'two competitors balance to 1v1')
 page.locator('.modes [data-mode="storm"]').click();page.wait_for_function('game.mode==="storm"&&game.world.tick>10')
 check(page.evaluate('game.agents.runners.get(0).meta.mode')=='storm','mode switches to corresponding independent module')
 page.screenshot(path=str(ROOT/'tests/v05-match.png'))
 # Replay data must reconstruct only registered entrants, with no active workers needed.
 page.evaluate('window.savedReplay=game.exportReplay();game.importReplay(savedReplay)')
 page.wait_for_function('game.paused')
 check(page.evaluate('game.world.activeIds.join()')=='0,1','replay preserves actual roster')
 check(page.evaluate('game.agents.runners.size===0'),'replay does not execute imported scripts')
 # Return to manual practice explicitly; never inject scripted bots.
 page.locator('#entriesToggle').click();page.locator('#humanEnabled').check();page.locator('#humanSeat').select_option('2');page.locator('#startGame').click();page.wait_for_function('game.started&&!game.paused&&game.world.tick>10')
 check(page.evaluate('game.world.activeIds.join()')=='0,1,2','optional human adds exactly one selected slot')
 before=page.evaluate('game.world.players[2].cells[0].x');page.keyboard.down('d');page.wait_for_timeout(180);page.keyboard.up('d');check(page.evaluate('game.world.players[2].cells[0].x')>before,'manual WASD remains available')
 check(not errors,'no page JavaScript errors: '+str(errors))
 (ROOT/'tests/browser-v05-report.json').write_text(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False,indent=2))
 print(json.dumps({'checks':len(checks),'passed':True},ensure_ascii=False));b.close()
