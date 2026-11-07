"""Local Chromium integration checks; no contestant source is rewritten."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os, shutil
R=Path(__file__).resolve().parents[1]
CLOCK="window.__clock=0;window.requestAnimationFrame=f=>{window.__frame=f;return 1;};Object.defineProperty(performance,'now',{value:()=>window.__clock});window.advance=ms=>{window.__clock+=ms;window.__frame(window.__clock)};"
checks=[]
def check(ok,name):
    assert ok,name
    checks.append(name)
SETUP="""mode=>{game.agents.stop();game.freeze=true;game.paused=false;game.started=true;game.humanEnabled=true;game.human=0;game.world=new Arena.World({mode,activeIds:[0,1,2,3],foodCount:0,thornCount:0,seed:42});game.mode=mode;game.render.reset(game.world);game.eventsSeen.clear();game.record=[];document.querySelector('#resultOverlay').classList.add('hidden');document.querySelector('#welcome').classList.add('hidden');advance(120);}"""
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1440,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.evaluate('(()=>{'+CLOCK+'})();');page.set_content((R/'index.html').read_text(),wait_until='load');page.wait_for_function('window.game&&game.world')
    page.locator('#humanEnabled').check();page.locator('#startGame').click();page.wait_for_function('game.started&&!game.paused')
    page.evaluate(SETUP,'solo');page.evaluate("()=>{game.world.players[3].cells[0].mass=9000;advance(120);advance(120)}")
    check(page.locator('#rankKind').inner_text()=='按存活顺序','HUD says survival, not mass')
    check(page.evaluate('[...document.querySelector("#rankList").children].map(r=>+r.dataset.player)')==[0,1,2,3],'HUD is stable among survivors, even if mass differs')
    check(page.evaluate('[...document.querySelectorAll("#rankList .rank-num")].every(r=>r.textContent==="●")'),'living players have no false live rank')
    page.evaluate("()=>{const w=game.world;w.time=10;w.players[0].cells=[];w.markDeath(w.players[0]);advance(120);advance(120)}")
    check('你已出局' in page.locator('#centerMessage').inner_text(),'solo elimination banner')
    check('秒后' not in page.locator('#centerMessage').inner_text(),'no solo respawn countdown')
    check(page.evaluate('[...document.querySelector("#rankList").children].map(r=>+r.dataset.player)')==[1,2,3,0],'eliminated player falls below survivors')
    page.evaluate("()=>{game.world.time=179.99;advance(120);advance(120)}")
    check(page.locator('#resultTitle').inner_text()=='时间到 · 未分胜负','timeout not awarded to mass leader')
    check('总质量不决定' in page.locator('#resultSub').inner_text(),'result explains no mass tiebreak')
    page.screenshot(path=str(R/'tests/v06-timeout.png'))
    # A new real start resets the result overlay guard before each independent finish.
    page.evaluate('game.startMatch("solo",42)');page.wait_for_function('!game.paused&&game.agents.ready')
    page.evaluate(SETUP,'solo')
    page.evaluate("()=>{const w=game.world;w.time=20;for(const id of [0,2,3]){w.players[id].cells=[];w.markDeath(w.players[id]);}w.players[1].cells[0].mass=30;advance(120);advance(120)}")
    check(page.locator('#resultTitle').inner_text()=='DeepSeek 获胜','small last survivor still wins immediately')
    check(page.locator('#resultRanks .rank-name').first.inner_text().startswith('DeepSeek'),'result first row is survivor')
    check(page.evaluate('game.world.time')<21,'no waiting until mass deadline')
    page.screenshot(path=str(R/'tests/v06-survivor.png'))
    page.evaluate('game.startMatch("team",42)');page.wait_for_function('!game.paused&&game.agents.ready')
    page.evaluate(SETUP,'team')
    page.evaluate("()=>{const w=game.world;w.players.forEach((p,id)=>p.team=id<2?0:1);[600,600,1000,100].forEach((m,id)=>w.players[id].cells[0].mass=m);w.time=179.99;advance(120);advance(120)}")
    check(page.locator('#resultTitle').inner_text()=='蓝队获胜','team sum beats largest individual')
    check(page.locator('#rankKind').inner_text()=='按队伍总质量','team HUD objective')
    check('全队总质量' in page.locator('#resultSub').inner_text(),'team result uses aggregate wording')
    page.screenshot(path=str(R/'tests/v06-team.png'))
    # Check old API examples still import and stay unchanged through mode switches.
    page.close();page=b.new_page(viewport={'width':1440,'height':900});page.on('pageerror',lambda e:errors.append(str(e)));page.evaluate('(()=>{'+CLOCK+'})();');page.set_content((R/'index.html').read_text(),wait_until='load');page.wait_for_function('window.game&&game.world')
    sources={m:(R/'examples'/f'{m}.js').read_text() for m in ['solo','team','storm']}
    page.evaluate("async s=>{for(const id of [0,3])await game.lobby.importFiles(id,Object.entries(s).map(([m,txt])=>new File([txt],m+'.js',{type:'application/javascript'})));}",sources)
    before=page.evaluate('game.lobby.audit()');check(all(len(s['files'])==3 for s in before['slots'] if s['id'] in [0,3]),'existing API 1.0 three-script entries accepted')
    for mode in ['solo','team','storm']:
        page.evaluate('m=>game.startMatch(m,42)',mode);page.wait_for_function('!game.paused&&game.agents.ready');page.wait_for_timeout(40)
        page.evaluate('advance(50)');page.wait_for_timeout(40);page.evaluate('advance(50)')
        check(page.evaluate('game.agentErrors.length')==0,'API 1.0 starts '+mode)
    after=page.evaluate('game.lobby.audit()');check(before==after,'all original code hashes and retry ledger preserved across modes')
    check(page.evaluate('ArenaAgentAPI.ENGINE')=='0.6.0','updated engine version')
    check(not errors,'no browser exceptions')
    b.close()
(R/'tests/browser-results-v06-report.json').write_text(json.dumps({'checks':checks},ensure_ascii=False,indent=2));print('PASS',len(checks),'browser result and API checks')
