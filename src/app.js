(function(){'use strict';
const $=id=>document.getElementById(id),{CFG,BRANDS,radius,clamp,norm}=Arena;
const canvas=$('arena'),ctx=canvas.getContext('2d'),mini=$('mini'),mc=mini.getContext('2d');
const colors=['#e6b35b','#e98083','#7ca9e3','#a38ad2','#79bea7','#dc9bc4','#96b97a'];
const controller=new ArenaInput.Controller(),sfx=new ArenaSound.SoundBank(),timeline=new ArenaRender.Timeline();
const state={world:null,human:0,humanEnabled:false,starting:false,started:false,paused:true,freeze:false,showGuides:true,clean:false,speed:1,mode:'solo',seed:20261107,view:'follow',zoom:1,camera:{x:1300,y:900,z:.6},pointer:{x:0,y:0,active:false},keys:controller.keys,input:controller,sfx,splitQueued:false,mouseEject:false,sound:true,audio:null,images:[],eventsSeen:new Set(),fx:[],record:[],pendingCommands:[],replay:null,replayIndex:0,testTools:0,frameCount:0};
window.game=state;state.render=timeline;state.performance={fps:0,frameMs:0};
const pool=new ArenaAgents.Pool(error=>{state.agentErrors.push(error);lobby.runtimeError(state.mode,error);toast(`${BRANDS[error.player].name} 脚本停止：${error.message.split('\n')[0]}`);});
state.agents=pool;state.agentErrors=[];
const lobby=new ArenaAgentLobby.Lobby({assets:ASSETS,onNotice:toast,onChange:()=>{if(!state.started)newGame(state.mode,state.seed,false);updateEntrySummary();}});state.lobby=lobby;
let perfTime=0,perfFrames=0;
const imgs=BRANDS.map(b=>{const i=new Image();i.src=ASSETS[b.icon];return i;});state.images=imgs;
let W=innerWidth,H=innerHeight-78,DPR=1,last=performance.now(),accumulator=0,uiClock=0,toastTimer,helpPaused=false,resultShown=false,recordOptions;
function logoHTML(id,cls=''){return `<img class="${cls}" src="${ASSETS[BRANDS[id].icon]}" alt="${BRANDS[id].name}">`;}
function initPicker(){
 const select=$('humanSeat');select.innerHTML=BRANDS.map((b,i)=>`<option value="${i}">${b.name}</option>`).join('');select.value=String(state.human);
}
function updateEntrySummary(){const mode=state.mode,human=$('humanEnabled').checked,id=+$('humanSeat').value,entries=lobby.entries(mode,human,id);$('entrySummary').textContent=`${{solo:'个人赛',team:'团队赛',storm:'缩圈赛'}[mode]}：${entries.length} 位已导入 AI${human?' + 你':''}。未导入的席位不生成球。${mode==='team'?'两位时 1V1，四位 2V2，六位 3V3。':''}`;}
function openEntries(){state.paused=true;clearControls();sfx.stopAll();$('welcome').classList.remove('hidden');lobby.render();updateEntrySummary();updateHUD();}
async function startMatch(mode=state.mode,seed=state.seed){
 if(lobby.busy||state.starting)return;state.starting=true;
 state.humanEnabled=$('humanEnabled').checked;state.human=+$('humanSeat').value;
 const entries=lobby.entries(mode,state.humanEnabled,state.human),activeIds=entries.map(e=>e.id);if(state.humanEnabled)activeIds.push(state.human);
 if(!activeIds.length){state.starting=false;newGame(mode,seed,false);toast('请先导入本模式脚本，或勾选“我也入场”手动测试');openEntries();return;}
 if(mode==='team'&&activeIds.length>1&&activeIds.length%2){state.starting=false;toast('团队赛需要偶数位选手：2 / 4 / 6；手动测试可单人入场');openEntries();return;}
 state.agentErrors=[];newGame(mode,seed,true,{activeIds});state.paused=true;
 $('welcome').classList.add('hidden');$('startGame').disabled=true;await unlockAudio();
 await pool.start(entries,state.world);state.starting=false;$('startGame').disabled=false;
 state.paused=false;state.view=state.humanEnabled?'follow':'all';last=performance.now();accumulator=0;updateHUD();
 toast(`${activeIds.length} 位选手已入场；${entries.length} 份 ${mode}.js 已加载`);
}
state.startMatch=startMatch;
function toast(text){$('toast').textContent=text;$('toast').classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.add('hidden'),2600);}
function syncAudioUI(){state.sound=sfx.enabled;state.audio=sfx.context;$('soundToggle').style.color=sfx.enabled?'#21835f':'#aab5af';$('soundToggle').textContent=sfx.enabled?'♪':'♩';$('soundToggle').title=sfx.enabled?'音效开启 · 点击静音':'音效关闭 · 点击开启';$('soundToggle').setAttribute('aria-pressed',String(sfx.enabled));$('volumeValue').textContent=Math.round(sfx.volume*100)+'%';$('volumeSlider').value=Math.round(sfx.volume*100);}
function saveAudioSettings(){try{localStorage.setItem('ball-arena-audio-v02',JSON.stringify({enabled:sfx.enabled,volume:sfx.volume}));}catch{}}
async function unlockAudio(){const ok=await sfx.unlock();state.audio=sfx.context;return ok;}
function clearControls(){controller.clear();state.pointer.active=false;state.splitQueued=false;state.mouseEject=false;}
function canControl(){return state.humanEnabled&&state.started&&!state.paused&&!state.world.finished&&state.world.players[state.human].cells.length>0&&!state.replay&&$('help').classList.contains('hidden')&&$('welcome').classList.contains('hidden')&&$('resultOverlay').classList.contains('hidden');}
function newGame(mode=state.mode,seed=state.seed,start=state.started,extra={}){pool.stop();state.mode=mode;state.seed=(Number(seed)||20261107)>>>0;recordOptions={mode,seed:state.seed,foodCount:1050,thornCount:18,respawn:true,duration:180,activeIds:[],...extra};state.world=new Arena.World(recordOptions);timeline.reset(state.world);state.record=[];state.pendingCommands=[];state.replay=null;state.replayIndex=0;state.eventsSeen.clear();state.fx=[];state.started=start;state.paused=!start;clearControls();state.testTools=0;state.freeze=false;$('freezeBots').checked=false;state.speed=1;$('speedSelect').value='1';resultShown=false;accumulator=0;$('seedInput').value=state.seed;$('resultOverlay').classList.add('hidden');$('centerMessage').classList.add('hidden');$('pausedBadge').classList.add('hidden');$('welcome').classList.toggle('hidden',start);document.querySelectorAll('.modes [data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));const c=state.world.center(state.human);state.camera={x:start?c.x:1300,y:start?c.y:900,z:start?.92:Math.min(W/2600,H/1800)*.9};state.view=start?'follow':'all';state.zoom=1;updateEntrySummary();updateHUD();}
function resize(){const r=canvas.getBoundingClientRect();W=Math.max(1,r.width);H=Math.max(1,r.height);DPR=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(W*DPR);canvas.height=Math.round(H*DPR);ctx.setTransform(DPR,0,0,DPR,0,0);}
function screen(x,y){return{x:(x-state.camera.x)*state.camera.z+W/2,y:(y-state.camera.y)*state.camera.z+H/2};}
function worldPoint(x,y){return{x:(x-W/2)/state.camera.z+state.camera.x,y:(y-H/2)/state.camera.z+state.camera.y};}
function updateCamera(dt){let tx,ty,tz;const w=state.world,cells=w.players[state.human].cells;if(state.view==='all'||!state.started||!cells.length){tx=1300;ty=900;tz=Math.min((W-90)/2600,(H-80)/1800)*state.zoom;}else{const c=timeline.center(w,state.human);tx=c.x;ty=c.y;let extentX=160,extentY=160;for(const raw of cells){const b=timeline.cell(raw);extentX=Math.max(extentX,Math.abs(b.x-c.x)+radius(b.mass)+60);extentY=Math.max(extentY,Math.abs(b.y-c.y)+radius(b.mass)+60);}tz=Math.min(.96*Math.pow(240/Math.max(240,w.mass(state.human)),.08),Math.max(250,W-360)/(extentX*2),Math.max(230,H-180)/(extentY*2))*state.zoom;tz=clamp(tz,.22,2.3);const hx=W/2/tz,hy=H/2/tz;tx=hx<1300?clamp(tx,hx,2600-hx):1300;ty=hy<900?clamp(ty,hy,1800-hy):900;}
 const a=1-Math.exp(-dt*7);state.camera.x+=(tx-state.camera.x)*a;state.camera.y+=(ty-state.camera.y)*a;state.camera.z+=(tz-state.camera.z)*a;
}
function humanAction(){const w=state.world,p=w.players[state.human];if(!p.cells.length)return{};const c=w.center(state.human),a=controller.sample(screen(c.x,c.y),performance.now());state.aimSource=a.aimSource;delete a.aimSource;for(const prefix of ['aimAt','gatherAt']){if(Number.isFinite(a[prefix+'X'])&&Number.isFinite(a[prefix+'Y'])){const pt=worldPoint(a[prefix+'X'],a[prefix+'Y']);a[prefix+'X']=pt.x;a[prefix+'Y']=pt.y;}}return a;}
function step(){
 if(state.replay){
  if(state.replayIndex>=state.replay.frames.length){for(const cmd of state.replay.finalCommands||[])applyTool(cmd[0],cmd[1],false);state.paused=true;toast('回放结束');return false;}
  const f=state.replay.frames[state.replayIndex++];for(const cmd of f.commands||[])applyTool(cmd[0],cmd[1],false);timeline.capture(state.world);state.world.step(1/60,f.actions||{});
 }else{
  const imported=state.freeze?{}:pool.poll(state.world);if(imported===null)return false;
  const actions={};for(const p of state.world.players){if(!p.active)continue;actions[p.id]=state.humanEnabled&&p.id===state.human?humanAction():{...(imported[p.id]||{})};}
  state.record.push({actions,commands:state.pendingCommands.splice(0)});timeline.capture(state.world);state.world.step(1/60,actions);
 }processEvents();return true;
}
function processEvents(){const w=state.world;for(const e of w.events){if(state.eventsSeen.has(e.id))continue;state.eventsSeen.add(e.id);
 if(ArenaSound.PRESETS[e.type==='teamFeed'?'eat':e.type]){let gain=state.humanEnabled?0:.25,pan=0;if(e.player===state.human)gain=1;else if(['split','burst','eat','death'].includes(e.type)){const human=w.center(state.human),where=Number.isFinite(e.x)?e:w.center(e.player),d=Math.hypot(where.x-human.x,where.y-human.y);if(d<650){gain=.20*(1-d/650);pan=clamp((where.x-human.x)/600,-1,1);}}if(gain>0)sfx.play(e.type==='teamFeed'?'eat':e.type,{gain,pan});}
 if(e.type==='burst'){state.fx.push({x:e.x,y:e.y,r:40,life:.6,max:.6,type:'burst'});if(e.player===state.human)toast(`吃刺四分：总质量 +20%（+${Math.round(e.gain)}）`);}
 if(e.type==='eat'||e.type==='teamFeed')state.fx.push({x:e.x,y:e.y,r:35,life:.4,max:.4,type:'eat'});
 if(e.type==='death'&&e.player===state.human)clearControls();
 if(e.type==='finish'&&!resultShown)showResult();
 }if(state.eventsSeen.size>2500)state.eventsSeen=new Set(w.events.map(e=>e.id));}
function circle(x,y,r,fill,stroke,line=1){ctx.beginPath();ctx.arc(x,y,Math.max(.01,r),0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}}
function star(x,y,r,n=5,inner=.47,rot=-Math.PI/2){ctx.beginPath();for(let i=0;i<n*2;i++){const a=rot+i*Math.PI/n,rr=i%2?r*inner:r;if(i===0)ctx.moveTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);else ctx.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}ctx.closePath();}
function drawFood(f,z){const s=screen(f.x,f.y);if(s.x<-10||s.y<-10||s.x>W+10||s.y>H+10)return;const r=Math.max(1.7,4.9*z);ctx.fillStyle=colors[f.color];switch(f.shape){case 0:circle(s.x,s.y,r,colors[f.color]);break;case 1:star(s.x,s.y,r*1.35);ctx.fill();break;case 2:ctx.beginPath();for(let i=0;i<3;i++){const a=f.angle+i*Math.PI*2/3;const x=s.x+Math.cos(a)*r*1.2,y=s.y+Math.sin(a)*r*1.2;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();break;case 3:ctx.save();ctx.translate(s.x,s.y);ctx.rotate(f.angle);ctx.fillRect(-r*.8,-r*.8,r*1.6,r*1.6);ctx.restore();}}
function drawCell(c,p,z){c=timeline.cell(c);const s=screen(c.x,c.y),r=radius(c.mass)*z;if(s.x<-r-40||s.y<-r-40||s.x>W+r+40||s.y>H+r+40)return;const isYou=state.humanEnabled&&p.id===state.human;ctx.save();ctx.shadowColor='#1b30241c';ctx.shadowBlur=9;ctx.shadowOffsetY=3;circle(s.x,s.y,r,'#fff',p.color+'66',Math.max(1,z*1.2));ctx.restore();circle(s.x,s.y,r*.97,p.tint);
 const teamColor=p.team===0?'#6fa9d7':'#e9aa67';if(state.mode==='team')circle(s.x,s.y,r+3,null,teamColor,2);if(isYou){circle(s.x,s.y,r+(state.mode==='team'?6:3),null,'#66b494',1.8);}
 const iconSize=r*1.23,icon=imgs[p.id];if(icon.complete&&icon.naturalWidth>0){ctx.save();ctx.beginPath();ctx.arc(s.x,s.y,r*.88,0,Math.PI*2);ctx.clip();ctx.drawImage(icon,s.x-iconSize/2,s.y-iconSize/2-r*.08,iconSize,iconSize);ctx.restore();}
 if(r>20){ctx.textAlign='center';ctx.font=`600 ${Math.max(8,Math.min(15,r*.22))}px ${getFont()}`;ctx.fillStyle=p.color;ctx.fillText(Math.round(c.mass).toLocaleString('en-US'),s.x,s.y+r*.74);}
 if(r>11){ctx.textAlign='center';ctx.font=`500 ${clamp(r*.25,9,13)}px ${getFont()}`;const label=p.name+(isYou?' · 你':'');ctx.lineWidth=3;ctx.strokeStyle='#ffffffed';ctx.strokeText(label,s.x,s.y+r+17);ctx.fillStyle=isYou?'#3e7860':'#6f7e76';ctx.fillText(label,s.x,s.y+r+17);}
 if(state.world.time<c.shieldUntil){ctx.save();ctx.setLineDash([4,4]);circle(s.x,s.y,r+8,null,'#8fcab866',1.5);ctx.restore();}
 if(isYou&&c.mergeAt>state.world.time&&p.cells.length>1){const u=clamp((c.mergeAt-state.world.time)/8,0,1);ctx.beginPath();ctx.arc(s.x,s.y,r+7,-Math.PI/2,-Math.PI/2+Math.PI*2*u);ctx.lineWidth=2;ctx.strokeStyle='#8abf9a99';ctx.stroke();}
 if(state.mode==='storm'&&state.world.outside(c.x,c.y)){circle(s.x,s.y,r+2,null,'#be6b9c',2);if(r>20){ctx.fillStyle='#b45485';ctx.font=`600 10px ${getFont()}`;ctx.fillText('圈外 −质量',s.x,s.y-r-12);}}
}
function getFont(){return '"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif';}
function draw(dt){ctx.setTransform(DPR,0,0,DPR,0,0);ctx.clearRect(0,0,W,H);ctx.fillStyle='#f8faf8';ctx.fillRect(0,0,W,H);const w=state.world,z=state.camera.z,a=screen(0,0),b=screen(2600,1800);ctx.fillStyle='#ffffff';ctx.fillRect(a.x,a.y,b.x-a.x,b.y-a.y);ctx.strokeStyle='#e6ece7';ctx.lineWidth=1;ctx.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y);
 if(state.mode==='storm'){const zone=timeline.zone(w.zone),c=screen(zone.x,zone.y);ctx.save();ctx.beginPath();ctx.rect(Math.max(0,a.x),Math.max(0,a.y),Math.min(W,b.x)-Math.max(0,a.x),Math.min(H,b.y)-Math.max(0,a.y));ctx.clip();ctx.beginPath();ctx.rect(a.x,a.y,b.x-a.x,b.y-a.y);ctx.arc(c.x,c.y,Math.max(.01,zone.r*z),0,Math.PI*2,true);ctx.fillStyle='#b8adea28';ctx.fill('evenodd');ctx.restore();circle(c.x,c.y,zone.r*z,null,'#a394d6',2);if(zone.next){const n=screen(zone.next.x,zone.next.y);ctx.save();ctx.setLineDash([7,6]);circle(n.x,n.y,zone.next.r*z,null,'#b7add390',1.4);ctx.restore();}}
 for(const f of w.food)drawFood(f,z);
 for(const raw of w.pellets){const f=timeline.entity(raw),s=screen(f.x,f.y),r=radius(f.mass)*z;circle(s.x,s.y,r,BRANDS[f.owner]?.color||'#333');}
 for(const raw of w.thorns){const t=timeline.entity(raw),s=screen(t.x,t.y),r=t.r*z;if(s.x<-r||s.y<-r||s.x>W+r||s.y>H+r)continue;star(s.x,s.y,r*1.1,14,.82,.1);ctx.fillStyle='#e5eae7';ctx.fill();ctx.strokeStyle='#94a09a';ctx.lineWidth=1.3;ctx.stroke();circle(s.x,s.y,r*.53,'#f7faf7','#b9c5be',.7);circle(s.x-r*.19,s.y,r*.08,'#95a39a');circle(s.x+r*.19,s.y,r*.08,'#95a39a');}
 if(state.showGuides&&canControl()&&w.players[state.human].cells.length){
  const c=timeline.center(w,state.human),a=controller.sample(screen(c.x,c.y),performance.now(),false),gather=a.gather;
  const target=Number.isFinite(a.aimAtX)?{x:a.aimAtX,y:a.aimAtY}:null;
  const goal=gather?{x:a.gatherAtX,y:a.gatherAtY}:target;
  ctx.save();ctx.strokeStyle='#94b4a36b';ctx.lineWidth=1.3;
  for(const raw of w.players[state.human].cells){const cell=timeline.cell(raw),s=screen(cell.x,cell.y),r=radius(cell.mass)*z;
   const[dx,dy]=goal?norm(goal.x-s.x,goal.y-s.y):[a.aimX,a.aimY];if(!dx&&!dy)continue;
   const distance=goal?Math.hypot(goal.x-s.x,goal.y-s.y):Infinity;
   const len=Math.min(distance,r+65);if(len<=r)continue;
   ctx.setLineDash([3,7]);ctx.beginPath();ctx.moveTo(s.x+dx*(r+5),s.y+dy*(r+5));ctx.lineTo(s.x+dx*len,s.y+dy*len);ctx.stroke();ctx.setLineDash([]);
   const ex=s.x+dx*len,ey=s.y+dy*len;ctx.beginPath();ctx.moveTo(ex-dx*7-dy*4,ey-dy*7+dx*4);ctx.lineTo(ex,ey);ctx.lineTo(ex-dx*7+dy*4,ey-dy*7-dx*4);ctx.stroke();
  }ctx.restore();if(goal)circle(goal.x,goal.y,gather?8:5,null,'#8eb39b99');
 }
 const cells=w.players.flatMap(p=>p.cells.map(c=>({p,c}))).sort((a,b)=>a.c.mass-b.c.mass);for(const{p,c}of cells)drawCell(c,p,z);
 for(const f of state.fx){f.life-=dt;const s=screen(f.x,f.y),u=1-f.life/f.max;ctx.globalAlpha=Math.max(0,1-u);circle(s.x,s.y,(f.r+u*45)*z,null,f.type==='burst'?'#9b9c93':'#76be9e',2);ctx.globalAlpha=1;}state.fx=state.fx.filter(f=>f.life>0);
 // Subtle arena coordinates help identify map edges without adding a grid.
 if(state.view==='all'){ctx.fillStyle='#b4c2b7';ctx.font=`9px ${getFont()}`;ctx.textAlign='left';ctx.fillText('0, 0',a.x+8,a.y+15);ctx.textAlign='right';ctx.fillText('2600, 1800',b.x-8,b.y-9);}
 drawMini();}
function drawMini(){const w=state.world,s=330/2600;mc.clearRect(0,0,330,228);mc.fillStyle='#f5f8f5';mc.fillRect(0,0,330,228);mc.strokeStyle='#e4ebe4';mc.strokeRect(.5,.5,329,227);if(state.mode==='storm'){mc.beginPath();mc.rect(0,0,330,228);mc.arc(w.zone.x*s,w.zone.y*s,w.zone.r*s,0,Math.PI*2,true);mc.fillStyle='#c5b9e33d';mc.fill('evenodd');mc.beginPath();mc.arc(w.zone.x*s,w.zone.y*s,w.zone.r*s,0,Math.PI*2);mc.strokeStyle='#a99ccb';mc.lineWidth=2;mc.stroke();}for(const p of w.players)for(const raw of p.cells){const c=timeline.cell(raw);mc.beginPath();mc.arc(c.x*s,c.y*s,Math.max(p.id===state.human?4:2.5,radius(c.mass)*s*.5),0,Math.PI*2);mc.fillStyle=p.color;mc.fill();if(p.id===state.human){mc.lineWidth=2;mc.strokeStyle='#60b28a';mc.stroke();}}const cam=state.camera;mc.strokeStyle='#86ae9555';mc.lineWidth=1;mc.strokeRect((cam.x-W/2/cam.z)*s,(cam.y-H/2/cam.z)*s,W/cam.z*s,H/cam.z*s);}
function rankText(entry){return state.world.mode!=='team'&&!state.world.finished&&entry.alive?'●':String(entry.rank);}
function rankStatus(entry){return entry.alive?Math.round(entry.mass).toLocaleString('en-US'):(state.world.mode==='team'&&!state.world.finished?'待重生':'已淘汰');}
function rankingHTML(){const w=state.world,rows=w.result?.ranking||w.standings();return rows.map(entry=>{const p=w.players[entry.id];return `<div data-player="${p.id}" class="rank-row ${state.humanEnabled&&p.id===state.human?'you':''} ${!entry.alive?'dead':''}"><span class="rank-num">${rankText(entry)}</span>${logoHTML(p.id)}<span class="rank-name">${p.name}${state.humanEnabled&&p.id===state.human?'<em>你</em>':''}</span>${w.mode==='team'?`<i class="team-dot" style="background:${p.team===0?'#79aeda':'#e6a55e'}"></i>`:''}<span class="rank-score">${rankStatus(entry)}</span></div>`;}).join('');}
function updateRanking(){
 const w=state.world,list=$('rankList'),entries=w.result?.ranking||w.standings();
 $('rankKind').textContent=w.mode==='team'?'按队伍总质量':'按存活顺序';
 $('rankFoot').textContent=w.mode==='team'?'队伍名次 · 右侧为个人质量':'右侧质量仅展示 · 存活者暂不分先后';
 for(const row of [...list.children])if(!entries.some(e=>String(e.id)===row.dataset.player))row.remove();
 for(let index=0;index<entries.length;index++){
  const entry=entries[index],p=w.players[entry.id];let row=list.querySelector(`[data-player="${p.id}"]`);
  if(!row){row=document.createElement('div');row.className='rank-row';row.dataset.player=p.id;row.innerHTML=`<span class="rank-num"></span>${logoHTML(p.id)}<span class="rank-name">${p.name}<em>你</em></span><i class="team-dot"></i><span class="rank-score"></span>`;list.appendChild(row);}
  if(list.children[index]!==row)list.insertBefore(row,list.children[index]||null);
  const you=state.humanEnabled&&p.id===state.human;row.classList.toggle('you',you);row.classList.toggle('dead',!entry.alive);row.querySelector('em').hidden=!you;
  row.querySelector('.rank-num').textContent=rankText(entry);row.querySelector('.rank-score').textContent=rankStatus(entry);
  row.title=entry.alive?'当前质量 '+Math.round(entry.mass):(entry.eliminatedAt===null?'未存活':`淘汰时间 ${entry.eliminatedAt.toFixed(2)} 秒 · 同帧出局并列`);
  const dot=row.querySelector('.team-dot');dot.hidden=w.mode!=='team';dot.style.background=p.team===0?'#79aeda':'#e6a55e';
 }
}

function updateHUD(){if(!state.world)return;$('playerCard').classList.toggle('hidden',!state.humanEnabled);document.querySelector('.controls-bar').classList.toggle('hidden',!state.humanEnabled);const w=state.world,p=w.players[state.human],m=w.mass(state.human),remain=Math.max(0,Math.ceil(w.options.duration-w.time));if($('humanIcon').dataset.brand!==p.icon){$('humanIcon').src=ASSETS[p.icon];$('humanIcon').dataset.brand=p.icon;}$('humanName').textContent=p.name;$('humanTeam').textContent=w.mode==='team'?(p.team===0?'蓝队 · 最后一球保护':'橙队 · 最后一球保护'):(state.replay?'回放中的玩家':'手动操作');$('massValue').textContent=Math.round(m).toLocaleString('en-US');$('cellCount').textContent=`${p.cells.length} / 16`;const cooldown=Math.max(0,...p.cells.map(c=>c.mergeAt-w.time));$('mergeInfo').textContent=p.cells.length>1?(cooldown>0?`${cooldown.toFixed(1)}s 可合并`:'按空格聚拢合并'):'完整球体';$('massMeter').style.width=`${clamp(m/1000*100,0,100)}%`;$('timerValue').textContent=`${String(Math.floor(remain/60)).padStart(2,'0')}:${String(remain%60).padStart(2,'0')}`;$('modeLabel').textContent={solo:'个人赛',team:'随机团队赛',storm:'缩圈生存'}[w.mode];$('aliveCount').textContent=`${w.players.filter(p=>p.cells.length).length} 位${w.mode!=='team'?'存活':'选手'}`;updateRanking();$('teamScores').classList.toggle('hidden',w.mode!=='team');if(w.mode==='team'){$('teamScores').innerHTML=[0,1].map(t=>`<span>${t===0?'蓝队':'橙队'} <b>${Math.round(w.players.filter(p=>p.team===t).reduce((s,p)=>s+w.mass(p.id),0))}</b></span>`).join('');}
 $('zoneStatus').classList.toggle('hidden',w.mode!=='storm');if(w.mode==='storm'){const danger=p.cells.some(c=>w.outside(c.x,c.y));$('zoneStatus').classList.toggle('danger',danger);$('zoneStatus').textContent=danger?'你有分身在圈外，正在损失质量':`第 ${w.zone.phase} 圈 · ${w.zone.shrinking?'正在收缩':'下一次收缩'} ${Math.ceil(w.zone.remaining)}s`;}
 const speeds=p.cells.map(c=>Arena.moveSpeed(c.mass)/CFG.baseMoveSpeed*100);$('speedInfo').textContent=speeds.length?'基础移速 · '+(Math.max(...speeds)-Math.min(...speeds)<.05?Math.min(...speeds).toFixed(1):Math.min(...speeds).toFixed(1)+'–'+Math.max(...speeds).toFixed(1))+'%':'基础移速 · —';
 const aim=controller.sample(screen(w.center(state.human).x,w.center(state.human).y),performance.now(),false);$('aimStatus').textContent=state.replay?'正在回放':aim.gather?'聚拢 · '+(controller.pointer.inside?'鼠标位置':'移动方向前方'):aim.aimSource==='mouse'?'瞄准 · 每颗球 → 鼠标':'瞄准 · '+(aim.aimSource==='keys'?'WASD 八向':'最后移动方向');
 $('cameraToggle').textContent=state.view==='all'?'⊞ 全场':'◎ 跟随';$('zoomLabel').textContent=Math.round(state.zoom*100)+'%';$('pauseToggle').textContent=state.paused?'▶':'Ⅱ';$('pausedBadge').classList.toggle('hidden',!state.paused||!state.started||w.finished||!$('help').classList.contains('hidden')||!$('welcome').classList.contains('hidden'));
 $('replayStatus').textContent=state.replay?`回放播放 · ${state.replayIndex} / ${state.replay.frames.length} 帧`:`已记录 ${state.record.length} 帧 · 使用工具 ${state.testTools} 次`;
 const ev=w.events.filter(e=>['death','burst','respawn'].includes(e.type)&&w.time-e.t<12).slice(-4);$('events').innerHTML=ev.map(e=>`<div class="event-line">${e.type==='death'?(e.killer!==null?`<b>${BRANDS[e.killer].name}</b> 吞噬了 ${BRANDS[e.player].name}`:`${BRANDS[e.player].name} 在圈外出局`):e.type==='burst'?`${BRANDS[e.player].name} 吃刺 +20% · 四分`:`${BRANDS[e.player].name} 重新入场`}</div>`).join('');
 $('objectiveStatus').textContent=w.mode==='team'?'终局比全队总质量 · 团灭提前结束':'活到最后才获胜 · 质量不是积分';
 if(state.humanEnabled&&state.started&&!p.cells.length&&!w.finished){$('centerMessage').classList.remove('hidden');$('centerMessage').innerHTML=w.mode!=='team'?'<strong>你已出局</strong><span>本局不复活，继续观战；工具重生仅限机制测试</span>':`<strong>被吞噬了</strong><span>${Math.max(0,Math.ceil(p.respawnAt-w.time))} 秒后重新入场</span>`;}else $('centerMessage').classList.add('hidden');
}
function showResult(){
 resultShown=true;const w=state.world,r=w.result;if(!r)return;
 let title,detail;
 if(r.status==='practice'){title='测试结束';detail='只有零或一方参赛，不产生比赛冠军。';}
 else if(w.mode==='team'){
  title=r.teamWinner===null?'双方平局':`${r.teamWinner===0?'蓝队':'橙队'}获胜`;
  detail=r.reason==='team-eliminated'?'敌方整队淘汰，提前获胜。':r.reason==='mutual-elimination'?'双方同帧全灭，平局。':'到时比较全队总质量，不比较单个队员大小。';
 }else{
  title=r.winner!==null?`${BRANDS[r.winner].name} 获胜`:r.status==='undecided'?'时间到 · 未分胜负':'全部淘汰 · 无冠军';
  detail=r.status==='undecided'?'仍存活的选手并列，总质量不决定冠军；其余按淘汰先后排名。':'按存活顺序排名，同帧淘汰并列；总质量仅用于体量和展示。';
 }
 $('resultTitle').textContent=title;$('resultSub').textContent=detail+(state.replay?' 当前为回放。':'')+(state.testTools?' 本局使用过测试工具。':'');
 $('resultRanks').innerHTML=rankingHTML();$('resultOverlay').classList.remove('hidden');
}
function togglePause(){if(!state.started||state.world.finished||!$('welcome').classList.contains('hidden'))return;state.paused=!state.paused;clearControls();sfx.stopAll();accumulator=0;timeline.reset(state.world);updateHUD();}
function toggleView(){state.view=state.view==='all'?'follow':'all';state.zoom=1;updateHUD();}
function toggleTools(){$('tools').classList.toggle('hidden');}
function toolParams(){const c=state.world.center(state.human),a=controller.sample(screen(c.x,c.y),performance.now(),false);return{human:state.human,dx:a.aimX,dy:a.aimY};}
const allowedTools=new Set(['massPlus','massMinus','food','thorn','prey','predator','merge','respawn','zone','stormOutside']);
function applyTool(name,params=toolParams(),record=true){if(!allowedTools.has(name))return;if(record&&!state.humanEnabled){toast('纯 AI 比赛不修改场上状态；手动测试请先勾选“我也入场”');return;}if(state.replay&&record){toast('回放中不能修改比赛。重开一局后可使用。');return;}const w=state.world,id=clamp(Math.floor(params.human??state.human),0,5),p=w.players[id];if(w.finished&&record){toast('本局已结束，请先重开一局。');return;}const c=w.center(id),[nx0,ny]=norm(params.dx??1,params.dy??0),nx=nx0||(!ny?1:0);const biggest=p.cells.reduce((a,b)=>!a||a.mass<b.mass?b:a,null);if(name!=='respawn'&&!biggest){if(record)toast('角色已出局，先点击“测试重生”。');return;}
 if(name==='massPlus')biggest.mass=Math.min(biggest.mass+250,50000);if(name==='massMinus')biggest.mass=Math.max(5,biggest.mass-100);
 if(name==='food')for(let i=0;i<40;i++){const a=i/40*Math.PI*2,rr=radius(biggest.mass)+45+(i%3)*17;w.addFood(clamp(c.x+Math.cos(a)*rr,10,2590),clamp(c.y+Math.sin(a)*rr,10,1790));}
 if(name==='thorn'){const d=radius(biggest.mass)+70;w.addThorn(clamp(c.x+nx*d,35,2565),clamp(c.y+ny*d,35,1765));}
 if(name==='prey'||name==='predator'){let q=w.players.find(q=>q.active&&w.isEnemy(id,q.id));if(!q){toast('场内没有其他已报名选手，不添加隐藏陪练');return;}const m=name==='prey'?Math.max(8,biggest.mass*.35):biggest.mass*2;const d=radius(biggest.mass)+radius(m)+100;const b=w.makeCell(q.id,clamp(c.x+nx*d,100,2500),clamp(c.y+ny*d,100,1700),m);b.shieldUntil=0;q.cells=[b];q.eliminatedAt=null;q.eliminatedTick=null;q.respawnAt=Infinity;biggest.shieldUntil=0;}
 if(name==='merge'){const mass=w.mass(id),b=w.makeCell(id,c.x,c.y,mass);p.cells=[b];}
 if(name==='respawn'){w.spawn(id);const cc=p.cells[0];if(w.mode==='storm'){cc.x=w.zone.x;cc.y=w.zone.y;}p.respawnAt=Infinity;}
 if(name==='zone'){if(w.mode==='storm')w.advanceZone();else if(record)toast('请切换到缩圈生存模式。');}
 if(name==='stormOutside'){if(w.mode==='storm'){if(w.zone.r>800)w.advanceZone();const angle=Math.atan2(900-w.zone.y,1300-w.zone.x)+Math.PI;for(let i=0;i<p.cells.length;i++){const a=angle+i*.1;p.cells[i].x=clamp(w.zone.x+Math.cos(a)*(w.zone.r+90),20,2580);p.cells[i].y=clamp(w.zone.y+Math.sin(a)*(w.zone.r+90),20,1780);}}else if(record)toast('请切换到缩圈生存模式。');}
 if(record){timeline.reset(w);state.pendingCommands.push([name,params]);state.testTools++;if(!['zone','stormOutside'].includes(name))toast({massPlus:'已增加 250 质量',massMinus:'已减少质量',food:'食物已生成在你周围',thorn:'刺球已放在你前方',prey:'小陪练已放到你前方',predator:'大陪练已放到你前方',merge:'测试：已立即合并',respawn:'测试：已重新入场'}[name]);}updateHUD();}
state.tool=applyTool;
function download(name,data,type='application/json'){const blob=new Blob([data],{type}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),10000);}
function replayData(){return state.replay||{format:'ball-arena-replay',version:1,engine:'0.6.0',options:recordOptions,human:state.human,humanEnabled:state.humanEnabled,submissions:lobby.audit(),errors:state.agentErrors,testTools:state.testTools,frames:state.record,finalCommands:state.pendingCommands};}
state.exportReplay=replayData;
function saveReplay(){download(`球球回放_${state.mode}_${state.seed}.json`,JSON.stringify(replayData()));toast('已导出回放文件；可在本测试版中导入播放。');}
function importReplay(data){if(!data||data.format!=='ball-arena-replay'||data.version!==1||data.engine!=='0.6.0'||!Array.isArray(data.frames)||data.frames.length>60000||!data.options||!['solo','team','storm'].includes(data.options.mode))throw Error('不是此版本支持的回放文件');if(!Number.isInteger(data.human)||data.human<0||data.human>5)throw Error('回放角色编号不合法');const checkCommands=commands=>{if(!Array.isArray(commands)||commands.length>100)throw Error('回放工具命令不合法');for(const cmd of commands){const p=cmd?.[1];if(!Array.isArray(cmd)||!allowedTools.has(cmd[0])||!p||typeof p!=='object'||!Number.isInteger(p.human)||p.human<0||p.human>5||!Number.isFinite(p.dx)||!Number.isFinite(p.dy))throw Error('回放工具命令不合法');}};checkCommands(data.finalCommands||[]);for(const f of data.frames){if(!f||!f.actions||typeof f.actions!=='object'||Array.isArray(f.actions))throw Error('回放帧格式不正确');checkCommands(f.commands||[]);for(const [id,a] of Object.entries(f.actions)){if(!/^[0-5]$/.test(id)||!a||typeof a!=='object')throw Error('回放行动格式不正确');for(const k of ['dx','dy','aimX','aimY','aimAtX','aimAtY','gatherAtX','gatherAtY','tx','ty','throttle'])if(a[k]!==undefined&&!Number.isFinite(a[k]))throw Error('回放行动包含无效数字');}}
 if(!Array.isArray(data.options.activeIds)||data.options.activeIds.some(id=>!Number.isInteger(id)||id<0||id>5))throw Error('回放名单不合法');state.human=data.human;state.humanEnabled=!!data.humanEnabled;newGame(data.options.mode,data.options.seed,true,{activeIds:data.options.activeIds});pool.stop();state.replay=data;state.testTools=data.testTools||0;state.replayIndex=0;state.view='all';state.freeze=true;$('freezeBots').checked=true;$('replayStatus').textContent='正在播放回放';state.paused=false;toast('回放已载入。操作键不会改变记录中的比赛。');}
state.importReplay=importReplay;
function openHelp(){helpPaused=state.paused;state.paused=true;clearControls();sfx.stopAll();$('help').classList.remove('hidden');updateHUD();}function closeHelp(){$('help').classList.add('hidden');state.paused=helpPaused;accumulator=0;updateHUD();}
$('startGame').onclick=()=>startMatch();
$('entriesToggle').onclick=openEntries;$('lobbyClose').onclick=()=>{if(state.started){$('welcome').classList.add('hidden');state.paused=false;last=performance.now();accumulator=0;}else toast('先导入选手或选择手动测试');};
$('humanEnabled').onchange=updateEntrySummary;$('humanSeat').onchange=updateEntrySummary;
$('exportAgentReport').onclick=()=>download('选手错误与提交记录.json',JSON.stringify(lobby.audit(),null,2));
$('downloadBrief').onclick=()=>download('AI参赛任务书.md',AI_BRIEF,'text/markdown;charset=utf-8');
$('resetEntries').onclick=()=>{if(confirm('开始新的测试批次会清空所有导入文件和修复次数。已有回放不会删除。继续？')){pool.stop();state.started=false;lobby.reset();}};
document.querySelectorAll('.modes [data-mode]').forEach(b=>b.onclick=()=>{if(state.starting||lobby.busy)return;if(state.started)startMatch(b.dataset.mode,state.seed);else newGame(b.dataset.mode,state.seed,false);});
$('toolsToggle').onclick=toggleTools;$('closeTools').onclick=toggleTools;$('pauseToggle').onclick=togglePause;$('cameraToggle').onclick=toggleView;$('helpToggle').onclick=openHelp;$('closeHelp').onclick=closeHelp;
$('freezeBots').onchange=e=>state.freeze=e.target.checked;$('showGuides').onchange=e=>state.showGuides=e.target.checked;$('cleanView').onchange=e=>{state.clean=e.target.checked;document.body.classList.toggle('clean',state.clean);resize();};
$('soundToggle').onclick=async()=>{sfx.setEnabled(!sfx.enabled);syncAudioUI();saveAudioSettings();if(sfx.enabled){const ok=await unlockAudio();if(ok)sfx.play('ui');else toast('音频暂未解锁，请再次点击音效按钮。');}toast(sfx.enabled?'音效已开启':'音效已关闭');};
$('volumeSlider').oninput=e=>{sfx.setVolume(Number(e.target.value)/100);syncAudioUI();saveAudioSettings();};
document.querySelectorAll('[data-sfx]').forEach(b=>b.onclick=async()=>{if(!sfx.enabled){sfx.setEnabled(true);syncAudioUI();saveAudioSettings();}if(await unlockAudio())sfx.play(b.dataset.sfx);else toast('当前浏览器未能开启音频。');});
$('changePlayer').onclick=openEntries;
$('zoomIn').onclick=()=>state.zoom=clamp(state.zoom*1.15,.45,2.3);$('zoomOut').onclick=()=>state.zoom=clamp(state.zoom/1.15,.45,2.3);
$('fullscreenToggle').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('浏览器不允许全屏，可按 F11。');}};
$('restartGame').onclick=()=>startMatch(state.mode,$('seedInput').value);$('shuffleGame').onclick=()=>startMatch(state.mode,Math.floor(Math.random()*4294967295));$('speedSelect').onchange=e=>{state.speed=+e.target.value;accumulator=0;};
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>applyTool(b.dataset.tool));$('saveReplay').onclick=saveReplay;$('resultReplay').onclick=saveReplay;$('resultAgain').onclick=()=>startMatch(state.mode,state.seed);$('resultClose').onclick=()=>$('resultOverlay').classList.add('hidden');
$('saveState').onclick=()=>{download(`球球问题快照_${state.world.tick}.json`,JSON.stringify({format:'ball-arena-debug',version:'0.6.0',human:state.human,settings:recordOptions,performance:state.performance,viewport:{width:W,height:H,dpr:DPR},state:state.world.snapshot()},null,2));toast('已导出问题快照，便于反馈机制问题。');};
$('saveImage').onclick=()=>{try{const a=document.createElement('a');a.download=`球球画面_${state.world.tick}.png`;a.href=canvas.toDataURL('image/png');a.click();toast('已保存当前游戏画面（不含界面面板）。');}catch{toast('截图失败，请使用系统截图。');}};
$('loadReplay').onclick=()=>$('replayInput').click();$('replayInput').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>30*1024*1024)throw Error('回放文件不能超过 30 MB');importReplay(JSON.parse(await f.text()));}catch(err){toast('导入失败：'+err.message);}e.target.value='';};
function trackPointer(e){const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;state.pointer={x,y,active:true};controller.pointerMove(x,y,performance.now());if(e.pointerType==='touch'&&e.buttons){const c=state.world.center(state.human),p=screen(c.x,c.y);controller.touchVector={x:x-p.x,y:y-p.y};}}
canvas.addEventListener('pointermove',trackPointer);
canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.focus();trackPointer(e);unlockAudio();if(!canControl())return;if(e.pointerType==='touch'){const c=state.world.center(state.human),p=screen(c.x,c.y);controller.touchVector={x:controller.pointer.x-p.x,y:controller.pointer.y-p.y};return;}if(e.button===0)controller.ejecting=true;if(e.button===2)controller.queueSplit();});
canvas.addEventListener('pointerleave',()=>{controller.pointerLeave();state.pointer.active=false;});
canvas.addEventListener('pointercancel',()=>{controller.pointerLeave();state.pointer.active=false;});
window.addEventListener('pointerup',e=>{if(e.button===0||e.pointerType==='touch')controller.ejecting=false;if(e.pointerType==='touch'){controller.touchVector=null;controller.touchGather=false;}});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{e.preventDefault();state.zoom=clamp(state.zoom*Math.exp(-e.deltaY*.001),.45,2.3);},{passive:false});
window.addEventListener('keydown',e=>{
 if(['SELECT','TEXTAREA'].includes(document.activeElement.tagName)||(document.activeElement.tagName==='INPUT'&&!['checkbox','button'].includes(document.activeElement.type)))return;
 const code=e.code||e.key,k=e.key.toLowerCase(),shortcuts=['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','KeyE','KeyP','KeyV','KeyT','KeyH'];
 if(shortcuts.includes(code))e.preventDefault();
 if(!$('help').classList.contains('hidden')){if(k==='escape'||k==='?')closeHelp();return;}
 if(!$('welcome').classList.contains('hidden')){if(k==='enter')$('startGame').click();return;}
 if(k==='escape'){$('tools').classList.add('hidden');return;}
 if(!e.repeat){if(code==='KeyP')togglePause();if(code==='KeyV')toggleView();if(code==='KeyT')toggleTools();if(code==='KeyH'){$('cleanView').checked=!$('cleanView').checked;$('cleanView').dispatchEvent(new Event('change'));}}
 if(canControl()){controller.key(code,true);unlockAudio();}
});
window.addEventListener('keyup',e=>controller.key(e.code||e.key,false));
window.addEventListener('blur',()=>{clearControls();sfx.stopAll();if(state.started&&!state.world.finished){state.paused=true;updateHUD();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){state.paused=true;clearControls();sfx.stopAll();}last=performance.now();accumulator=0;updateHUD();});
document.addEventListener('focusin',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))clearControls();});
$('touchSplit').onpointerdown=e=>{e.preventDefault();unlockAudio();if(canControl())controller.queueSplit();};
$('touchEject').onpointerdown=e=>{e.preventDefault();unlockAudio();if(canControl())controller.ejecting=true;};
$('touchGather').onpointerdown=e=>{e.preventDefault();if(canControl())controller.touchGather=true;};
$('touchGather').onpointerup=()=>controller.touchGather=false;
window.addEventListener('resize',resize);
function frame(now){
 const elapsed=Math.max(0,(now-last)/1000),dt=Math.min(.1,elapsed);last=now;
 if(state.started&&!state.paused&&!state.world.finished){
  accumulator+=dt*state.speed;let n=0;
  while(accumulator+1e-12>=1/60&&n<12){if(!step()){accumulator=Math.min(accumulator,1/60);break;}accumulator=Math.max(0,accumulator-1/60);n++;if(state.paused||state.world.finished)break;}
  timeline.begin(state.world,accumulator*60);
 }else{accumulator=0;timeline.reset(state.world);}
 updateCamera(dt);draw(dt);
 perfTime+=elapsed;perfFrames++;if(perfTime>=.5){state.performance={fps:Math.round(perfFrames/perfTime),frameMs:perfTime*1000/perfFrames};perfTime=0;perfFrames=0;}
 state.frameCount++;uiClock+=dt;if(uiClock>.1){uiClock=0;updateHUD();if($('performanceStatus'))$('performanceStatus').textContent=`画面 ${state.performance.fps} FPS · 物理 60 Hz · 平滑插值开启`;}
 requestAnimationFrame(frame);
}
state.screenPoint=(x,y)=>screen(x,y);
try{const a=JSON.parse(localStorage.getItem('ball-arena-audio-v02')||'null');if(a){sfx.setEnabled(a.enabled!==false);sfx.setVolume(a.volume??.35);}}catch{}syncAudioUI();initPicker();resize();newGame();requestAnimationFrame(frame);
})();
