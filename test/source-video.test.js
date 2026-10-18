import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {handleApi} from '../lib/api.js';
import {normalizeWorkspace} from '../public/workspace.js';
import {createAppServer} from '../server.js';
const mod=await import('../lib/source-video.js').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const env={OPENAI_API_KEY:'controlled-test-key',OPENAI_VISION_MODEL:'test-vision'};
const url='https://www.tiktok.com/@source_test/video/1000',record={id:'tiktok-1000',handle:'@source_test',creatorId:'5000',url,caption:'Original caption',sourceType:'tiktok-public-post',fetchedAt:'2026-10-18T00:00:00.000Z',demo:false};
const attachment={name:'Source video',duration:10,width:720,height:1280,frames:[{timestamp:.04,dataUrl:'data:image/jpeg;base64,/9j/2Q=='}],transcript:''};
const receipt={sourceType:'tiktok-public-player-frames',sourceUrl:url,creatorId:'5000',observedAt:'2026-10-18T00:00:00.000Z',duration:10,frames:[{timestamp:.04,sha256:createHash('sha256').update(Buffer.from('/9j/2Q==','base64')).digest('hex')}]};
const narrative={kind:'critique',mode:'ai',title:'Controlled critique',summary:'Visible samples only.',sections:[{heading:'Observation',text:'A controlled source fixture.',timestamps:[.04]}],sources:[],creators:[],stats:{totalRecords:0},videoAnalysis:{name:attachment.name,duration:10,frameCount:1,timestamps:[.04],audioAvailable:false,transcriptProvided:false}};
function setup(options={}){assert.equal(typeof mod.createSourceVideoService,'function');const calls={inspect:0,capture:0,analyze:0},service=mod.createSourceVideoService(env,{inspect:async()=>{calls.inspect++;return {record,video:{width:720,height:1280,duration:10}};},capture:async()=>{calls.capture++;return {attachment,visualEvidence:receipt};},analyze:async(a,q,e,options)=>{calls.analyze++;assert.deepEqual(a.frames,attachment.frames);assert.equal(a.transcript,'');assert.ok(options.signal);return structuredClone(narrative);},...options});return {service,calls};}

test('source review uses actual bound capture and reuses ephemeral frames for explicit follow-up without another acquisition',async()=>{
 const {service,calls}=setup();const first=await service({url,question:'Review the hook'});assert.equal(first.sources[0].id,record.id);assert.deepEqual(first.videoAnalysis.sourceEvidence,receipt);assert.match(first.sourceSessionId,/^[a-f0-9-]{36}$/);assert.doesNotMatch(JSON.stringify(first),/data:image|base64|controlled-test-key/);
 const second=await service({sessionId:first.sourceSessionId,question:'Give three proposed openings'});assert.equal(second.sourceSessionId,first.sourceSessionId);assert.deepEqual(calls,{inspect:1,capture:1,analyze:2});
});

test('bad input, forged capture identity/hash and cancelled requests cannot reach the model or retain a session',async()=>{
 for(const payload of [{url:'http://127.0.0.1/private',question:'Review'},{url,sessionId:'both',question:'Review'},{url,question:''},{sessionId:'not-an-opaque-session',question:'Review'},{url,question:'Review',extra:true}]){const {service,calls}=setup();await assert.rejects(service(payload));assert.deepEqual(calls,{inspect:0,capture:0,analyze:0});}
 for(const sampled of [{attachment:{...attachment,transcript:'Unverified text not part of this capture'},visualEvidence:receipt},{attachment,visualEvidence:{...receipt,frames:[{timestamp:.04,sha256:'b'.repeat(64)}]}},{attachment,visualEvidence:{...receipt,sourceUrl:url.replace('1000','1001')}}]){const {service,calls}=setup({capture:async()=>sampled});await assert.rejects(service({url,question:'Review'}));assert.equal(calls.analyze,0);}
 const c=new AbortController();c.abort();const {service,calls}=setup();await assert.rejects(service({url,question:'Review'},{signal:c.signal}));assert.equal(calls.capture,0);
});

test('source sessions expire at ten minutes and are bounded to two, with no silent recapture',async()=>{
 let time=0;const {service,calls}=setup({now:()=>time});const first=await service({url,question:'Review'});time=10*60*1000;await assert.rejects(service({sessionId:first.sourceSessionId,question:'Follow up'}),e=>e.status===410);assert.equal(calls.capture,1);
 const sessions=[];for(let i=0;i<3;i++)sessions.push(await service({url,question:'Explicitly review again'}));await assert.rejects(service({sessionId:sessions[0].sourceSessionId,question:'Follow up'}),e=>e.status===410);assert.equal(calls.capture,4);await service({sessionId:sessions[2].sourceSessionId,question:'Follow up'});assert.equal(calls.capture,4);
});

