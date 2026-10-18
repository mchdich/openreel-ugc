import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {handleApi} from '../lib/api.js';
import {normalizeWorkspace} from '../public/workspace.js';
import * as engine from '../public/engine.js';
import {createSourceVideoService} from '../lib/source-video.js';
const url='https://www.tiktok.com/@source_test/video/1000',record={id:'tiktok-1000',handle:'@source_test',creatorId:'5000',url,caption:'Controlled source',sourceType:'tiktok-public-post',fetchedAt:'2026-10-18T00:00:00.000Z',demo:false};
const attachment={name:'Controlled source',duration:10,width:720,height:1280,frames:[{timestamp:.04,dataUrl:'data:image/jpeg;base64,/9j/2Q=='}],transcript:''};
const evidence={sourceType:'tiktok-public-player-frames',sourceUrl:url,creatorId:'5000',observedAt:'2026-10-18T00:00:00.000Z',duration:10,frames:[{timestamp:.04,sha256:createHash('sha256').update(Buffer.from('/9j/2Q==','base64')).digest('hex')}]};
const bytes=Buffer.alloc(3244);bytes.write('RIFF',0);bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(16000,24);bytes.writeUInt32LE(32000,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(3200,40);for(let i=0;i<1600;i++)bytes.writeInt16LE(Math.round(12000*Math.sin(i*Math.PI*880/16000)),44+2*i);
const chunk={duration:.1,dataUrl:'data:audio/wav;base64,'+bytes.toString('base64')},capture={sourceType:'tiktok-public-player-audio',sourceUrl:url,creatorId:'5000',observedAt:'2026-10-18T00:00:00.000Z',duration:.1,sourceStart:0,sourceEnd:.1,sha256:createHash('sha256').update(bytes).digest('hex')};
const env={OPENAI_API_KEY:'controlled-test',OPENAI_VISION_MODEL:'controlled-vision',OPENAI_TRANSCRIPTION_MODEL:'controlled-transcribe',OPENREEL_SOURCE_AUDIO:'true'};
const result={kind:'critique',mode:'ai',title:'Controlled',summary:'Controlled',sections:[{heading:'Hook',text:'Controlled sample',timestamps:[.04]}],sources:[],creators:[],stats:{totalRecords:0},videoAnalysis:{name:attachment.name,duration:10,frameCount:1,timestamps:[.04],audioAvailable:false,transcriptProvided:true}};
const normalized=value=>{assert.equal(typeof engine.normalizeCapturedAudio,'function');return engine.normalizeCapturedAudio(value,record,10);};

test('captured opening-audio receipts bind source identity and bounded source/PCM intervals without retaining payloads',()=>{
 assert.deepEqual(normalized(capture),capture);
 for(const changed of [{sourceUrl:url.replace('1000','1001')},{creatorId:'other'},{sourceStart:1},{sourceEnd:11},{duration:31},{sha256:'invalid'},{observedAt:'yesterday'},{dataUrl:chunk.dataUrl}])assert.throws(()=>normalized({...capture,...changed}));
});

test('source opening speech is transcribed once before vision and reused without raw audio in answers',async()=>{
 const calls=[];const service=createSourceVideoService(env,{inspect:async()=>({record,video:{duration:10,width:720,height:1280}}),capture:async()=>({attachment,visualEvidence:evidence,audioCapture:{status:'available',capture,chunk}}),transcribe:async(value,e,{signal})=>{calls.push('transcribe');assert.equal(value.dataUrl,chunk.dataUrl);assert.ok(signal);return {text:'Recognized opening words.',duration:.1,provider:'machine-transcription'};},analyze:async(value)=>{calls.push('analyze');assert.equal(value.transcript,'Recognized opening words.');return structuredClone(result);}});
 const first=await service({url,question:'Review the opening'});assert.deepEqual(calls,['transcribe','analyze']);assert.deepEqual(first.videoAnalysis.sourceAudio,{status:'available',capture,transcript:'Recognized opening words.',transcriptionSource:'machine-transcription'});assert.equal(first.videoAnalysis.transcriptProvided,true);assert.equal(first.videoAnalysis.audioAvailable,false);assert.doesNotMatch(JSON.stringify(first),/data:audio|base64|controlled-test/);
 await service({sessionId:first.sourceSessionId,question:'Propose another hook'});assert.deepEqual(calls,['transcribe','analyze','analyze']);
});

test('forged source-audio receipt or PCM hash is rejected before transcription and vision',async()=>{
 for(const bad of [{...capture,sha256:'b'.repeat(64)},{...capture,creatorId:'9999'},{...capture,duration:.2},{...capture,sourceUrl:url.replace('1000','1001')}]){
  let transcriptions=0,analyses=0;const service=createSourceVideoService(env,{inspect:async()=>({record}),capture:async()=>({attachment,visualEvidence:evidence,audioCapture:{status:'available',capture:bad,chunk}}),transcribe:async()=>{transcriptions++;return {text:'Controlled'};},analyze:async()=>{analyses++;return structuredClone(result);}});await assert.rejects(service({url,question:'Review'}),error=>error.code==='SOURCE_AUDIO_RECEIPT'&&error.status===502);assert.equal(transcriptions,0);assert.equal(analyses,0);
 }
});

test('unavailable opening speech retains visual-only analysis and disabled source audio never calls transcription',async()=>{
 for(const [config,audioCapture]of [[env,{status:'unavailable',reason:'protected-or-unavailable'}],[{...env,OPENREEL_SOURCE_AUDIO:'false'},{status:'available',capture,chunk}]]){
  const service=createSourceVideoService(config,{inspect:async()=>({record}),capture:async()=>({attachment,visualEvidence:evidence,audioCapture}),transcribe:async()=>assert.fail('No unavailable/disabled audio request'),analyze:async value=>{assert.equal(value.transcript,'');return {...structuredClone(result),videoAnalysis:{...result.videoAnalysis,transcriptProvided:false}};}});const answer=await service({url,question:'Review'});assert.equal(answer.videoAnalysis.transcriptProvided,false);assert.equal(answer.videoAnalysis.audioAvailable,false);if(config.OPENREEL_SOURCE_AUDIO==='true')assert.deepEqual(answer.videoAnalysis.sourceAudio,audioCapture);else assert.equal(answer.videoAnalysis.sourceAudio,undefined);
 }
});


test('saved source speech retains only validated scope/text, with frame and transcript flags bound to the same capture',()=>{
 const sourceAudio={status:'available',capture,transcript:'Recognized opening words.',transcriptionSource:'machine-transcription'};
 const answer={...structuredClone(result),sources:[record],sourceSessionId:'never-persist',videoAnalysis:{...result.videoAnalysis,sourceEvidence:evidence,sourceAudio}};
 const saved=value=>normalizeWorkspace({records:[record],conversations:[{id:'speech',title:'Source opening speech',messages:[{role:'assistant',result:value}]}],activeId:'speech',bookmarks:[],alerts:[]});
 const restored=saved(answer).conversations[0].messages[0].result;assert.deepEqual(restored.videoAnalysis.sourceAudio,sourceAudio);assert.equal(restored.videoAnalysis.transcriptProvided,true);assert.doesNotMatch(JSON.stringify(restored),/never-persist|data:audio|base64/);
 for(const changed of [{...sourceAudio,rawAudio:chunk.dataUrl},{...sourceAudio,capture:{...capture,creatorId:'9999'}},{...sourceAudio,transcript:' bad whitespace '},{status:'unavailable',reason:'protected-or-unavailable'}])assert.equal(saved({...answer,videoAnalysis:{...answer.videoAnalysis,sourceAudio:changed}}).conversations.length,0);
 for(const changed of [{audioAvailable:true},{transcriptProvided:false}])assert.equal(saved({...answer,videoAnalysis:{...answer.videoAnalysis,...changed}}).conversations.length,0);
 const empty=saved({...answer,videoAnalysis:{...answer.videoAnalysis,transcriptProvided:false,sourceAudio:{...sourceAudio,transcript:''}}});assert.equal(empty.conversations.length,1);assert.equal(empty.conversations[0].messages[0].result.videoAnalysis.sourceAudio.transcript,'');
});


test('source-speech status requires explicit local service, vision and transcription configuration',async()=>{
 for(const [config,expected]of [[env,false],[{...env,OPENREEL_SOURCE_VIDEO:async()=>{}},true],[{...env,OPENREEL_SOURCE_VIDEO:async()=>{},OPENREEL_SOURCE_AUDIO:'false'},false],[{...env,OPENREEL_SOURCE_VIDEO:async()=>{},OPENAI_TRANSCRIPTION_MODEL:''},false]]){const status=await(await handleApi(new Request('http://127.0.0.1/api/status'),config)).json();assert.equal(status.sourceAudioAvailable,expected);assert.doesNotMatch(JSON.stringify(status),/controlled-test|controlled-transcribe/);}
});

test('audio API forwards request cancellation before a provider operation can outlive the client',async()=>{
 const original=globalThis.fetch,controller=new AbortController();let entered,rejectProvider,pending,propagated=false;const started=new Promise(resolve=>{entered=resolve;});
 globalThis.fetch=async(url,options)=>new Promise((resolve,reject)=>{rejectProvider=()=>reject(new DOMException('Controlled cancellation','AbortError'));options.signal.addEventListener('abort',()=>{propagated=true;rejectProvider();},{once:true});entered();});
 try{pending=handleApi(new Request('http://127.0.0.1/api/audio/transcribe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({audio:chunk}),signal:controller.signal}),env);await started;controller.abort();await new Promise(resolve=>setImmediate(resolve));assert.equal(propagated,true);assert.equal((await pending).status,504);}
 finally{rejectProvider?.();if(pending)await pending;globalThis.fetch=original;}
});
