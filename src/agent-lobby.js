/* Import registration and first-submission ledger. Never evaluates a file on the page. */
(function(root){'use strict';
const API=root.ArenaAgentAPI,MODES=API.MODES,NAMES={solo:'个人赛',team:'团队赛',storm:'缩圈赛'};
class Lobby{
 constructor({assets,onChange,onNotice}){this.assets=assets;this.onChange=onChange;this.onNotice=onNotice;this.busy=false;this.slots=Arena.BRANDS.map((b,id)=>({id,brand:b,files:{},retryUsed:false,lastError:'',history:[]}));this.mount();}
 mount(){
  const rows=document.getElementById('agentRows');rows.textContent='';
  for(const slot of this.slots){
   const card=document.createElement('section');card.className='agent-card';card.dataset.seat=slot.id;
   card.innerHTML=`<div class="agent-card-head"><img alt="${slot.brand.name}" src="${this.assets[slot.brand.icon]}"><strong>${slot.brand.name}</strong><span class="agent-retry">首份提交</span></div><div class="agent-modes"></div><button class="agent-import">导入 .js 文件</button><div class="agent-error"></div>`;
   for(const mode of MODES){const row=document.createElement('div');row.className='agent-mode';row.dataset.mode=mode;row.innerHTML=`<span>${NAMES[mode]}</span><b>未导入</b>`;card.querySelector('.agent-modes').appendChild(row);}
   const input=document.createElement('input');input.type='file';input.accept='.js,text/javascript,application/javascript';input.multiple=true;input.hidden=true;input.dataset.importFor=slot.id;
   input.onchange=async()=>{const files=[...input.files];input.value='';if(files.length)await this.importFiles(slot.id,files);};
   card.querySelector('button').onclick=()=>input.click();card.appendChild(input);rows.appendChild(card);
  }
  this.render();
 }
 async importFiles(id,files){
  if(this.busy)throw Error('另一组文件还在校验');const slot=this.slots[id];if(!slot)throw Error('无此席位');
  if(!files.length||files.length>3){this.onNotice('每次选择 1–3 份 .js 文件');return;}
  const repairing=!!slot.lastError||Object.values(slot.files).some(f=>f.status==='error');
  if(repairing&&slot.retryUsed){this.onNotice('该选手的一次代码修复机会已用完；不能继续重交');return;}
  if(repairing)slot.retryUsed=true;
  this.busy=true;slot.lastError='';this.render();const seen=new Set();
  try{
   for(const file of files){
    let runner,mode=(file.name.match(/(?:^|[_.-])(solo|team|storm)(?:[_.-]|$)/i)||[])[1]?.toLowerCase();
    try{
     if(!file.name.toLowerCase().endsWith('.js'))throw Error('请提供 .js 文件，不要导入 ZIP 或 Markdown');
     if(file.size>API.LIMITS.sourceBytes)throw Error('单文件超过 256 KiB');
     const source=await file.text();runner=new ArenaAgents.Runner();const meta=await runner.load(source,12345);mode=meta.mode;
     if(seen.has(mode))throw Error('同一批次出现重复的 '+mode+' 脚本');seen.add(mode);
     const old=slot.files[mode];if(old&&old.status==='ready'&&old.source!==source)throw Error('首份可运行 '+mode+' 已锁定，不按胜负重交优化版');
     const world=new Arena.World({mode,seed:12345,activeIds:[id,(id+1)%6],foodCount:30,thornCount:2});
     await runner.act(API.observation(world,id));world.step(1/60);await runner.act(API.observation(world,id));
     let checksum='';if(root.crypto?.subtle){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source));checksum='sha256:'+Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}else{let h=2166136261;for(const c of source)h=Math.imul(h^c.charCodeAt(0),16777619);checksum='fnv1a:'+(h>>>0).toString(16);}
     slot.files[mode]={id,mode,source,name:meta.name,filename:file.name,status:'ready',error:'',checksum,attempt:repairing?2:1};
     slot.history.push({kind:'accepted',mode,filename:file.name,checksum,attempt:repairing?2:1});
    }catch(err){const message=String(err.message||err).slice(0,3000);slot.lastError=message;
     if(mode&&MODES.includes(mode)&&slot.files[mode]?.status!=='ready')slot.files[mode]={id,mode,status:'error',error:message,filename:file.name};
     slot.history.push({kind:'error',mode:mode||null,filename:file.name,message,attempt:repairing?2:1});
    }finally{runner?.dispose();}
   }
  }finally{this.busy=false;this.render();this.onChange();}
  this.onNotice(slot.lastError?'导入有错误，可导出错误报告交给原模型修一次':'脚本校验通过，已登记到对应模式');
 }
 entries(mode,humanEnabled=false,humanId=0){return this.slots.flatMap(s=>{const f=s.files[mode];return f?.status==='ready'&&!(humanEnabled&&s.id===humanId)?[{...f,id:s.id}]:[];});}
 runtimeError(mode,error){const slot=this.slots[error.player],f=slot.files[mode];if(!f)return;f.status='error';f.error=error.message;slot.lastError=error.message;slot.history.push({kind:'runtime-error',mode,...error});this.render();}
 audit(){return{format:'ball-arena-submissions',engine:API.ENGINE,apiVersion:API.VERSION,policy:'一会话三份；首份可运行即参赛；每位最多一次仅修代码的重试',slots:this.slots.map(s=>({id:s.id,brand:s.brand.name,retryUsed:s.retryUsed,files:Object.values(s.files).map(({source,...rest})=>rest),history:s.history}))};}
 reset(){if(this.busy)return;this.slots.forEach(s=>{s.files={};s.retryUsed=false;s.lastError='';s.history=[];});this.render();this.onChange();}
 render(){
  for(const s of this.slots){const card=document.querySelector(`[data-seat="${s.id}"]`);if(!card)continue;
   for(const mode of MODES){const f=s.files[mode],row=card.querySelector(`[data-mode="${mode}"]`);row.classList.toggle('ready',f?.status==='ready');row.classList.toggle('error',f?.status==='error');row.querySelector('b').textContent=f?.status==='ready'?'✓ 已就绪':f?.status==='error'?'代码错误':'未导入';row.title=f?.filename||'';}
   card.querySelector('.agent-retry').textContent=s.retryUsed?'修复机会已使用':s.lastError?'可修代码 1 次':'首份提交';
   card.querySelector('.agent-error').textContent=s.lastError?s.lastError.split('\n')[0]:Object.values(s.files).filter(f=>f.status==='ready').length+' / 3 份脚本就绪';
   const button=card.querySelector('.agent-import');button.disabled=this.busy;button.textContent=this.busy?'正在校验…':s.lastError?'导入修复版':'导入 .js 文件';
  }
  const start=document.getElementById('startGame');if(start)start.disabled=this.busy;
 }
}
root.ArenaAgentLobby={Lobby};
})(typeof globalThis!=='undefined'?globalThis:this);
