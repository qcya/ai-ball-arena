#!/usr/bin/env node
/* Contract smoke test for trusted local submissions. Node vm is NOT a security boundary. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm');
const A=require('../src/engine.js'),API=require('../src/agent-api.js');
const files=process.argv.slice(2);if(!files.length){console.error('Usage: node tools/check-agent.cjs solo.js team.js storm.js');process.exit(2);}
let failures=0;const modes=new Set();
for(const filename of files){try{
 const source=fs.readFileSync(filename,'utf8');if(Buffer.byteLength(source)>API.LIMITS.sourceBytes)throw Error('source >256 KiB');
 const context=vm.createContext({module:{exports:{}},sdk:API.createSDK(12345),console:{log(){},warn(){}},Math:Object.create(Math)},{codeGeneration:{strings:false,wasm:false}});
 context.Math.random=context.sdk.random;vm.runInContext(source,context,{timeout:2000,filename});
 const meta=API.validateModule(context.module.exports);if(modes.has(meta.mode))throw Error('Duplicate mode '+meta.mode);modes.add(meta.mode);
 const w=new A.World({mode:meta.mode,seed:12345,foodCount:200,thornCount:6,activeIds:[0,1,2,3]});let memory={};
 for(let i=0;i<80;i++){context.obs=API.observation(w,0);context.memory=memory;
  const result=API.validateResult(vm.runInContext('module.exports.act(obs,memory)',context,{timeout:100}));memory=result.memory;
  for(let tick=0;tick<3;tick++)w.step(1/60,{0:result.action});
 }
 console.log('PASS',meta.mode,filename,'(80 decisions; contract only, not strategy rating)');
}catch(err){failures++;console.error('FAIL',filename,String(err.message||err));}}
process.exitCode=failures?1:0;
