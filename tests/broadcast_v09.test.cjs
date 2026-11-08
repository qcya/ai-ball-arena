'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const director=require('../src/director.js');
const app=()=>fs.readFileSync('src/app.js','utf8');
const css=()=>fs.readFileSync('src/style.css','utf8');
test('six fixed broadcast positions have explicit full model stage labels',()=>{
 const expected=[
   [2,'Claude Opus 5.5'],
   [0,'GPT-6 Astra'],
   [5,'Gemini 4 Argon'],
   [4,'Doubao Seed 2.0 Code'],
   [3,'Grok 4.7'],
   [1,'DeepSeek V4.1 Flash 1017']
 ];
 assert.deepEqual(director.BROADCAST_ORDER,expected.map(x=>x[0]));
 for(const [id,label] of expected) assert.equal(director.broadcastName(id),label);
});
test('broadcast list has no rank number and uses full stage label',()=>{
 const source=app();
 assert.doesNotMatch(source,/class=\\"broadcast-rank\\"/);
 assert.doesNotMatch(source,/row\.querySelector\(['\"]\.broadcast-rank['\"]\)/);
 assert.match(source,/broadcastName\(p\.id\)/);
});
test('stage-label typography can wrap long names without clipping',()=>{
 const style=css();
 assert.match(style,/#broadcastPanel \.broadcast-entry-name\{[^}]*white-space:normal;/);
 assert.match(style,/#broadcastPanel \.broadcast-entry-name\{[^}]*overflow-wrap:anywhere;/);
});
test('game engine short names unchanged in main arena',()=>{
 const {BRANDS}=require('../src/engine.js');
 assert.deepEqual(BRANDS.map(b=>b.name),['GPT','DeepSeek','Claude','Grok','豆包','Gemini']);
});
