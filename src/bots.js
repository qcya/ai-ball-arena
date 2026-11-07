/* Ordinary, shared playtest opponents. No model submissions, no privileged edits. */
(function(root){'use strict';
const A=typeof module==='object'&&module.exports?require('./engine.js'):root.Arena;
const sessions=new WeakMap();
function memory(w,id,c){let all=sessions.get(w);if(!all){all=new Map();sessions.set(w,all);}let m=all.get(id);if(!m||w.time<m.checked){m={x:c.x,y:c.y,checked:w.time,target:null,blocked:new Map(),escapeUntil:0};all.set(id,m);}for(const[k,until]of m.blocked)if(until<=w.time)m.blocked.delete(k);return m;}
function act(w,id){
 const p=w.players[id];if(!p?.cells.length)return{};
 const a=p.cells.reduce((a,b)=>a.mass>b.mass?a:b),c=w.center(id),r=A.radius(a.mass),bounds=A.cellBounds(a,1),m=memory(w,id,c);
 if(w.time-m.checked>=1.3){if(Math.hypot(c.x-m.x,c.y-m.y)<9){if(m.target!==null)m.blocked.set(m.target,w.time+5);m.escapeUntil=w.time+1.1;}m.x=c.x;m.y=c.y;m.checked=w.time;}
 let tx=A.CFG.width/2,ty=A.CFG.height/2,target=null,prey=null,threat=null;
 for(const q of w.players){if(!w.isEnemy(id,q.id))continue;for(const b of q.cells){const d=Math.hypot(b.x-a.x,b.y-a.y);if(b.mass>a.mass*1.15&&d<420&&(!threat||d<threat.d))threat={b,d};if(a.mass>b.mass*1.4&&d<480&&A.reachableTarget(a,b,'enemy')&&(!prey||d<prey.d))prey={b,d};}}
 const zoneUrgent=w.mode==='storm'&&Math.hypot(c.x-w.zone.x,c.y-w.zone.y)>w.zone.r-Math.max(90,r*.6);
 if(zoneUrgent){tx=w.zone.x;ty=w.zone.y;}
 else if(m.escapeUntil>w.time){tx=A.CFG.width/2;ty=A.CFG.height/2;}
 else if(threat){const[nx,ny]=A.norm(a.x-threat.b.x,a.y-threat.b.y);tx=a.x+nx*600;ty=a.y+ny*600;}
 else if(prey){const goal=A.reachableTarget(a,prey.b,'enemy');tx=goal.x;ty=goal.y;target=prey.b.id;}
 else{
  let best=Infinity;
  for(const f of w.food){if(m.blocked.has(f.id))continue;const d2=(f.x-a.x)**2+(f.y-a.y)**2;if(d2>=best*best)continue;
   const goal=A.reachableTarget(a,f);if(!goal)continue;
   let cost=Math.sqrt(d2);
   if(a.mass>=A.CFG.thornMin){const safe2=(r+50)**2;for(const t of w.thorns)if((goal.x-t.x)**2+(goal.y-t.y)**2<safe2){cost+=500;break;}}
   if(cost<best){best=cost;tx=goal.x;ty=goal.y;target=f.id;}
  }
 }
 tx=A.clamp(tx,bounds.minX,bounds.maxX);ty=A.clamp(ty,bounds.minY,bounds.maxY);m.target=target;
 let [dx,dy]=A.norm(tx-a.x,ty-a.y);
 for(const t of w.thorns){const d=Math.hypot(a.x-t.x,a.y-t.y),danger=r+t.r+50;if(a.mass>=A.CFG.thornMin&&d<danger&&d>0){dx+=(a.x-t.x)/d*(1-d/danger)*3;dy+=(a.y-t.y)/d*(1-d/danger)*3;}}
 // Cancel outward motion at the actual circle boundary, not at a fixed 100px line.
 if(a.x<=bounds.minX+2&&dx<0)dx=0;if(a.x>=bounds.maxX-2&&dx>0)dx=0;
 if(a.y<=bounds.minY+2&&dy<0)dy=0;if(a.y>=bounds.maxY-2&&dy>0)dy=0;
 if(Math.hypot(dx,dy)<.02)[dx,dy]=A.norm(A.CFG.width/2-a.x,A.CFG.height/2-a.y);
 const [nx,ny]=A.norm(dx,dy);
 let split=false;if(prey&&!threat&&m.escapeUntil<=w.time&&p.cells.length<=2&&a.mass/2>prey.b.mass*1.3&&prey.d<210&&prey.d>80)split=true;
 const[aimX,aimY]=prey?A.norm(prey.b.x-a.x,prey.b.y-a.y):[nx,ny];
 return{dx:nx,dy:ny,aimX,aimY,split,throttle:1,gather:false};
}
root.ArenaBots={act};if(typeof module==='object'&&module.exports)module.exports=root.ArenaBots;
})(typeof globalThis!=='undefined'?globalThis:this);
