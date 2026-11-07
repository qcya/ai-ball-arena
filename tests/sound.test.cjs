const test=require('node:test'),assert=require('node:assert/strict');
let S;try{S=require('../src/sound.js');}catch{}
test('sound API exists without needing browser audio',()=>assert.equal(typeof S?.makeClip,'function'));
test('all required effects contain finite non-silent click-free PCM',()=>{assert(S);for(const type of ['pelletEat','eat','eject','split','burst','merge','death']){const b=S.makeClip(type,22050);assert(b instanceof Float32Array);assert(b.length>1000&&b.length<14000);let energy=0,peak=0;for(const x of b){assert(Number.isFinite(x));energy+=x*x;peak=Math.max(peak,Math.abs(x));}assert(energy>1);assert(peak<=.81);assert(Math.abs(b[0])<.001);assert(Math.abs(b[b.length-1])<.001);}});
test('effects are deterministic and differ from one another',()=>{assert(S);assert.deepEqual(S.makeClip('burst',8000),S.makeClip('burst',8000));assert.notDeepEqual(S.makeClip('split',8000),S.makeClip('eat',8000));});
test('invalid sound or sample rate is rejected',()=>{assert(S);assert.throws(()=>S.makeClip('unknown'));assert.throws(()=>S.makeClip('eject',0));});
test('silent unsupported browser degrades without a thrown error',async()=>{assert(S);const b=new S.SoundBank();assert.equal(b.play('split'),false);assert.equal(await b.unlock(),false);b.setVolume(99);assert.equal(b.volume,1);b.setVolume(-1);assert.equal(b.volume,0);b.setEnabled(false);assert.equal(b.enabled,false);});
