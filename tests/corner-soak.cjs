// Regression: each differently sized circle leaves an unreachable food-filled corner.
const A=require('../src/engine.js'),B=require('../src/bots.js'),assert=require('node:assert/strict');
const report=[];
for(const mass of [240,2500,12000])for(const [sx,sy]of[[1,1],[-1,1],[1,-1],[-1,-1]]){
 const w=new A.World({mode:'solo',seed:19,foodCount:0,thornCount:0,respawn:false});for(const p of w.players)p.cells=[];
 const r=A.radius(mass),x=sx>0?r:A.CFG.width-r,y=sy>0?r:A.CFG.height-r;
 const c=w.makeCell(0,x,y,mass);w.players[0].cells=[c];
 for(let i=0;i<8;i++)w.addFood(sx>0?2+i:A.CFG.width-2-i,sy>0?2+i:A.CFG.height-2-i);
 for(let i=0;i<600;i++)w.step(1/60,{0:B.act(w,0)});
 const travelled=Math.hypot(c.x-x,c.y-y);assert(travelled>250,JSON.stringify({mass,sx,sy,travelled}));
 const limits=A.cellBounds(c);assert(c.x>=limits.minX&&c.x<=limits.maxX&&c.y>=limits.minY&&c.y<=limits.maxY);
 report.push({mass,corner:[sx,sy],distance:Math.round(travelled)});
}
console.log(JSON.stringify({cases:report.length,passed:true,results:report},null,2));