test('one source operation runs at a time and a failed capture releases the slot without a fictional answer',async()=>{
 let release,started;const active=new Promise(r=>{started=r;});const {service,calls}=setup({capture:async()=>{started();await new Promise(r=>{release=r;});throw Object.assign(Error('Source unavailable'),{code:'PLAYER_BARRIER',status:502});}});const first=service({url,question:'Review'});await active;await assert.rejects(service({url,question:'Review'}),e=>e.status===429);release();await assert.rejects(first,e=>e.code==='PLAYER_BARRIER');assert.equal(calls.analyze,0);
});

test('the overall deadline waits for bounded capture cleanup and blocks later model work or overlapping capture',async()=>{
 const {service,calls}=setup({deadlineMs:1000,capture:async(source,{signal})=>{await new Promise(resolve=>signal.addEventListener('abort',()=>setTimeout(resolve,200),{once:true}));return {attachment,visualEvidence:receipt};}});
 const pending=service({url,question:'Review'}).catch(e=>e);await new Promise(r=>setTimeout(r,1050));await assert.rejects(service({url,question:'Overlapping review'}),e=>e.status===429);assert.equal((await pending).status,504);assert.equal(calls.analyze,0);
});

test('source API is explicitly unavailable without the optional service and protects public browser/model resources before callback',async()=>{
 const request=(base='http://127.0.0.1',token)=>new Request(base+'/api/videos/analyze',{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify({url,question:'Review'})});
 assert.equal((await handleApi(request())).status,503);
 let calls=0;const configured={...env,OPENREEL_SOURCE_VIDEO:async(payload,{signal})=>{calls++;assert.equal(payload.url,url);assert.ok(signal);return narrative;},OPENREEL_API_TOKEN:'operator'};
 assert.equal((await handleApi(request('https://public.example'),configured)).status,401);assert.equal(calls,0);assert.equal((await handleApi(request('https://public.example','operator'),configured)).status,200);assert.equal(calls,1);
 const status=await (await handleApi(new Request('http://127.0.0.1/api/status'),configured)).json();assert.equal(status.sourceVideoAvailable,true);assert.doesNotMatch(JSON.stringify(status),/operator|test-key|browser-path/);
});

test('saved source critiques keep only validated receipt/source/timestamps and discard ephemeral tokens and raw-frame extras',()=>{
 const saved=result=>normalizeWorkspace({records:[record],bookmarks:[],alerts:[],activeId:'source-chat',conversations:[{id:'source-chat',title:'Source critique',messages:[{role:'assistant',result}]}]});
 const result={...structuredClone(narrative),sources:[record],sourceSessionId:'never-store-this',videoAnalysis:{...narrative.videoAnalysis,sourceEvidence:receipt,sourceSessionId:'never-store-this',frames:attachment.frames}};
 const restored=saved(result).conversations[0].messages[0].result;assert.deepEqual(restored.videoAnalysis.sourceEvidence,receipt);assert.deepEqual(restored.sections[0].timestamps,[.04]);assert.doesNotMatch(JSON.stringify(restored),/never-store-this|data:image|base64/);
 assert.equal(saved({...result,videoAnalysis:{...result.videoAnalysis,sourceEvidence:{...receipt,sourceUrl:url.replace('1000','1001')}}}).conversations.length,0);
 for(const changed of [{duration:20,timestamps:[19]},{audioAvailable:true},{transcriptProvided:true},{frameCount:2,timestamps:[.04,6]}])assert.equal(saved({...result,videoAnalysis:{...result.videoAnalysis,...changed},sections:changed.timestamps?[{...result.sections[0],timestamps:changed.timestamps}]:result.sections}).conversations.length,0);
});

