'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const D=require('../src/director.js');
const ORDER=[2,0,5,4,3,1];
const mk=(id,mass,alive,active=true)=>({id,mass,active,cells:alive?[{id:10+id,mass}]:[]});
test('broadcast order is fixed even when weight and survival change',()=>{
 const players=[mk(0,999,true),mk(1,22,true),mk(2,0,false),mk(3,500,true),mk(4,880,true),mk(5,8,false)];
 assert.deepEqual(D.fixedBroadcastPlayers(players).map(x=>x.id),ORDER);
 assert.deepEqual(D.fixedBroadcastPlayers([mk(0,20,true),mk(2,500,true),mk(4,0,false)]).map(x=>x.id),[2,0,4]);
});
test('recording HUD only displays match and timer; mini-map has no caption',()=>{
 const html=read('src/index.html');
 assert.match(html,/<strong id="broadcastMode">个人赛<\/strong>/);
 assert.match(html,/<b id="broadcastTime">03:00<\/b>/);
 assert.doesNotMatch(html,/AI BALL ARENA <i class="on-air-dot"/);
 assert.doesNotMatch(html,/id="broadcastObjective"/);
 assert.doesNotMatch(html,/id="broadcastAlive"/);
 assert.doesNotMatch(html,/class="broadcast-map-heading"/);
 assert.doesNotMatch(html,/存活优先 · 按当前质量排序/);
 assert.match(html,/<canvas id="mini" width="1040" height="720"><\/canvas>/);
});
test('broadcast UI selects fixed order instead of dynamic rank',()=>{
 const app=read('src/app.js');
 assert.match(app,/ArenaDirector\.fixedBroadcastPlayers\(active\)/);
 assert.doesNotMatch(app,/ArenaDirector\.sortDisplayPlayers\(active\)/);
});
