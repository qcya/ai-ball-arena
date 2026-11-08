/* Pure camera and live-scoreboard helpers. Never changes the game simulation. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ArenaDirector=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function sortDisplayPlayers(players){
  return players.filter(p=>p.active).slice().sort((a,b)=>{
   const liveA=+(a.cells.length>0),liveB=+(b.cells.length>0);
   return liveB-liveA || b.mass-a.mass || a.id-b.id;
  });
 }
 const BROADCAST_ORDER=Object.freeze([2,0,5,4,3,1]); // Claude, GPT, Gemini, 豆包, Grok, DeepSeek
 function fixedBroadcastPlayers(players){
  const byId=new Map(players.filter(p=>p.active).map(p=>[p.id,p]));
  return BROADCAST_ORDER.map(id=>byId.get(id)).filter(Boolean);
 }
 function shotForCells(cells,{width,height,mapWidth=2600,mapHeight=1800,zoom=1}={}){
  width=Math.max(1,width||1400);height=Math.max(1,height||900);
  if(!cells.length){return {x:mapWidth/2,y:mapHeight/2,zoom:Math.min(width/mapWidth,height/mapHeight)*.96*zoom};}
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
  for(const c of cells){if(!Number.isFinite(c.x)||!Number.isFinite(c.y)||!Number.isFinite(c.mass))continue;
   const r=3*Math.sqrt(Math.max(1,c.mass));left=Math.min(left,c.x-r);right=Math.max(right,c.x+r);top=Math.min(top,c.y-r);bottom=Math.max(bottom,c.y+r);
  }
  if(!Number.isFinite(left))return {x:mapWidth/2,y:mapHeight/2,zoom:Math.min(width/mapWidth,height/mapHeight)*.96};
  const marginWorld=135,padX=Math.max(50,width*.08),padY=Math.max(60,height*.11);
  const widthFor=Math.max(220,right-left+2*marginWorld),heightFor=Math.max(220,bottom-top+2*marginWorld);
  const minimumFullMapZoom=Math.min(width/mapWidth,height/mapHeight)*.985*zoom;
  const targetZoom=clamp(Math.max(minimumFullMapZoom,Math.min((width-2*padX)/widthFor,(height-2*padY)/heightFor)*zoom),.16,1.45);
  const halfW=width/(2*targetZoom),halfH=height/(2*targetZoom);
  const midX=(left+right)/2,midY=(top+bottom)/2;
  return {x:halfW<mapWidth/2?clamp(midX,halfW,mapWidth-halfW):mapWidth/2,
          y:halfH<mapHeight/2?clamp(midY,halfH,mapHeight-halfH):mapHeight/2,zoom:targetZoom};
 }
 return{sortDisplayPlayers,fixedBroadcastPlayers,shotForCells,BROADCAST_ORDER};
});
