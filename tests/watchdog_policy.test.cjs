const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const API=require('../src/agent-api.js');
test('script soft budget is 100ms while transient host delays get separate hard watchdog',()=>{assert.equal(API.LIMITS.actionMs,100);assert.ok(API.LIMITS.hardActionMs>=500);assert.ok(API.LIMITS.hardActionMs>API.LIMITS.actionMs);});
test('renderer exposes uniform adaptive simulation pacing, without touching world.step API',()=>{const code=fs.readFileSync('src/app.js','utf8');assert.match(code,/pool\.latencyMs/);assert.match(code,/state\.simulationRate/);});
