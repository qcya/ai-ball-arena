import asyncio, pathlib, json
from playwright.async_api import async_playwright
html=pathlib.Path('/mnt/data/arena_audit/release/index.html').read_text()
slow="'use strict';module.exports={apiVersion:'1.0',mode:'solo',name:'slow-safe',act(){const t=performance.now();while(performance.now()-t<150){}return {action:{dx:1,dy:0,throttle:1},memory:{}};}}"
forever="'use strict';module.exports={apiVersion:'1.0',mode:'solo',name:'infinite',act(){while(true){};}}"
async def trial(browser,source,seconds):
 p=await browser.new_page(viewport={'width':1300,'height':800})
 await p.goto('about:blank');await p.set_content(html,wait_until='load')
 await p.evaluate('s=>{game.lobby.slots[0].files.solo={id:0,mode:"solo",name:"synthetic",source:s,status:"ready",checksum:"test",filename:"solo.js"};game.lobby.render()}',source)
 await p.evaluate('async()=>await game.startMatch("solo",12)')
 await asyncio.sleep(seconds)
 state=await p.evaluate('''()=>({runners:game.agents.runners.size,errors:game.agentErrors,slowDecisions:game.agents.slowDecisions,lag:game.agents.latencyMs,rate:game.simulationRate,tick:game.world.tick})''')
 await p.close();return state
async def main():
 async with async_playwright() as pw:
  b=await pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  s=await trial(b,slow,4)
  assert s['runners']==1,s
  assert not s['errors'],s
  assert s['slowDecisions']>0,s
  assert 0<s['rate']<1,s
  x=await trial(b,forever,3)
  assert x['runners']==0,x
  assert x['errors'] and ('1000' in x['errors'][0]['message'] or '100ms' in x['errors'][0]['message']),x
  print(json.dumps({'slowButValid':s,'infiniteLoopStopped':x},ensure_ascii=False))
  await b.close()
asyncio.run(main())
