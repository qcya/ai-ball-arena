/* Public contract. Pure functions shared by browser, worker and Node tests. */
(function(root,factory){const api=factory();api.factorySource=factory.toString();if(typeof module==='object'&&module.exports)module.exports=api;else root.ArenaAgentAPI=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='1.0',ENGINE='0.6.0',MODES=['solo','team','storm'];
const LIMITS={sourceBytes:262144,memoryBytes:65536,actionMs:100,hardActionMs:1000,loadMs:2000,decisionTicks:3};
function validateModule(m){
 if(!m||m.apiVersion!==VERSION)throw Error('apiVersion 必须为 "1.0"');
 if(!MODES.includes(m.mode))throw Error('mode 必须是 solo / team / storm');
 if(typeof m.name!=='string'||!m.name.trim()||m.name.length>80)throw Error('name 必须是 1–80 字的脚本名称');
 if(typeof m.act!=='function')throw Error('必须导出 act(observation, memory) 函数');
 return{apiVersion:VERSION,mode:m.mode,name:m.name};
}
function validateAction(action){
 if(!action||typeof action!=='object'||Array.isArray(action))throw Error('action 必须是对象');
 const numeric=['dx','dy','throttle','aimX','aimY','aimAtX','aimAtY','gatherAtX','gatherAtY','tx','ty'],flags=['split','eject','gather'];
 const out={};for(const key of Object.keys(action)){
  const value=action[key];if(numeric.includes(key)){if(!Number.isFinite(value)||Math.abs(value)>1e7)throw Error('动作数字无效: '+key);out[key]=value;}
  else if(flags.includes(key)){if(typeof value!=='boolean')throw Error(key+' 必须是布尔值');out[key]=value;}
  else throw Error('未知动作字段: '+key);
 }
 for(const prefix of ['aimAt','gatherAt'])if((out[prefix+'X']!==undefined)!==(out[prefix+'Y']!==undefined))throw Error(prefix+'X/Y 必须成对提供');
 if((out.tx!==undefined)!==(out.ty!==undefined))throw Error('tx/ty 必须成对提供');
 if(out.throttle!==undefined)out.throttle=Math.max(0,Math.min(1,out.throttle));return out;
}
function validateResult(result){
 if(!result||typeof result!=='object'||typeof result.then==='function')throw Error('act 必须同步返回 {action,memory}');
 const action=validateAction(result.action);
 const value=result.memory===undefined?{}:result.memory;
 const text=JSON.stringify(value,(k,v)=>{if(typeof v==='function'||typeof v==='symbol'||typeof v==='bigint'||(typeof v==='number'&&!Number.isFinite(v)))throw Error('memory 必须是有限数字组成的 JSON 数据');return v;});
 if(text===undefined||new TextEncoder().encode(text).length>LIMITS.memoryBytes)throw Error('memory 超过 64 KiB 或不是 JSON 数据');
 return{action,memory:JSON.parse(text)};
}
function createSDK(seed=1){
 let s=seed>>>0;const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),radius=m=>3*Math.sqrt(Math.max(0,m));
 const norm=(x,y)=>{const d=Math.hypot(x,y);return d>1e-8?[x/d,y/d]:[0,0];};
 const random=()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
 // Optional helper: original API 1.0 methods and action fields remain unchanged.
 function moveSpeed(mass,rules={}){
  if(!Number.isFinite(mass)||mass<=0)return 0;
  const reference=Number.isFinite(rules.startMass)&&rules.startMass>0?rules.startMass:240;
  const base=Number.isFinite(rules.baseMoveSpeed)&&rules.baseMoveSpeed>0?rules.baseMoveSpeed:176.65175237370477;
  const factor=Number.isFinite(rules.speedMassDoublingFactor)&&rules.speedMassDoublingFactor>0&&rules.speedMassDoublingFactor<1?rules.speedMassDoublingFactor:.9;
  return base*Math.pow(Math.max(1,mass/reference),Math.log2(factor));
 }
 function cellBounds(c,map={width:2600,height:1800}){const r=radius(c.mass),x=Math.min(map.width/2,r+.5),y=Math.min(map.height/2,r+.5);return{minX:x,maxX:map.width-x,minY:y,maxY:map.height-y};}
 function reachableTarget(c,t,kind='food',map){if(!c||!t||!Number.isFinite(t.x)||!Number.isFinite(t.y)||c.mass<=t.mass)return null;const b=cellBounds(c,map),x=clamp(t.x,b.minX,b.maxX),y=clamp(t.y,b.minY,b.maxY),reach=radius(c.mass)-(kind==='enemy'?.35:kind==='pellet'?.25:0)*radius(t.mass);if(reach<=0||Math.hypot(x-t.x,y-t.y)>=reach-.1)return null;return{x,y,reach};}
 return Object.freeze({clamp,radius,moveSpeed,norm,random,cellBounds,reachableTarget});
}
function observation(world,id){const o=world.observation(id);o.apiVersion=VERSION;o.engineVersion=ENGINE;o.actionInterval=LIMITS.decisionTicks/60;o.actionDelay=o.actionInterval;o.self=o.players[id];o.remaining=Math.max(0,world.options.duration-world.time);return o;}
return{VERSION,ENGINE,MODES,LIMITS,validateAction,validateModule,validateResult,createSDK,observation};
});
