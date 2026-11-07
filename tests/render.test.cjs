const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const A=require('../src/engine.js');
function moduleUnderTest(){assert(fs.existsSync('src/render.js'),'renderer interpolation module must exist');return require('../src/render.js');}
function world(){const w=new A.World({foodCount:0,thornCount:0,respawn:false});for(const p of w.players)p.cells=[];w.players[0].cells=[w.makeCell(0,700,800,240)];return w;}
for(const hz of [60,120,144,165,240,260])test(`continuous motion at ${hz}Hz without stair-step holds`,()=>{
 const {Timeline}=moduleUnderTest(),w=world(),t=new Timeline();t.reset(w);let acc=0,last=null,deltas=[],raw=[],rawLast=null;
 for(let f=0;f<hz*2;f++){
  acc+=1/hz;while(acc+1e-12>=1/60){t.capture(w);w.step(1/60,{0:{dx:1}});acc-=1/60;}
  t.begin(w,Math.max(0,acc*60));const x=t.cell(w.players[0].cells[0]).x,rx=w.players[0].cells[0].x;
  if(f>hz/2){deltas.push(x-last);raw.push(rx-rawLast);}last=x;rawLast=rx;
 }
 const lo=Math.min(...deltas),hi=Math.max(...deltas);assert(lo>0,`stale rendering at ${hz}`);assert(hi-lo<1e-6,`jitter ${hi-lo}`);
 if(hz>60)assert(raw.includes(0),'baseline really contains duplicate physics positions');
});
test('rendering never mutates authoritative simulation',()=>{const {Timeline}=moduleUnderTest(),w=world(),t=new Timeline();t.capture(w);w.step(1/60,{0:{dx:1}});const before=w.snapshot();for(let i=0;i<20;i++){t.begin(w,i/20);t.cell(w.players[0].cells[0]);t.center(w,0);}assert.deepEqual(w.snapshot(),before);});
test('all objects use the same interpolation fraction',()=>{const {Timeline}=moduleUnderTest(),w=world(),t=new Timeline();const c=w.players[0].cells[0],p=w.addPellet(500,500),v=w.addThorn(600,600);t.capture(w);for(const o of[c,p,v])o.x+=20;t.begin(w,.25);assert.equal(t.cell(c).x,705);assert.equal(t.entity(p).x,505);assert.equal(t.entity(v).x,605);assert.equal(t.center(w,0).x,705);});
test('pause and reset show current positions without reverse interpolation',()=>{const {Timeline}=moduleUnderTest(),w=world(),t=new Timeline();t.capture(w);w.step(.1,{0:{dx:1}});t.reset(w);t.begin(w,0);assert.equal(t.cell(w.players[0].cells[0]).x,w.players[0].cells[0].x);});
test('teleported and newly spawned cells never sweep across the arena',()=>{const {Timeline}=moduleUnderTest(),w=world(),t=new Timeline();t.capture(w);const c=w.players[0].cells[0];c.x+=700;const d=w.makeCell(0,500,500,80);t.begin(w,.2);assert.equal(t.cell(c).x,c.x);assert.equal(t.cell(d).x,d.x);});
