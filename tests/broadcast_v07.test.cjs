const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const read=f=>fs.readFileSync(f,'utf8');
test('camera director calculates a shot that contains all separated surviving cells',()=>{
 const D=require('../src/director.js');
 const cells=[{x:200,y:300,mass:100},{x:1700,y:1220,mass:900}];
 const shot=D.shotForCells(cells,{width:1400,height:900,mapWidth:2600,mapHeight:1800});
 assert(shot.zoom>0&&shot.zoom<=1.45);
 for(const c of cells){const x=(c.x-shot.x)*shot.zoom+700,y=(c.y-shot.y)*shot.zoom+450;
  assert(x>0&&x<1400&&y>0&&y<900,JSON.stringify({shot,c,x,y}));}
});
test('camera director zooms into fewer closer players without overshooting map',()=>{
 const D=require('../src/director.js');
 const a=D.shotForCells([{x:130,y:600,mass:240},{x:2420,y:1100,mass:240}],{width:1400,height:900,mapWidth:2600,mapHeight:1800});
 const b=D.shotForCells([{x:980,y:850,mass:240},{x:1100,y:910,mass:240}],{width:1400,height:900,mapWidth:2600,mapHeight:1800});
 assert(b.zoom>a.zoom*1.6,JSON.stringify({a,b}));
 assert(b.x>=0&&b.x<=2600&&b.y>=0&&b.y<=1800);
});
test('live scoreboard puts alive heavy players above alive light players and dead ones last',()=>{
 const D=require('../src/director.js');
 const players=[{id:0,active:true,cells:[{}],mass:50},{id:1,active:true,cells:[],mass:500},{id:2,active:true,cells:[{}],mass:800},{id:3,active:false,cells:[{}],mass:900},{id:4,active:true,cells:[],mass:1}];
 assert.deepEqual(D.sortDisplayPlayers(players).map(x=>x.id),[2,0,1,4]);
});
test('broadcast markup has only game video HUD and a setup-only modal',()=>{
 const html=read('src/index.html'),css=read('src/style.css'),app=read('src/app.js');
 assert.match(html,/id="victoryBanner"/);
 assert.match(html,/id="setupMode"/);
 assert.match(html,/选手列表/);
 assert.match(html,/id="broadcastMapSlot"/);
 assert.match(css,/\.topbar\s*\{\s*display:\s*none/);
 assert.match(app,/ArenaDirector\.shotForCells/);
 assert.doesNotMatch(app,/fillText\('0, 0'/);
 assert.match(app,/mc\.drawImage\(icon/);
});
