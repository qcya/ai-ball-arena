from pathlib import Path
from playwright.sync_api import sync_playwright
import json
R=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=__import__('os').environ.get('CHROMIUM_PATH') or __import__('shutil').which('chromium'),headless=True,args=['--no-sandbox']);page=b.new_page();page.set_content('<body></body>')
 for name in ['engine','agent-api','agent-runner']:page.add_script_tag(content=(R/f'src/{name}.js').read_text())
 result=page.evaluate('''async()=>{const checks=[];const src=`module.exports={apiVersion:'1.0',name:'test',mode:'solo',act(o,m){return {action:{dx:1},memory:{n:(m.n||0)+1}}}}`;const r=new ArenaAgents.Runner();await r.load(src);const w=new Arena.World({activeIds:[0,1],foodCount:0,thornCount:0});checks.push(['load',r.meta.mode==='solo']);checks.push(['act',(await r.act(ArenaAgentAPI.observation(w,0))).dx===1]);r.dispose();
const loop=new ArenaAgents.Runner();await loop.load(`module.exports={apiVersion:'1.0',name:'loop',mode:'solo',act(){while(true){}}}`);try{await loop.act(ArenaAgentAPI.observation(w,0));checks.push(['timeout',false]);}catch(e){checks.push(['timeout',e.message.includes('100ms')]);}loop.dispose();
const net=new ArenaAgents.Runner();await net.load(`module.exports={apiVersion:'1.0',name:'net',mode:'solo',act(){fetch('https://example.com');return {action:{}}}}`);try{await net.act(ArenaAgentAPI.observation(w,0));checks.push(['network denied',false]);}catch(e){checks.push(['network denied',e.message.includes('禁止联网')]);}net.dispose();return checks;}''')
 print(json.dumps(result,ensure_ascii=False));assert all(ok for name,ok in result);b.close()
