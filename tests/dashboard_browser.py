import asyncio,json,pathlib
from playwright.async_api import async_playwright
path=pathlib.Path('/mnt/data/AI_Ball_Arena_Six_Contestants.html')
async def run():
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  p=await browser.new_page(viewport={'width':1920,'height':1080},device_scale_factor=1)
  errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
  await p.goto('about:blank');await p.set_content(path.read_text(),wait_until='load')
  panel=await p.locator('#broadcastPanel').bounding_box();stage=await p.locator('#arenaWrap').bounding_box()
  assert panel and stage and abs(panel['x']-stage['width'])<2 and panel['width']>320
  assert await p.locator('.broadcast-entry').count()==6
  r=await p.evaluate('async()=>await window.loadBundledContestants()')
  assert r=={'ok':6,'bad':0},r
  await p.evaluate('async()=>await game.startMatch("solo",20261108)')
  await asyncio.sleep(5)
  snapshot=await p.evaluate('''()=>({tick:game.world.tick,errors:game.agentErrors,agents:game.agents.runners.size,alive:document.getElementById('broadcastAlive').textContent,scoreboard:document.querySelectorAll('.broadcast-entry:not([hidden])').length,mode:document.getElementById('broadcastMode').textContent})''')
  assert snapshot['tick']>100,snapshot
  assert snapshot['agents']==6,snapshot
  assert snapshot['scoreboard']==6,snapshot
  assert not snapshot['errors'],snapshot
  await p.screenshot(path='/mnt/data/arena_audit/dashboard_preview.png',full_page=True)
  print(json.dumps({'panel':panel,'stage':stage,'loaded':r,'snapshot':snapshot,'pageErrors':errors},ensure_ascii=False))
  await browser.close()
asyncio.run(run())
