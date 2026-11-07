// CPU-only, full-match stability checks; all participants use identical test policy.
global.Arena=require('../src/engine.js');require('../src/bots.js');
const assert=require('node:assert/strict');let report=[];
for(const mode of ['solo','team','storm']){
 const w=new Arena.World({mode,seed:19,foodCount:1050,thornCount:18});const begin=performance.now();let maxCells=0;
 for(let i=0;i<11000&&!w.finished;i++){
  const actions={};for(let id=0;id<6;id++)actions[id]=ArenaBots.act(w,id);w.step(1/60,actions);
  for(const p of w.players){assert(p.cells.length<=16);maxCells=Math.max(maxCells,p.cells.length);for(const c of p.cells)assert(Number.isFinite(c.x)&&Number.isFinite(c.y)&&Number.isFinite(c.mass)&&c.mass>0);}
 }
 assert(w.finished);report.push({mode,seconds:+w.time.toFixed(2),ticks:w.tick,maxCells,remaining:w.players.filter(p=>p.cells.length).length,elapsedMs:Math.round(performance.now()-begin)});
}
console.log(JSON.stringify(report,null,2));
