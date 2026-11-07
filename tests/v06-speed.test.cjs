'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../src/engine.js'),API=require('../src/agent-api.js');
const INITIAL=240,V0=205*Math.pow(100/240,.17);
const near=(a,b,tol=1e-8)=>assert(Math.abs(a-b)<tol,`${a} != ${b}`);
function scene(mass=INITIAL){
 const w=new A.World({mode:'solo',activeIds:[0],foodCount:0,thornCount:0,seed:7});
 const c=w.players[0].cells[0];Object.assign(c,{x:600,y:600,mass,vx:0,vy:0,shieldUntil:0});return{w,c};
}
test('mass speed: public helper and unchanged initial pace',()=>{assert.equal(typeof A.moveSpeed,'function');near(A.CFG.baseMoveSpeed,V0);assert.equal(A.CFG.speedMassDoublingFactor,.9);near(A.moveSpeed(INITIAL),V0);});
test('mass speed: every positive sub-initial mass shares the same cap',()=>{for(const m of [.001,1,10,120,239.999,240])near(A.moveSpeed(m),V0);});
test('mass speed: each exact doubling multiplies the previous speed by 0.9',()=>{for(let n=0;n<20;n++)near(A.moveSpeed(INITIAL*2**n),V0*.9**n);});
test('mass speed: 1.1x and 1.5x use a continuous curve, never integer steps',()=>{near(A.moveSpeed(264)/V0,.9856169958682428);near(A.moveSpeed(360)/V0,.9402288736803797);assert(A.moveSpeed(240.001)<A.moveSpeed(240));assert(A.moveSpeed(479.999)>A.moveSpeed(480));near(A.moveSpeed(480-.000001),A.moveSpeed(480+.000001),.000001);});
test('mass speed: strictly decreases at huge mass, with no fixed floor',()=>{let previous=V0;for(let n=1;n<=100;n++){const v=A.moveSpeed(INITIAL*2**n);assert(v>0&&v<previous);previous=v;}assert(previous<.01);assert(A.moveSpeed(INITIAL*2**15)<65);});
test('mass speed: invalid and dead mass cannot make NaN movement',()=>{for(const m of [0,-1,NaN,Infinity,-Infinity,undefined])assert.equal(A.moveSpeed(m),0);});
test('mass speed: engine actually uses capped and scaled speed',()=>{for(const m of [120,240,264,480,960]){const{w,c}=scene(m);const x=c.x;w.step(1/60,{0:{dx:1,dy:0}});near((c.x-x)*60,V0*Math.pow(.9,Math.log2(Math.max(1,m/INITIAL))),1e-7);}});
test('mass speed: each fragment uses its own mass, not the total',()=>{const{w,c}=scene(240);const b=w.makeCell(0,600,1100,960);b.mergeAt=999;c.mergeAt=999;w.players[0].cells.push(b);w.step(1/60,{0:{dx:1,dy:0}});near((c.x-600)*60,V0,1e-7);near((b.x-600)*60,V0*.81,1e-7);});
test('mass speed: ejection accelerates on the very same movement step',()=>{const{w,c}=scene(480);w.step(1/60,{0:{dx:1,dy:0,eject:true,aimX:0,aimY:-1}});assert.equal(c.mass,470);near((c.x-600)*60,A.moveSpeed(470),1e-7);assert(A.moveSpeed(470)>A.moveSpeed(480));});
test('mass speed: splitting restores capped pace but keeps the separate burst impulse',()=>{const{w,c}=scene(480);w.step(1/60,{0:{dx:1,dy:0,split:true,aimX:0,aimY:1}});assert.equal(w.players[0].cells.length,2);for(const b of w.players[0].cells){assert.equal(b.mass,240);near((b.x-600)*60,V0,1e-7);}assert(w.players[0].cells.some(b=>Math.abs(b.vy)>0));});
test('mass speed: recovering ejected mass slows subsequent movement again',()=>{const{w,c}=scene(240);for(let i=0;i<24;i++)w.addPellet(c.x,c.y,10,1);w.consume();assert.equal(c.mass,480);const x=c.x;w.step(1/60,{0:{dx:1,dy:0}});near((c.x-x)*60,V0*.9,1e-7);});
test('mass speed: elapsed time, not display refresh, determines travel',()=>{for(const hz of [30,60,120,144,240]){const{w,c}=scene(480);for(let n=0;n<hz;n++)w.step(1/hz,{0:{dx:1,dy:0}});near(c.x-600,V0*.9,1e-6);}});
test('mass speed: equal diagonal speed and throttle reduction still work',()=>{const{w,c}=scene(480);w.step(1/60,{0:{dx:1,dy:1,throttle:.5}});near(Math.hypot(c.x-600,c.y-600)*60,V0*.9*.5,1e-7);});
test('mass speed: spanning the map height locks only that axis, not all movement',()=>{const{w,c}=scene(90000);Object.assign(c,{x:1300,y:900});w.step(1/60,{0:{dx:1,dy:1}});assert(c.x>1300);near(c.y,900);assert(A.moveSpeed(c.mass)>0);});
test('mass speed: SDK matches engine with observation.rules, preserving API 1.0',()=>{const{w}=scene();const sdk=API.createSDK(1),o=API.observation(w,0);assert.equal(o.apiVersion,'1.0');assert.equal(o.rules.baseMoveSpeed,A.CFG.baseMoveSpeed);assert.equal(o.rules.speedMassDoublingFactor,.9);assert.equal(typeof sdk.moveSpeed,'function');for(const m of [0,10,240,264,480,960,200000]){near(sdk.moveSpeed(m,o.rules),A.moveSpeed(m));near(sdk.moveSpeed(m),A.moveSpeed(m));}});
