/* Original procedurally synthesized effects. No music, audio downloads or game RNG. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.ArenaSound=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
const PRESETS={
 pelletEat:{duration:.13,from:440,to:850,noise:0,level:.58},
 eject:{duration:.075,from:620,to:190,noise:.035,level:.65},
 split:{duration:.24,from:160,to:490,noise:.3,level:.72},
 burst:{duration:.29,from:150,to:65,noise:.8,level:.8},
 eat:{duration:.30,from:210,to:72,noise:.1,level:.78},
 merge:{duration:.18,from:270,to:510,noise:.035,level:.6},
 death:{duration:.48,from:240,to:65,noise:.14,level:.65},
 ui:{duration:.08,from:620,to:820,noise:0,level:.4}
};
const COOLDOWN={pelletEat:.07,eject:.065,split:.12,burst:.12,eat:.1,merge:.12,death:.22,ui:.08};
function makeClip(kind,sampleRate=44100){
 const p=PRESETS[kind];if(!p)throw new Error('Unknown effect: '+kind);if(!Number.isFinite(sampleRate)||sampleRate<8000||sampleRate>192000)throw new Error('Invalid sample rate');
 const n=Math.ceil(sampleRate*p.duration),out=new Float32Array(n);let seed=1234567,noise=0,peak=0;
 for(let i=0;i<n;i++){
  const t=i/sampleRate,u=i/(n-1),phase=2*Math.PI*(p.from*t+(p.to-p.from)*t*t/(2*p.duration));
  seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;noise+=(((seed>>>0)/4294967296*2-1)-noise)*.24;
  const attack=Math.min(1,t/.004),tail=Math.min(1,(1-u)*p.duration/.025),envelope=attack*tail*Math.exp(-3.2*u);
  let wave=Math.sin(phase)+.16*Math.sin(phase*2);
  if(kind==='eat')wave=Math.sin(phase+1.1*Math.sin(2*Math.PI*15*t))+.2*Math.sin(phase*.5);
  if(kind==='burst')wave*=.4;
  if(kind==='split')wave*=.7;
  const value=(wave*(1-p.noise*.6)+noise*p.noise*2.8)*envelope*p.level;
  out[i]=value;peak=Math.max(peak,Math.abs(value));
 }
 if(peak>.8)for(let i=0;i<n;i++)out[i]*=.8/peak;
 return out;
}
class SoundBank{
 constructor(){this.enabled=true;this.volume=.35;this.context=null;this.master=null;this.buffers=new Map();this.last=new Map();this.voices=new Set();this.played={};this.error=null;}
 async unlock(){
  try{
   if(!this.context){const Context=root.AudioContext||root.webkitAudioContext;if(!Context)return false;this.context=new Context();this.master=this.context.createGain();this.master.gain.value=this.enabled?this.volume:0;
    const compressor=this.context.createDynamicsCompressor();compressor.threshold.value=-14;compressor.knee.value=16;compressor.ratio.value=5;compressor.attack.value=.003;compressor.release.value=.12;
    this.master.connect(compressor);compressor.connect(this.context.destination);
   }
   if(this.context.state==='suspended')await this.context.resume();return this.context.state==='running';
  }catch(e){this.error=String(e);return false;}
 }
 setEnabled(value){this.enabled=!!value;if(!this.enabled)this.stopAll();if(this.master)this.master.gain.setValueAtTime(this.enabled?this.volume:0,this.context.currentTime);}
 setVolume(value){if(!Number.isFinite(Number(value)))return;this.volume=Math.max(0,Math.min(1,Number(value)));if(this.master)this.master.gain.setValueAtTime(this.enabled?this.volume:0,this.context.currentTime);}
 stopAll(){for(const node of this.voices){try{node.stop();}catch{}try{node.disconnect();}catch{}}this.voices.clear();}
 play(kind,{gain=1,pan=0}={}){
  const ctx=this.context;if(!this.enabled||!this.volume||!PRESETS[kind]||!ctx||ctx.state!=='running'||this.voices.size>=16)return false;
  const now=ctx.currentTime;if(now-(this.last.get(kind)??-Infinity)<COOLDOWN[kind])return false;
  try{
   if(!this.buffers.has(kind)){const samples=makeClip(kind,ctx.sampleRate),b=ctx.createBuffer(1,samples.length,ctx.sampleRate);b.copyToChannel(samples,0);this.buffers.set(kind,b);}
   const src=ctx.createBufferSource(),g=ctx.createGain();src.buffer=this.buffers.get(kind);g.gain.value=Math.max(0,Math.min(1,Number(gain)||0));src.connect(g);
   let panner=null;if(ctx.createStereoPanner){panner=ctx.createStereoPanner();panner.pan.value=Math.max(-1,Math.min(1,Number(pan)||0));g.connect(panner);panner.connect(this.master);}else g.connect(this.master);
   this.voices.add(src);src.onended=()=>{this.voices.delete(src);src.disconnect();g.disconnect();if(panner)panner.disconnect();};src.start();this.last.set(kind,now);this.played[kind]=(this.played[kind]||0)+1;return true;
  }catch(e){this.error=String(e);return false;}
 }
}
return{PRESETS,makeClip,SoundBank};
});
