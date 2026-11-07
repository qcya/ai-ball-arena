/* Input policy is pure and testable. Coordinates passed here use canvas CSS pixels. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ArenaInput=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const MOUSE_IDLE_MS=800;
const aliases={w:'KeyW',a:'KeyA',s:'KeyS',d:'KeyD',e:'KeyE',arrowup:'ArrowUp',arrowdown:'ArrowDown',arrowleft:'ArrowLeft',arrowright:'ArrowRight'};
function normalize(x,y){const d=Math.hypot(x,y);return d>1e-7?[x/d,y/d]:[0,0];}
class Controller{
 constructor(){this.keys=new Set();this.pointer={x:0,y:0,inside:false,lastMoved:-Infinity};this.lastFacing=[1,0];this.ejecting=false;this.splitQueued=false;this.touchVector=null;this.touchGather=false;}
 key(code,down){code=aliases[code.toLowerCase()]||code;down?this.keys.add(code):this.keys.delete(code);}
 pointerMove(x,y,now){if(!Number.isFinite(x)||!Number.isFinite(y))return;const p=this.pointer;if(!p.inside||Math.hypot(x-p.x,y-p.y)>=.5)p.lastMoved=now;p.x=x;p.y=y;p.inside=true;}
 pointerLeave(){this.pointer.inside=false;this.ejecting=false;this.touchVector=null;}
 queueSplit(){this.splitQueued=true;}
 clear(){this.keys.clear();this.ejecting=false;this.splitQueued=false;this.pointer.inside=false;this.pointer.lastMoved=-Infinity;this.touchVector=null;this.touchGather=false;}
 sample(center,now,consume=true){
  const has=(a,b)=>this.keys.has(a)||this.keys.has(b);
  let [dx,dy]=normalize(Number(has('KeyD','ArrowRight'))-Number(has('KeyA','ArrowLeft')),Number(has('KeyS','ArrowDown'))-Number(has('KeyW','ArrowUp')));
  if(this.touchVector)[dx,dy]=normalize(this.touchVector.x,this.touchVector.y);
  if(dx||dy)this.lastFacing=[dx,dy];
  let [aimX,aimY]=this.lastFacing,aimSource=(dx||dy)?'keys':'last';
  if(this.pointer.inside&&now-this.pointer.lastMoved<=MOUSE_IDLE_MS){const [mx,my]=normalize(this.pointer.x-center.x,this.pointer.y-center.y);if(mx||my){aimX=mx;aimY=my;}aimSource='mouse';}
  const a={dx,dy,aimX,aimY,throttle:1,split:this.splitQueued,eject:this.ejecting,gather:this.keys.has('Space')||this.touchGather,aimSource};
  // Positional aims are in canvas CSS pixels here; the app converts them to world coordinates.
  if(aimSource==='mouse'){a.aimAtX=this.pointer.x;a.aimAtY=this.pointer.y;}
  if(a.gather){a.gatherAtX=this.pointer.inside?this.pointer.x:center.x+this.lastFacing[0]*120;a.gatherAtY=this.pointer.inside?this.pointer.y:center.y+this.lastFacing[1]*120;}
  if(consume)this.splitQueued=false;
  return a;
 }
}
return{Controller,MOUSE_IDLE_MS};
});
