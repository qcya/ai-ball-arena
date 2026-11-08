const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('watchdog error reports its actual configured hard deadline',()=>{
 const code=fs.readFileSync('src/agent-runner.js','utf8');
 assert.ok(!code.includes("'单次决策超过 100ms，已终止脚本'"));
 assert.match(code,/m\.budget/);
});
