/* Ball Arena deterministic simulation. No browser or network dependencies. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.Arena=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const CFG={width:2600,height:1800,startMass:240,foodMass:2,ejectMass:10,ejectMin:30,splitMin:80,maxCells:16,mergeDelay:8,splitCooldown:.35,ejectCooldown:.12,eatRatio:1.2,thornMin:120,thornReward:.20,thornPieces:4,pelletOwnerGrace:.5,thornRadius:27,duration:180};
const BRANDS=[{name:'GPT',color:'#191b20',tint:'#f3f4f5',icon:'openai'},{name:'DeepSeek',color:'#4d6bfe',tint:'#eff3ff',icon:'deepseek-color'},{name:'Claude',color:'#d97757',tint:'#fff1e9',icon:'claude-color'},{name:'Grok',color:'#565a65',tint:'#f1f2f4',icon:'grok'},{name:'豆包',color:'#7969e6',tint:'#f4efff',icon:'doubao-color'},{name:'Gemini',color:'#4285f4',tint:'#eef6ff',icon:'gemini-color'}];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,f=0)=>Number.isFinite(v)?v:f;
const radius=m=>Math.sqrt(Math.max(0,m))*3;
function rng(seed){let s=seed>>>0;const f=()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};return f;}
function norm(x,y){x=finite(x);y=finite(y);const d=Math.hypot(x,y);return d>1e-8?[x/d,y/d]:[0,0];}
// Use each cell as the origin. Legacy vector-only actions remain supported.
function cellAim(c,dx,dy,x,y){let n=Number.isFinite(x)&&Number.isFinite(y)?norm(x-c.x,y-c.y):norm(dx,dy);if(!n[0]&&!n[1])n=norm(dx,dy);return n[0]||n[1]?n:[1,0];}
// A circle's centre cannot reach the geometric edge or every corner food item.
function cellBounds(c,pad=0){const r=radius(c.mass);const x=Math.min(CFG.width/2,r+pad),y=Math.min(CFG.height/2,r+pad);return{minX:x,maxX:CFG.width-x,minY:y,maxY:CFG.height-y};}
function reachableTarget(c,target,kind='food'){
 if(!c||!target||!Number.isFinite(target.x)||!Number.isFinite(target.y)||c.mass<=target.mass)return null;
 const r=radius(c.mass),reach=kind==='enemy'?r-radius(target.mass)*.35:kind==='pellet'?r-radius(target.mass)*.25:r;
 const b=cellBounds(c,.5),x=clamp(target.x,b.minX,b.maxX),y=clamp(target.y,b.minY,b.maxY);
 if(reach<=0||(x-target.x)**2+(y-target.y)**2>=(reach-.1)**2)return null;
 return{x,y,reach};
}
function constrainCell(c){const b=cellBounds(c);c.x=clamp(c.x,b.minX,b.maxX);c.y=clamp(c.y,b.minY,b.maxY);if((c.x<=b.minX&&c.vx<0)||(c.x>=b.maxX&&c.vx>0))c.vx=0;if((c.y<=b.minY&&c.vy<0)||(c.y>=b.maxY&&c.vy>0))c.vy=0;}
class World{
 constructor(options={}){
  this.options={mode:'solo',seed:20261107,foodCount:1050,thornCount:18,respawn:true,duration:180,...options};
  this.mode=this.options.mode;this.seed=this.options.seed>>>0;this.random=rng(this.seed);this.time=0;this.tick=0;this.uid=1;this.food=[];this.pellets=[];this.thorns=[];this.events=[];this.finished=false;this.result=null;this.spawnClock=0;this.thornClock=0;this.zoneOverride=null;
  this.players=BRANDS.map((b,id)=>({...b,id,team:id%2,cells:[],nextSplit:0,nextEject:0,deaths:0,kills:0,respawnAt:Infinity,eliminatedAt:null}));
  if(this.mode==='team'){const ids=[0,1,2,3,4,5];for(let i=5;i>0;i--){const j=Math.floor(this.random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}ids.forEach((id,k)=>this.players[id].team=k<3?0:1);}
  this.buildZones();this.updateZone();
  for(const p of this.players)this.spawn(p.id,true);
  for(let i=0;i<this.options.foodCount;i++)this.addFood(...this.randomPoint(25));
  for(let i=0;i<this.options.thornCount;i++){let pt;for(let k=0;k<30;k++){pt=this.randomPoint(80);if(this.players.every(p=>Math.hypot(p.cells[0].x-pt[0],p.cells[0].y-pt[1])>180))break;}this.addThorn(...pt);}
 }
 randomPoint(pad=50){return[pad+this.random()*(CFG.width-2*pad),pad+this.random()*(CFG.height-2*pad)];}
 emit(type,data={}){this.events.push({type,t:this.time,id:this.uid++,...data});if(this.events.length>160)this.events.shift();}
 makeCell(owner,x,y,mass){return{id:this.uid++,owner,x,y,mass,vx:0,vy:0,mergeAt:0,shieldUntil:0,thornUntil:0};}
 mass(id){return this.players[id].cells.reduce((s,c)=>s+c.mass,0);}
 center(id){const cs=this.players[id].cells;let m=0,x=0,y=0;for(const c of cs){m+=c.mass;x+=c.x*c.mass;y+=c.y*c.mass;}return m?{x:x/m,y:y/m}:{x:CFG.width/2,y:CFG.height/2};}
 spawn(id,initial=false){const p=this.players[id];let x,y;if(initial){const a=(id/6)*Math.PI*2-Math.PI/2;x=1300+Math.cos(a)*780;y=900+Math.sin(a)*530;}else{let best=-Infinity;for(let k=0;k<24;k++){const pt=this.randomPoint(100);let d=Infinity;for(const q of this.players)if(q.id!==id)for(const c of q.cells)d=Math.min(d,Math.hypot(c.x-pt[0],c.y-pt[1])-radius(c.mass));if(d>best){best=d;[x,y]=pt;}}}
  const c=this.makeCell(id,x,y,CFG.startMass);c.shieldUntil=this.time+2;p.cells=[c];p.nextSplit=0;p.nextEject=0;p.respawnAt=Infinity;p.eliminatedAt=null;if(!initial)this.emit('respawn',{player:id});
 }
 addFood(x,y){const f={id:this.uid++,x,y,mass:CFG.foodMass,color:Math.floor(this.random()*7),shape:Math.floor(this.random()*4),angle:this.random()*Math.PI*2};this.food.push(f);return f;}
 addPellet(x,y,mass=10,owner=0,vx=0,vy=0){const p={id:this.uid++,x,y,mass,owner,vx,vy,born:this.time};this.pellets.push(p);return p;}
 addThorn(x,y){const t={id:this.uid++,x,y,r:CFG.thornRadius,vx:0,vy:0,fed:0};this.thorns.push(t);return t;}
 split(id,dx,dy,targetX,targetY){const p=this.players[id];if(this.time<p.nextSplit||p.cells.length>=CFG.maxCells)return false;const sources=p.cells.slice().sort((a,b)=>b.mass-a.mass);let n=0;for(const c of sources){if(c.mass<CFG.splitMin||p.cells.length>=CFG.maxCells)continue;const[nx,ny]=cellAim(c,dx,dy,targetX,targetY);c.mass/=2;c.mergeAt=this.time+CFG.mergeDelay;c.shieldUntil=0;const r=radius(c.mass);const b=this.makeCell(id,c.x+nx*r*.9,c.y+ny*r*.9,c.mass);b.vx=nx*690;b.vy=ny*690;b.mergeAt=c.mergeAt;b.thornUntil=c.thornUntil;p.cells.push(b);c.x-=nx*r*.18;c.y-=ny*r*.18;n++;}
  if(n){p.nextSplit=this.time+CFG.splitCooldown;this.emit('split',{player:id,count:n});}return n>0;
 }
 eject(id,dx,dy,targetX,targetY){const p=this.players[id];if(this.time<p.nextEject)return false;let n=0;for(const c of p.cells){if(c.mass<CFG.ejectMin)continue;const[nx,ny]=cellAim(c,dx,dy,targetX,targetY);c.mass-=CFG.ejectMass;const r=radius(c.mass)+radius(CFG.ejectMass)+3;this.addPellet(c.x+nx*r,c.y+ny*r,CFG.ejectMass,id,nx*340,ny*340);n++;}if(n){p.nextEject=this.time+CFG.ejectCooldown;this.emit('eject',{player:id,count:n});}return n>0;}
 buildZones(){const initial={x:1300,y:900,r:Math.hypot(1300,900)+20};const targets=[{r:880,wait:15,move:25},{r:560,wait:10,move:25},{r:320,wait:10,move:25},{r:150,wait:5,move:25},{r:0,wait:5,move:15}];this.zoneStages=[];let from=initial,start=0;for(let i=0;i<targets.length;i++){const t=targets[i],a=this.random()*Math.PI*2,offset=Math.min((from.r-t.r)*.45,170);let x=from.x+Math.cos(a)*offset,y=from.y+Math.sin(a)*offset;if(t.r>0&&t.r<800){x=clamp(x,t.r,CFG.width-t.r);y=clamp(y,t.r,CFG.height-t.r);}const to={x,y,r:t.r};this.zoneStages.push({start,end:start+t.wait+t.move,wait:t.wait,move:t.move,from,to,damage:[.035,.06,.10,.18,.3][i]});from=to;start+=t.wait+t.move;}this.zoneInitial=initial;}
 updateZone(){if(this.zoneOverride){this.zone={...this.zoneOverride};return;}let i=this.zoneStages.findIndex(s=>this.time<s.end);if(i<0)i=this.zoneStages.length-1;const s=this.zoneStages[i],u=clamp((this.time-s.start-s.wait)/s.move,0,1);this.zone={x:s.from.x+(s.to.x-s.from.x)*u,y:s.from.y+(s.to.y-s.from.y)*u,r:s.from.r+(s.to.r-s.from.r)*u,damage:s.damage,phase:i+1,shrinking:this.time>=s.start+s.wait,next:s.to,remaining:Math.max(0,(this.time<s.start+s.wait?s.start+s.wait:s.end)-this.time)};}
 setZone(z){this.zoneOverride={phase:1,shrinking:false,remaining:0,next:{x:z.x,y:z.y,r:z.r},...z};this.updateZone();}
 outside(x,y){return Math.hypot(x-this.zone.x,y-this.zone.y)>this.zone.r;}
 advanceZone(){if(this.mode!=='storm')return;const end=this.zoneStages.find(s=>s.end>this.time)?.end;if(end)this.time=Math.min(end+.001,this.options.duration-1);this.zoneOverride=null;this.updateZone();}
 isEnemy(a,b){return a!==b&&(this.mode!=='team'||this.players[a].team!==this.players[b].team);}
 resolveOwnCells(){for(const p of this.players){for(let i=0;i<p.cells.length;i++){const a=p.cells[i];for(let j=i+1;j<p.cells.length;j++){const b=p.cells[j];let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),ra=radius(a.mass),rb=radius(b.mass);if(this.time>=a.mergeAt&&this.time>=b.mergeAt&&d<Math.max(ra,rb)+Math.min(ra,rb)*.55){const m=a.mass+b.mass;a.x=(a.x*a.mass+b.x*b.mass)/m;a.y=(a.y*a.mass+b.y*b.mass)/m;a.vx=(a.vx*a.mass+b.vx*b.mass)/m;a.vy=(a.vy*a.mass+b.vy*b.mass)/m;a.mass=m;a.thornUntil=Math.max(a.thornUntil,b.thornUntil);p.cells.splice(j--,1);this.emit('merge',{player:p.id});continue;}const sum=ra+rb;if(d<sum*.9){if(d<.001){dx=1;dy=0;d=1;}const push=(sum*.9-d)*.24;a.x-=dx/d*push*b.mass/(a.mass+b.mass);a.y-=dy/d*push*b.mass/(a.mass+b.mass);b.x+=dx/d*push*a.mass/(a.mass+b.mass);b.y+=dy/d*push*a.mass/(a.mass+b.mass);}}}}}
 canEatThorn(c){return c.mass>=CFG.thornMin&&this.time>=c.thornUntil&&this.players[c.owner].cells.length+CFG.thornPieces-1<=CFG.maxCells;}
 burst(c,t){
  if(!this.canEatThorn(c))return false;
  const p=this.players[c.owner],before=c.mass,gain=before*CFG.thornReward,part=(before+gain)/CFG.thornPieces;
  c.mass=part;c.shieldUntil=0;c.thornUntil=this.time+1;c.mergeAt=this.time+CFG.mergeDelay;
  const rotation=this.random()*Math.PI*2;
  for(let i=0;i<CFG.thornPieces;i++){
   const a=rotation+Math.PI*2*i/CFG.thornPieces,b=i===0?c:this.makeCell(c.owner,c.x,c.y,part);
   b.vx=Math.cos(a)*340;b.vy=Math.sin(a)*340;b.mergeAt=c.mergeAt;b.thornUntil=c.thornUntil;
   if(i>0)p.cells.push(b);
  }
  this.emit('burst',{player:c.owner,x:t.x,y:t.y,before,gain,after:before+gain,pieces:CFG.thornPieces});return true;
 }
 consume(){let cells=this.players.flatMap(p=>p.cells).filter(c=>c.mass>0).sort((a,b)=>b.mass-a.mass||a.id-b.id);const foodDead=new Set(),pelletDead=new Set(),thornDead=new Set();for(const c of cells){let r=radius(c.mass),foodCount=0;for(const f of this.food){if(foodDead.has(f.id)||c.mass<=f.mass)continue;if(Math.abs(c.x-f.x)>r||Math.abs(c.y-f.y)>r)continue;if(Math.hypot(c.x-f.x,c.y-f.y)<r){c.mass+=f.mass;foodDead.add(f.id);foodCount++;}}
   if(foodCount)this.emit('foodEat',{player:c.owner,count:foodCount,x:c.x,y:c.y});
   r=radius(c.mass);for(const f of this.pellets){if(pelletDead.has(f.id)||c.mass<=f.mass||(f.owner===c.owner&&this.time-f.born<CFG.pelletOwnerGrace))continue;if(Math.hypot(c.x-f.x,c.y-f.y)<r-radius(f.mass)*.25){c.mass+=f.mass;r=radius(c.mass);pelletDead.add(f.id);this.emit('pelletEat',{player:c.owner,donor:f.owner,x:c.x,y:c.y});}}
   for(const t of this.thorns){if(thornDead.has(t.id)||!this.canEatThorn(c))continue;if(Math.hypot(c.x-t.x,c.y-t.y)<radius(c.mass)+t.r*.15){if(this.burst(c,t))thornDead.add(t.id);break;}}
  }
  for(const f of this.pellets){if(pelletDead.has(f.id))continue;for(const t of this.thorns){if(thornDead.has(t.id))continue;if(Math.hypot(f.x-t.x,f.y-t.y)<t.r){const[nx,ny]=norm(f.vx||t.x-f.x,f.vy||t.y-f.y);t.vx+=nx*65;t.vy+=ny*65;t.fed+=f.mass;pelletDead.add(f.id);break;}}}
  this.food=this.food.filter(f=>!foodDead.has(f.id));this.pellets=this.pellets.filter(f=>!pelletDead.has(f.id));this.thorns=this.thorns.filter(t=>!thornDead.has(t.id));
  cells=this.players.flatMap(p=>p.cells).filter(c=>c.mass>0).sort((a,b)=>b.mass-a.mass||a.id-b.id);const dead=new Set();for(const a of cells){if(dead.has(a.id)||this.time<a.shieldUntil)continue;for(const b of cells){if(a===b||dead.has(b.id)||!this.isEnemy(a.owner,b.owner)||this.time<b.shieldUntil||a.mass<b.mass*CFG.eatRatio)continue;const r=radius(a.mass),r2=radius(b.mass);if(Math.hypot(a.x-b.x,a.y-b.y)<r-r2*.35){a.mass+=b.mass;dead.add(b.id);this.emit('eat',{player:a.owner,victim:b.owner,x:b.x,y:b.y});}}}
  for(const p of this.players){const before=p.cells.length;p.cells=p.cells.filter(c=>!dead.has(c.id));if(before&&!p.cells.length){const e=[...this.events].reverse().find(e=>e.type==='eat'&&e.victim===p.id);if(e)this.players[e.player].kills++;this.markDeath(p,e?e.player:null);}}
 }
 markDeath(p,killer=null){if(p.eliminatedAt!==null)return;p.deaths++;p.eliminatedAt=this.time;p.respawnAt=this.mode!=='storm'&&this.options.respawn?this.time+3:Infinity;this.emit('death',{player:p.id,killer});}
 step(dt,actions={}){if(this.finished||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.1);this.time+=dt;this.tick++;this.updateZone();for(const p of this.players){if(!p.cells.length&&this.time>=p.respawnAt)this.spawn(p.id);const a=actions[p.id]||{};const[nx,ny]=norm(a.dx,a.dy);const [aimX,aimY]=(Number.isFinite(a.aimX)&&Number.isFinite(a.aimY))?norm(a.aimX,a.aimY):[nx,ny];if(a.split)this.split(p.id,aimX,aimY,a.aimAtX,a.aimAtY);if(a.eject)this.eject(p.id,aimX,aimY,a.aimAtX,a.aimAtY);const ctr=this.center(p.id);for(const c of p.cells){let dx=nx,dy=ny,throttle=clamp(finite(a.throttle,1),0,1);if(a.gather&&Number.isFinite(a.gatherAtX)&&Number.isFinite(a.gatherAtY)){[dx,dy]=norm(a.gatherAtX-c.x,a.gatherAtY-c.y);throttle=clamp(Math.hypot(a.gatherAtX-c.x,a.gatherAtY-c.y)/40,0,1);}else if(Number.isFinite(a.tx)&&Number.isFinite(a.ty)){[dx,dy]=norm(a.tx-c.x,a.ty-c.y);throttle*=clamp(Math.hypot(a.tx-c.x,a.ty-c.y)/50,0,1);}else if(a.gather){[dx,dy]=norm(ctr.x-c.x,ctr.y-c.y);throttle=clamp(Math.hypot(ctr.x-c.x,ctr.y-c.y)/40,0,1);}const speed=clamp(205*Math.pow(100/Math.max(c.mass,1),.17),65,280);c.x+=(dx*speed*throttle+c.vx)*dt;c.y+=(dy*speed*throttle+c.vy)*dt;c.vx*=Math.exp(-4*dt);c.vy*=Math.exp(-4*dt);constrainCell(c);}}
  for(const q of [...this.pellets,...this.thorns]){q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=Math.exp(-3.2*dt);q.vy*=Math.exp(-3.2*dt);const r=q.r||radius(q.mass);q.x=clamp(q.x,r,CFG.width-r);q.y=clamp(q.y,r,CFG.height-r);}
  if(this.mode==='storm'){this.food=this.food.filter(f=>!this.outside(f.x,f.y));this.pellets=this.pellets.filter(f=>!this.outside(f.x,f.y));this.thorns=this.thorns.filter(t=>!this.outside(t.x,t.y));for(const p of this.players){const before=p.cells.length;for(const c of p.cells)if(this.outside(c.x,c.y))c.mass=Math.max(0,c.mass-Math.max(2,c.mass*this.zone.damage)*dt);p.cells=p.cells.filter(c=>c.mass>0);if(before&&!p.cells.length)this.markDeath(p);}}
  this.resolveOwnCells();this.consume();for(const p of this.players)for(const c of p.cells)constrainCell(c);
  this.spawnClock+=dt;if(this.spawnClock>=.15){this.spawnClock=0;const foodBudget=this.mode==='storm'?Math.floor(this.options.foodCount*Math.min(1,Math.PI*this.zone.r*this.zone.r/(CFG.width*CFG.height))):this.options.foodCount;const missing=foodBudget-this.food.length;for(let i=0;i<Math.min(10,missing);i++){let pt;if(this.mode==='storm'){if(this.zone.r<30)break;const a=this.random()*Math.PI*2,r=Math.sqrt(this.random())*(this.zone.r-10);pt=[this.zone.x+Math.cos(a)*r,this.zone.y+Math.sin(a)*r];if(pt[0]<15||pt[0]>CFG.width-15||pt[1]<15||pt[1]>CFG.height-15)continue;}else pt=this.randomPoint(25);this.addFood(...pt);}}
  this.thornClock+=dt;if(this.thornClock>6){this.thornClock=0;if(this.thorns.length<this.options.thornCount){const pt=this.randomPoint(70);if((this.mode!=='storm'||!this.outside(...pt))&&this.players.every(p=>p.cells.every(c=>Math.hypot(c.x-pt[0],c.y-pt[1])>radius(c.mass)+100)))this.addThorn(...pt);}}
  if(this.time>=this.options.duration||(this.mode==='storm'&&this.time>3&&this.players.filter(p=>p.cells.length).length<=1))this.finish();
 }
 finish(){this.finished=true;const ranking=this.players.map(p=>({id:p.id,mass:this.mass(p.id),alive:p.cells.length>0,kills:p.kills})).sort((a,b)=>b.mass-a.mass);const teamMass=[0,0];for(const p of this.players)teamMass[p.team]+=this.mass(p.id);this.result={ranking,teamMass,winner:ranking[0].mass>0?ranking[0].id:null,teamWinner:teamMass[0]===teamMass[1]?null:(teamMass[0]>teamMass[1]?0:1)};this.emit('finish',this.result);}
 snapshot(){return JSON.parse(JSON.stringify({time:this.time,tick:this.tick,players:this.players,food:this.food,pellets:this.pellets,thorns:this.thorns,zone:this.zone,finished:this.finished,result:this.result}));}
 observation(id){return{tick:this.tick,time:this.time,mode:this.mode,playerId:id,team:this.players[id].team,map:{width:CFG.width,height:CFG.height},players:this.players.map(p=>({id:p.id,team:p.team,cells:p.cells.map(c=>({...c,r:radius(c.mass)}))})),food:this.food.map(f=>({...f})),pellets:this.pellets.map(f=>({...f})),thorns:this.thorns.map(t=>({...t})),zone:this.mode==='storm'?JSON.parse(JSON.stringify(this.zone)):null,rules:{...CFG}};}
}
return{World,CFG,BRANDS,radius,norm,rng,clamp,cellBounds,reachableTarget,constrainCell,cellAim};
});
