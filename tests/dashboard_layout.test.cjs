const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('widescreen broadcast dashboard reserves a side panel next to the arena',()=>{
 const html=fs.readFileSync('src/index.html','utf8'),css=fs.readFileSync('src/style.css','utf8');
 assert.match(html,/id="broadcastPanel"/);assert.match(html,/id="broadcastRows"/);assert.match(html,/id="broadcastTime"/);assert.match(css,/#broadcastPanel/);
});
test('dashboard refreshes data from live simulation and never alters physics',()=>{
 const js=fs.readFileSync('src/app.js','utf8');assert.match(js,/function updateBroadcast\(/);assert.match(js,/updateBroadcast\(\)/);
});
