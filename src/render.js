/* Presentation only: fixed-timestep interpolation. Never writes to the world. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ArenaRender=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const lerp=(a,b,t)=>a+(b-a)*t;
class Timeline{
 constructor(){this.previous=new Map();this.cache=new Map();this.alpha=1;this.previousZone=null;this.visuals=new Map();this.frameDt=0;this.frames=0;}
 capture(world){
  this.previous.clear();
  for(const p of world.players)for(const c of p.cells)this.save(c);
  for(const o of world.pellets)this.save(o);
  for(const o of world.thorns)this.save(o);
  this.previousZone={x:world.zone.x,y:world.zone.y,r:world.zone.r};
 }
 save(o){this.previous.set(o.id,{x:o.x,y:o.y,mass:o.mass});}
 reset(world){this.visuals.clear();this.capture(world);this.begin(world,1);}
 begin(world,alpha,frameDt=0){this.alpha=Math.max(0,Math.min(1,Number.isFinite(alpha)?alpha:1));this.frameDt=Math.max(0,Math.min(.1,Number(frameDt)||0));this.cache.clear();this.world=world;
  if(++this.frames%120===0&&this.visuals.size){const ids=new Set();for(const p of world.players)for(const c of p.cells)ids.add(c.id);for(const q of [...world.pellets,...world.thorns])ids.add(q.id);for(const id of this.visuals.keys())if(!ids.has(id))this.visuals.delete(id);}
 }
 entity(o){
  if(this.cache.has(o.id))return this.cache.get(o.id);
  const prev=this.previous.get(o.id);let result=o;
  // Explicit tools/new entities snap; a teleport must not turn into an arena-wide sweep.
  if(prev&&Math.hypot(o.x-prev.x,o.y-prev.y)<200){
   result={...o,x:lerp(prev.x,o.x,this.alpha),y:lerp(prev.y,o.y,this.alpha)};
   if(Number.isFinite(prev.mass)&&Number.isFinite(o.mass))result.mass=lerp(prev.mass,o.mass,this.alpha);
  }
  // Cosmetic only: soften a rapid direction reversal at 60+ FPS without
  // changing the authoritative ball positions, hits, paths, or stored replays.
  if(this.frameDt>0){const old=this.visuals.get(o.id);
   if(old&&Math.hypot(result.x-old.x,result.y-old.y)<80){const k=1-Math.exp(-32*this.frameDt);result={...result,x:lerp(old.x,result.x,k),y:lerp(old.y,result.y,k)};}
   this.visuals.set(o.id,{x:result.x,y:result.y});
  }
  this.cache.set(o.id,result);return result;
 }
 cell(c){return this.entity(c);}
 center(world,id){let mass=0,x=0,y=0;for(const c of world.players[id].cells){const v=this.cell(c);mass+=v.mass;x+=v.x*v.mass;y+=v.y*v.mass;}return mass?{x:x/mass,y:y/mass}:world.center(id);}
 zone(z){const p=this.previousZone;if(!p||Math.hypot(z.x-p.x,z.y-p.y)>200||Math.abs(z.r-p.r)>200)return z;return{...z,x:lerp(p.x,z.x,this.alpha),y:lerp(p.y,z.y,this.alpha),r:lerp(p.r,z.r,this.alpha)};}
}
return{Timeline};
});
