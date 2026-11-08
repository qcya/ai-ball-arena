const test=require('node:test'),assert=require('node:assert/strict'),A=require('../src/engine.js'),R=require('../src/render.js');
test('optional display smoothing does not alter world positions, only the screen',()=>{
 const w=new A.World({seed:3,activeIds:[0],foodCount:0,thornCount:0});const c=w.players[0].cells[0],t=new R.Timeline();t.reset(w);t.begin(w,1,1/60);t.cell(c);const before=c.x;
 t.capture(w);c.x+=12;t.begin(w,1,1/60);const v=t.cell(c);assert.ok(v.x>before&&v.x<c.x);assert.equal(w.players[0].cells[0].x,c.x);
 t.begin(w,1,1/60);assert.ok(t.cell(c).x>v.x);
});
test('large teleport snaps immediately, does not smear across arena',()=>{const w=new A.World({seed:2,activeIds:[0],foodCount:0,thornCount:0});const c=w.players[0].cells[0],t=new R.Timeline();t.reset(w);t.begin(w,1,1/60);t.cell(c);t.capture(w);c.x+=400;t.begin(w,1,1/60);assert.equal(t.cell(c).x,c.x);});
