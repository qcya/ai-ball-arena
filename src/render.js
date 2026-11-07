/* Presentation only: fixed-timestep interpolation. Never writes to the world. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ArenaRender=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const lerp=(a,b,t)=>a+(b-a)*t;
class Timeline{
 constructor(){this.previous=new Map();this.cache=new Map();this.alpha=1;this.previousZone=null;}
 capture(world){
  this.previous.clear();
  for(const p of world.players)for(const c of p.cells)this.save(c);
  for(const o of world.pellets)this.save(o);
  for(const o of world.thorns)this.save(o);
  this.previousZone={x:world.zone.x,y:world.zone.y,r:world.zone.r};
 }
 save(o){this.previous.set(o.id,{x:o.x,y:o.y,mass:o.mass});}
 reset(world){this.capture(world);this.begin(world,1);}
 begin(world,alpha){this.alpha=Math.max(0,Math.min(1,Number.isFinite(alpha)?alpha:1));this.cache.clear();this.world=world;}
 entity(o){
  if(this.cache.has(o.id))return this.cache.get(o.id);
  const prev=this.previous.get(o.id);let result=o;
  // Explicit tools/new entities snap; a teleport must not turn into an arena-wide sweep.
  if(prev&&Math.hypot(o.x-prev.x,o.y-prev.y)<200){
   result={...o,x:lerp(prev.x,o.x,this.alpha),y:lerp(prev.y,o.y,this.alpha)};
   if(Number.isFinite(prev.mass)&&Number.isFinite(o.mass))result.mass=lerp(prev.mass,o.mass,this.alpha);
  }
  this.cache.set(o.id,result);return result;
 }
 cell(c){return this.entity(c);}
 center(world,id){let mass=0,x=0,y=0;for(const c of world.players[id].cells){const v=this.cell(c);mass+=v.mass;x+=v.x*v.mass;y+=v.y*v.mass;}return mass?{x:x/mass,y:y/mass}:world.center(id);}
 zone(z){const p=this.previousZone;if(!p||Math.hypot(z.x-p.x,z.y-p.y)>200||Math.abs(z.r-p.r)>200)return z;return{...z,x:lerp(p.x,z.x,this.alpha),y:lerp(p.y,z.y,this.alpha),r:lerp(p.r,z.r,this.alpha)};}
}
return{Timeline};
});
