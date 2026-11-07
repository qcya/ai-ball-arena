from pathlib import Path
import json
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=__import__('os').environ.get('CHROMIUM_PATH') or __import__('shutil').which('chromium'),headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1280,'height':900});page.set_content((R/'index.html').read_text(),wait_until='load')
 checks=page.evaluate('''async()=>{
  const out=[],add=(name,ok)=>{if(!ok)throw Error(name);out.push(name);};
  const make=(name,mode,body)=>`module.exports={apiVersion:'1.0',name:'${name}',mode:'${mode}',act(o,m){${body}}}`;
  const file=(mode,source)=>({name:mode+'.js',size:source.length,text:async()=>source});
  const good=make('good','solo','return {action:{dx:1},memory:{}}'),bad=make('bad','solo','return {action:{wrong:true}}');
  await game.lobby.importFiles(0,[file('solo',bad)]);add('invalid action fails smoke validation',game.lobby.slots[0].files.solo.status==='error');
  await game.lobby.importFiles(0,[file('solo',good)]);add('one code correction accepted',game.lobby.slots[0].files.solo.status==='ready'&&game.lobby.slots[0].retryUsed);
  game.lobby.runtimeError('solo',{player:0,tick:9,message:'second error'});await game.lobby.importFiles(0,[file('solo',good)]);add('second correction is blocked',game.lobby.slots[0].files.solo.status==='error');
  await game.lobby.importFiles(1,[file('solo',good)]);
  const changed=make('improved','solo','return {action:{dy:1},memory:{}}');await game.lobby.importFiles(1,[file('solo',changed)]);add('cannot optimize a valid first submission',game.lobby.slots[1].files.solo.source===good);
  const runaway=make('runaway','team','while(true){}');await game.lobby.importFiles(2,[file('team',runaway)]);add('infinite act rejected without freezing page',game.lobby.slots[2].files.team.status==='error');
  const wrong=make('malformed','storm','return {action:{aimAtX:5}}');await game.lobby.importFiles(3,[file('storm',wrong)]);add('unpaired aim coordinates rejected',game.lobby.slots[3].files.storm.status==='error');
  const asyncCode=`module.exports={apiVersion:'1.0',name:'async',mode:'solo',async act(){return {action:{}}}}`;await game.lobby.importFiles(4,[file('solo',asyncCode)]);add('async API disallowed',game.lobby.slots[4].files.solo.status==='error');
  const hostile=make('<img onerror=alert(1)>','solo','return {action:{},memory:{}}');await game.lobby.importFiles(5,[file('solo',hostile)]);add('untrusted metadata never becomes HTML',document.querySelectorAll('[onerror]').length===0);
  game.lobby.reset();await game.lobby.importFiles(0,[file('solo',good)]);await game.startMatch('solo');add('one imported solo can practice',game.world.activeIds.join()==='0');
  await game.startMatch('team');add('missing mode opens empty lobby, not previous mode gameplay',game.mode==='team'&&game.world.activeIds.length===0&&!game.started);
  return out;
 }''')
 # Actual File chooser path, not only programmatic helper.
 good="module.exports={apiVersion:'1.0',name:'upload',mode:'team',act(){return {action:{dx:1},memory:{}}}}"
 page.locator('input[data-import-for="1"]').set_input_files({'name':'team.js','mimeType':'text/javascript','buffer':good.encode()})
 page.wait_for_function('game.lobby.slots[1].files.team?.status==="ready"');checks.append('actual multi-file import control reads uploaded JS')
 page.set_viewport_size({'width':420,'height':900});page.screenshot(path=str(R/'tests/v05-mobile.png'))
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), 'mobile horizontal overflow'
 checks.append('mobile registration no horizontal overflow')
 (R/'tests/browser-errors-v05-report.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2));print('PASS',len(checks),'error/registration checks');b.close()
