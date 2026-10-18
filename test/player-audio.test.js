import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAudioChunk} from '../lib/audio.js';
const mod=await import('../lib/player-audio.js').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const capture=(...args)=>{assert.equal(typeof mod.captureOpeningAudio,'function');return mod.captureOpeningAudio(...args);};

async function withPlayer(options,run){
 const previous={AudioContext:globalThis.AudioContext,MediaStream:globalThis.MediaStream},calls={contexts:0,closed:0,stopped:0,play:0,paused:0},node=()=>({connect(){},disconnect(){}});let processor,playing=false,total=0;
 const tracks=[{kind:'audio',enabled:true,muted:false,readyState:'live',stop(){calls.stopped++;}},{kind:'video',stop(){calls.stopped++;}}];
 const video={duration:3,currentTime:0,readyState:4,seeking:false,playbackRate:1,muted:!options.unmuted,pause(){calls.paused++;playing=false;},addEventListener(){},removeEventListener(){},captureStream(){if(options.protected)throw new DOMException('Controlled origin protection','SecurityError');return {getAudioTracks:()=>options.absent?[]:[tracks[0]],getTracks:()=>tracks};},async play(){calls.play++;playing=true;setImmediate(function tick(){if(!playing)return;const data=Float32Array.from({length:4096},(_,i)=>options.silent?0:.4*Math.sin((total+i)*Math.PI*880/16000));total+=data.length;if(!options.stalled)video.currentTime=total/16000;processor.onaudioprocess?.({inputBuffer:{getChannelData:()=>data},outputBuffer:{getChannelData:()=>new Float32Array(4096)}});setImmediate(tick);});}};
 globalThis.MediaStream=class {constructor(tracks){this.tracks=tracks;}};
 globalThis.AudioContext=class {constructor(){calls.contexts++;this.sampleRate=16000;this.state=options.suspended?'suspended':'running';this.destination={};}resume(){return options.suspended?new Promise(()=>{}):Promise.resolve();}createMediaStreamSource(){return node();}createScriptProcessor(){return processor=node();}createGain(){return {...node(),gain:{value:1}};}async close(){calls.closed++;this.state='closed';}};
 try{return await run(video,calls);}finally{playing=false;for(const [name,value]of Object.entries(previous)){if(value===undefined)delete globalThis[name];else globalThis[name]=value;}}
}

test('opening audio produces bounded canonical mono PCM from the player and cleans up all owned resources',async()=>{
 await withPlayer({unmuted:true},async(video,calls)=>{
  const result=await capture(video,{maxSeconds:1});assert.equal(result.status,'available');assert.equal(result.sourceStart,0);assert.ok(result.sourceEnd>=1&&result.sourceEnd<1.1);assert.ok(result.rms>.1);assert.equal(result.chunk.duration,1);
  const validated=validateAudioChunk(result.chunk);assert.equal(validated.bytes.byteLength,32044);assert.equal(new DataView(validated.bytes.buffer).getInt16(44,true),0);assert.equal(new DataView(validated.bytes.buffer).getInt16(46,true),Math.round(.4*Math.sin(Math.PI*880/16000)*32767));
  assert.equal(calls.closed,1);assert.equal(calls.stopped,2);assert.equal(video.muted,true);assert.equal(video.playbackRate,1);
 });
});

test('absent or origin-protected player audio is unavailable without creating a decoder or fictional sample',async()=>{
 for(const options of [{absent:true},{protected:true}])await withPlayer(options,async(video,calls)=>{const result=await capture(video,{maxSeconds:1});assert.equal(result.status,'unavailable');assert.equal(result.chunk,undefined);assert.equal(calls.contexts,0);assert.equal(calls.play,0);});
});

test('silent or stalled source audio cannot become a transcript sample and still closes resources',async()=>{
 for(const options of [{silent:true},{stalled:true}])await withPlayer(options,async(video,calls)=>{const result=await capture(video,{maxSeconds:1});assert.equal(result.status,'unavailable');assert.equal(result.chunk,undefined);assert.equal(calls.closed,1);assert.equal(calls.stopped,2);});
});

test('a suspended audio context stays unavailable without changing autoplay policy',async()=>{
 await withPlayer({suspended:true},async(video,calls)=>{const result=await capture(video,{maxSeconds:1});assert.equal(result.status,'unavailable');assert.equal(result.reason,'suspended');assert.equal(calls.play,0);assert.equal(calls.closed,1);assert.equal(calls.stopped,2);});
});

test('invalid opening-audio limits fail before any player or audio operation',async()=>{
 for(const maxSeconds of [0,31,.5,NaN,'30'])await assert.rejects(capture({captureStream:()=>assert.fail('No player access')},{maxSeconds}));
});