test('Node client disconnect propagates cancellation to the optional source operation',async()=>{
 let entered,aborted;const started=new Promise(r=>{entered=r;}),cancelled=new Promise(r=>{aborted=r;});
 const server=createAppServer({OPENREEL_SOURCE_VIDEO:async(payload,{signal})=>{entered();await new Promise(resolve=>signal.addEventListener('abort',()=>{aborted();resolve();},{once:true}));throw Object.assign(Error('Cancelled'),{status:499});}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const controller=new AbortController();
 try{const response=fetch(`http://127.0.0.1:${server.address().port}/api/videos/analyze`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url,question:'Review'}),signal:controller.signal}).catch(e=>e);await started;controller.abort();await response;let timer;try{await Promise.race([cancelled,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Cancellation did not reach source operation')),1000);})]);}finally{clearTimeout(timer);}}
 finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});

test('source cancellation drains normal browser cleanup and quarantines a failed close before another operation',async()=>{
 let captures=0;const {service,calls}=setup({deadlineMs:1000,capture:async(source,{signal})=>{if(++captures===1)await new Promise(resolve=>signal.addEventListener('abort',()=>setTimeout(resolve,800),{once:true}));return {attachment,visualEvidence:receipt};}});
 const started=Date.now();await assert.rejects(service({url,question:'Review'}),e=>e.status===504);assert.ok(Date.now()-started>=1750);assert.equal(calls.analyze,0);assert.equal((await service({url,question:'Another explicit source'})).mode,'ai');
 const failed=setup({capture:async()=>{throw Object.assign(Error('Controlled cleanup failure'),{code:'CAPTURE_CLEANUP_FAILED',captureDiagnostic:{cleanupFailed:true}});}});await assert.rejects(failed.service({url,question:'Review'}),e=>e.code==='CAPTURE_CLEANUP_FAILED');await assert.rejects(failed.service({url,question:'Another source'}),e=>e.status===503);assert.equal(failed.calls.analyze,0);
});

test('optional source scanning retains twelve exact frame receipts and citations through workspace reload',async()=>{
 const frames=Array.from({length:12},(_,i)=>({timestamp:i*.5,dataUrl:attachment.frames[0].dataUrl})),times=frames.map(f=>f.timestamp),evidence={...receipt,frames:frames.map(f=>({timestamp:f.timestamp,sha256:receipt.frames[0].sha256}))};
 let controls;const service=mod.createSourceVideoService({...env,OPENREEL_SOURCE_SCAN:'true'},{inspect:async()=>({record}),capture:async(_source,options)=>{controls=options;return {attachment:{...attachment,frames},visualEvidence:evidence};},analyze:async input=>({...structuredClone(narrative),sections:[{heading:'Selected states',text:'Visible states.',timestamps:times}]})});
 const answer=await service({url,question:'Review'});assert.equal(controls.scanStates,true);assert.equal(controls.timeoutMs,60000);assert.equal(answer.videoAnalysis.frameCount,12);assert.deepEqual(answer.videoAnalysis.sourceEvidence,evidence);
 const restored=normalizeWorkspace({records:[record],conversations:[{id:'twelve',title:'Twelve',messages:[{role:'assistant',result:answer}]}]});
 const saved=restored.conversations[0].messages[0].result;assert.equal(saved.videoAnalysis.frameCount,12);assert.deepEqual(saved.videoAnalysis.sourceEvidence,evidence);assert.deepEqual(saved.sections[0].timestamps,times);assert.doesNotMatch(JSON.stringify(saved),/data:image|sourceSessionId/);
 let worked=false;const invalid=mod.createSourceVideoService({...env,OPENREEL_SOURCE_SCAN:'yes'},{inspect:async()=>{worked=true;},capture:async()=>assert.fail('No scan on invalid option')});await assert.rejects(invalid({url,question:'Review'}),e=>e.code==='SOURCE_SCAN_CONFIGURATION');assert.equal(worked,false);
});

test('a public post without playable video geometry returns a source limit before browser or model work',async()=>{
 let inspected=0,captured=0;const {service}=setup({inspect:async()=>({record,video:++inspected===1?null:{duration:10,width:720,height:1280}}),capture:async()=>{captured++;return {attachment,visualEvidence:receipt};}});
 await assert.rejects(service({url,question:'Review the hook'}),e=>e.code==='SOURCE_VIDEO_UNAVAILABLE'&&e.status===422&&/another.*video|attach/i.test(e.message));assert.equal(captured,0);
 const next=await service({url,question:'Review another available capture'});assert.equal(next.mode,'ai');assert.equal(captured,1);
 const unavailable=mod.createSourceVideoService(env,{inspect:async()=>({record,video:null}),capture:async()=>assert.fail('No browser for known missing geometry'),analyze:async()=>assert.fail('No provider for known missing geometry')});
 const response=await handleApi(new Request('http://127.0.0.1:3000/api/videos/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url,question:'Review'})}),{...env,OPENREEL_LOCAL_REQUEST:true,OPENREEL_SOURCE_VIDEO:unavailable});assert.equal(response.status,422);const body=await response.json();assert.doesNotMatch(JSON.stringify(body),/controlled-test-key|installed.*runtime|private-stack/i);
});
