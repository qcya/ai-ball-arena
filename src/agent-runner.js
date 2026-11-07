/* Imported strategies never run on the page thread. Frame code is trusted; user code only runs in a terminable worker. */
(function(root){'use strict';
const API=root.ArenaAgentAPI;
function workerMain(API){
 const send=self.postMessage.bind(self),now=performance.now.bind(performance);
 let bot=null,memory={},sdk=null,meta=null;
 const deny=()=>{throw Error('参赛脚本禁止联网、导入模块或创建子线程');};
 for(const k of ['fetch','XMLHttpRequest','WebSocket','EventSource','Worker','SharedWorker','importScripts','indexedDB','caches','BroadcastChannel']){try{Object.defineProperty(self,k,{value:deny,writable:false,configurable:false});}catch{}}
 self.onmessage=e=>{const m=e.data;
  try{
   if(m.type==='load'){
    sdk=API.createSDK(m.seed);Math.random=sdk.random;
    const module={exports:{}};
    new Function('module','exports','sdk','"use strict";\n'+m.source+'\n//# sourceURL=imported-strategy.js')(module,module.exports,sdk);
    bot=module.exports;meta=API.validateModule(bot);memory={};send({id:m.id,ok:true,meta});
   }else if(m.type==='act'){
    if(!bot)throw Error('脚本未加载');const start=now();
    const result=API.validateResult(bot.act(m.observation,memory));memory=result.memory;
    send({id:m.id,ok:true,action:result.action,elapsed:now()-start});
   }
  }catch(err){send({id:m.id,ok:false,error:String(err&&err.stack||err).slice(0,3000)});}
 };
}
function frameMain(){
 let port,worker,timer=null,waiting=null,dead=false;
 addEventListener('message',function connect(e){
  if(e.source!==parent||!e.ports[0]||port)return;port=e.ports[0];
  function reply(m){port.postMessage(m);}
  function stop(reason){if(worker)worker.terminate();clearTimeout(timer);dead=true;reply({id:waiting,ok:false,error:reason});}
  port.onmessage=event=>{
   const m=event.data;if(m.type==='dispose'){if(worker)worker.terminate();clearTimeout(timer);port.close();return;}
   if(dead){reply({id:m.id,ok:false,error:'该脚本已停止，请检查错误报告'});return;}
   if(m.type==='load'){
    const blob=new Blob([m.workerSource],{type:'application/javascript'}),url=URL.createObjectURL(blob);
    worker=new Worker(url);URL.revokeObjectURL(url);
    worker.onmessage=x=>{if(!x.data||x.data.id!==waiting)return;clearTimeout(timer);waiting=null;reply(x.data);};
    worker.onerror=x=>{x.preventDefault();stop(x.message||'Worker 执行失败');};
   }
   waiting=m.id;timer=setTimeout(()=>stop(m.type==='load'?'加载超过 2 秒，已终止脚本':'单次决策超过 100ms，已终止脚本'),m.budget);
   worker.postMessage(m);
  };port.start();reply({ready:true});
 });
}
class Runner{
 constructor(){this.frame=null;this.port=null;this.pending=new Map();this.serial=1;this.closed=false;this.meta=null;}
 async load(source,seed=1){
  if(typeof source!=='string'||new TextEncoder().encode(source).length>API.LIMITS.sourceBytes)throw Error('单份脚本须为 UTF-8 JavaScript，大小不超过 256 KiB');
  const frame=document.createElement('iframe');this.frame=frame;frame.hidden=true;frame.setAttribute('sandbox','allow-scripts');frame.setAttribute('aria-hidden','true');
  frame.srcdoc=`<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob:; connect-src 'none'; img-src 'none'; style-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><script>(${frameMain.toString()})();<\/script>`;
  try{
   await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('浏览器未能启动隔离运行器')),4000);
    frame.onload=()=>{const channel=new MessageChannel();this.port=channel.port1;
     this.port.onmessage=e=>{const m=e.data;if(m.ready){clearTimeout(timer);resolve();return;}const p=this.pending.get(m.id);if(!p)return;this.pending.delete(m.id);clearTimeout(p.timer);m.ok?p.resolve(m):p.reject(Error(m.error||'脚本执行失败'));};this.port.start();frame.contentWindow.postMessage({type:'connect'},'*',[channel.port2]);};
    document.body.appendChild(frame);
   });
   const workerSource=`const API=(${API.factorySource})();(${workerMain.toString()})(API);`;
   const result=await this.request({type:'load',source,seed,workerSource},API.LIMITS.loadMs);this.meta=result.meta;return result.meta;
  }catch(e){this.dispose();throw e;}
 }
 request(message,budget){
  if(this.closed||!this.port)return Promise.reject(Error('运行器已关闭'));
  const id=this.serial++;
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('隔离运行器未响应，已停止'));this.dispose();},budget+1200);this.pending.set(id,{resolve,reject,timer});this.port.postMessage({...message,id,budget});});
 }
 async act(observation){const r=await this.request({type:'act',observation},API.LIMITS.actionMs);return API.validateAction(r.action);}
 dispose(){if(this.closed)return;this.closed=true;if(this.port){this.port.postMessage({type:'dispose'});this.port.close();}if(this.frame)this.frame.remove();for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('运行器已重置'));}this.pending.clear();}
}
class Pool{
 constructor(onError=()=>{}){this.onError=onError;this.runners=new Map();this.actions={};this.pending=null;this.generation=0;this.ready=false;this.errors=[];}
 async start(entries,world){
  this.stop();const gen=this.generation;
  await Promise.all(entries.map(async entry=>{
   const r=new Runner();this.runners.set(entry.id,r);
   try{await r.load(entry.source,(world.seed^Math.imul(entry.id+1,2654435761))>>>0);if(gen!==this.generation){r.dispose();return;}if(r.meta.mode!==world.mode)throw Error('脚本 mode 与比赛不一致');}
   catch(err){if(gen===this.generation){r.dispose();this.runners.delete(entry.id);this.fail(entry.id,err,world.tick);}}
  }));
  if(gen===this.generation)this.ready=true;
 }
 fail(id,error,tick){const item={player:id,tick,message:String(error.message||error)};this.errors.push(item);this.onError(item);this.actions[id]={};}
 poll(world){
  if(!this.ready)return null;
  if(!this.runners.size&&!this.pending)return this.actions;
  if(this.pending&&world.tick>=this.pending.target){
   if(!this.pending.done)return null;
   this.actions=this.pending.actions;this.pending=null;
  }
  if(!this.pending){
   const batch={target:world.tick+API.LIMITS.decisionTicks,done:false,actions:{}},gen=this.generation;this.pending=batch;
   const tasks=[...this.runners].map(async([id,r])=>{
    if(!world.players[id].cells.length){batch.actions[id]={};return;}
    try{batch.actions[id]=await r.act(API.observation(world,id));}
    catch(e){if(gen!==this.generation)return;r.dispose();this.runners.delete(id);batch.actions[id]={};this.fail(id,e,world.tick);}
   });
   Promise.all(tasks).then(()=>{if(gen===this.generation)batch.done=true;});
  }
  return this.actions;
 }
 stop(){this.generation++;for(const r of this.runners.values())r.dispose();this.runners.clear();this.actions={};this.pending=null;this.ready=false;this.errors=[];}
}
root.ArenaAgents={Runner,Pool};
})(typeof globalThis!=='undefined'?globalThis:this);
