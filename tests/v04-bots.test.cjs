const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../src/engine.js'),B=require('../src/bots.js');
function fixture(mode='solo'){const w=new A.World({mode,foodCount:0,thornCount:0,respawn:false,activeIds:[0]});w.time=5;for(const p of w.players)p.cells=[];const c=w.makeCell(0,1000,800,400);w.players[0].cells=[c];return{w,c};}
test('shared test bot seeks a safe thorn rather than treating it as damage',()=>{const{w,c}=fixture();w.addThorn(800,800);const a=B.act(w,0);assert(a.dx<0,JSON.stringify(a));for(let i=0;i<240&&w.thorns.length;i++)w.step(1/60,{0:B.act(w,0)});assert.equal(w.thorns.length,0);assert(w.mass(0)>=480);});
test('bot avoids a thorn when enemy can eat the resulting fragments',()=>{const{w,c}=fixture();w.addThorn(920,800);w.players[1].cells=[w.makeCell(1,780,800,180)];const a=B.act(w,0);assert(a.dx>0,JSON.stringify(a));});
test('ordinary bot considers ground pellets as collectible mass',()=>{const{w}=fixture();w.addPellet(800,800,10,1);const a=B.act(w,0);assert(a.dx<0,JSON.stringify(a));});
test('safe team bot may eject toward a smaller ally',()=>{const{w,c}=fixture('team');w.players[1].team=w.players[0].team;w.players[1].cells=[w.makeCell(1,1180,800,100)];const a=B.act(w,0);assert.equal(a.eject,true);assert.equal(a.aimAtX,1180);assert.equal(a.aimAtY,800);});
test('same bot never feeds an enemy as if it were an ally',()=>{const{w}=fixture('team');w.players[1].team=1-w.players[0].team;w.players[1].cells=[w.makeCell(1,1180,800,100)];assert(!B.act(w,0).eject);});
