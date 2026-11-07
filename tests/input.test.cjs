const test=require('node:test'),assert=require('node:assert/strict');
let Input;try{Input=require('../src/input.js');}catch{}
test('input module exists',()=>assert.equal(typeof Input?.Controller,'function'));
function setup(){assert(Input?.Controller);return new Input.Controller();}
const center={x:500,y:500};
test('WASD is independent from aim and diagonal speed is normalized',()=>{const i=setup();i.key('KeyW',true);i.key('KeyD',true);i.pointerMove(800,500,100);const a=i.sample(center,200);assert(a.dx>0&&a.dy<0);assert(Math.abs(Math.hypot(a.dx,a.dy)-1)<1e-8);assert.equal(a.aimY,0);assert(a.aimX>0);});
test('mouse alone never moves desktop player',()=>{const i=setup();i.pointerMove(800,500,100);const a=i.sample(center,200);assert.equal(a.dx,0);assert.equal(a.dy,0);assert(a.aimX>0);});
test('stationary mouse falls back to keyboard after 800ms',()=>{const i=setup();i.key('KeyA',true);i.pointerMove(800,500,100);assert(i.sample(center,899).aimX>0);assert(i.sample(center,901).aimX<0);});
test('leaving canvas falls back immediately and releases eject',()=>{const i=setup();i.key('KeyW',true);i.pointerMove(800,500,100);i.ejecting=true;i.pointerLeave();const a=i.sample(center,101);assert.equal(a.aimX,0);assert(a.aimY<0);assert.equal(a.eject,false);});
test('last keyboard facing persists when idle',()=>{const i=setup();i.key('KeyA',true);i.sample(center,0);i.key('KeyA',false);const a=i.sample(center,1000);assert.equal(a.dx,0);assert.equal(a.aimX,-1);});
test('all eight fallback directions exist, including cancelling opposite keys',()=>{for(const [keys,x,y]of[[['KeyW'],0,-1],[['KeyS'],0,1],[['KeyA'],-1,0],[['KeyD'],1,0],[['KeyW','KeyD'],1,-1],[['KeyW','KeyA'],-1,-1],[['KeyS','KeyD'],1,1],[['KeyS','KeyA'],-1,1]]){const i=setup();keys.forEach(k=>i.key(k,true));const a=i.sample(center,0);assert.equal(Math.sign(a.aimX),x);assert.equal(Math.sign(a.aimY),y);}const i=setup();i.key('KeyA',true);i.key('KeyD',true);assert.equal(i.sample(center,0).dx,0);});
test('reset clears held buttons and queued splits',()=>{const i=setup();i.key('KeyW',true);i.ejecting=true;i.queueSplit();i.clear();const a=i.sample(center,100);assert.equal(a.eject,false);assert.equal(a.split,false);assert.equal(a.dx,0);assert.equal(a.dy,0);});
test('split is one-shot and gathering moved away from S',()=>{const i=setup();i.key('KeyS',true);i.queueSplit();assert.equal(i.sample(center,0).gather,false);assert.equal(i.sample(center,0).split,false);i.key('Space',true);assert.equal(i.sample(center,0).gather,true);});
test('stationary duplicate pointer events do not reset mouse timer',()=>{const i=setup();i.key('KeyA',true);i.pointerMove(800,500,0);i.pointerMove(800,500,790);assert(i.sample(center,810).aimX<0);});
