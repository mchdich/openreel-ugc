import test from 'node:test';
import assert from 'node:assert/strict';
import * as social from '../lib/social.js';
const mod=await import('../lib/player-visuals.js').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const call=(name,...args)=>{assert.equal(typeof mod[name],'function');return mod[name](...args);};
const url=i=>`https://www.tiktok.com/@visual_${i}/video/${1000+i}`;
const source=i=>({record:{id:'tiktok-'+(1000+i),handle:'@visual_'+i,creatorId:String(5000+i),url:url(i),caption:'Coffee',sourceType:'tiktok-public-post',fetchedAt:'2024-10-05T00:00:00.000Z',demo:false},video:{duration:10,width:720,height:1280}});
const hash='32461d5bd1773012acef0ba15636752949bd7c2ce50f9172159d9f56cf0dd9af';
const capture=i=>({attachment:{name:'Source',duration:10,width:720,height:1280,frames:[{timestamp:.04,dataUrl:'data:image/jpeg;base64,/9j/2Q=='},{timestamp:6,dataUrl:'data:image/jpeg;base64,/9j/2Q=='}]},visualEvidence:{sourceType:'tiktok-public-player-frames',sourceUrl:url(i),creatorId:String(5000+i),observedAt:'2024-10-05T01:00:00.000Z',duration:10,frames:[{timestamp:.04,sha256:hash},{timestamp:6,sha256:hash}]},snapshot:{frameCount:2}});
const description='The sampled frames show close-up shots of coffee preparation on a dark table.';

test('public video detail reads expose only validated geometry, retaining the existing metadata-only import contract',async()=>{
 assert.equal(typeof social.inspectPublicPost,'function');const old=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return new Response('<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">'+JSON.stringify({__DEFAULT_SCOPE__:{'webapp.video-detail':{statusCode:0,itemInfo:{itemStruct:{id:'1000',privateItem:false,author:{id:'5000',uniqueId:'visual_0',privateAccount:false},video:{width:720,height:1280,duration:10,playAddr:'https://private-media.example/signed-address'}}}}}})+'</script>',{headers:{'content-type':'text/html'}});};
 try{const details=await social.inspectPublicPost(url(0));assert.deepEqual(details.video,{width:720,height:1280,duration:10});assert.equal(details.record.id,'tiktok-1000');assert.doesNotMatch(JSON.stringify(details),/private-media|signed-address/);const record=await social.ingestPublicPost(url(0));assert.equal(record.id,'tiktok-1000');assert.equal(record.video,undefined);assert.equal(calls,2);}finally{globalThis.fetch=old;}
});

test('source batches reject arbitrary URLs, duplicate IDs and oversize inputs before any browser work',()=>{
 assert.deepEqual(call('validateVisualSourceUrls',[url(0)]),[url(0)]);
 for(const values of [['https://attacker.example/private'],[url(0),url(0).replace('@visual_0','@renamed')],Array(9).fill(url(0)),[]])assert.throws(()=>call('validateVisualSourceUrls',values,{limit:8}));
});

test('sequential capture and one description per source produce source-bound field deltas without raw frames',async()=>{
 const stages=[],result=await call('collectPlayerVisuals',[url(0),url(1)],{inspect:async u=>{stages.push('inspect');return source(Number(u.split('/').at(-1))-1000);},capture:async s=>{stages.push('capture');return capture(Number(s.record.id.slice(7))-1000);},describe:async()=>{stages.push('describe');return {description,timestamps:[.04,6]};}});
 assert.deepEqual(stages,['inspect','capture','describe','inspect','capture','describe']);assert.equal(result.deltas.length,2);assert.equal(result.deltas[1].recordId,'tiktok-1001');assert.equal(result.deltas[1].visualEvidence.sourceUrl,url(1));assert.doesNotMatch(JSON.stringify(result.deltas),/data:image|base64/);assert.equal(result.stopped,null);
});
test('a capture barrier or receipt mismatch stops all paid and later source work',async()=>{
 for(const badCapture of [async()=>{throw Object.assign(Error('Denied'),{code:'PLAYER_BARRIER'});},async()=>({...capture(0),visualEvidence:{...capture(0).visualEvidence,frames:[{timestamp:.04,sha256:'b'.repeat(64)},{timestamp:6,sha256:hash}]}})]){
  let inspected=0;const result=await call('collectPlayerVisuals',[url(0),url(1)],{inspect:async()=>{inspected++;return source(0);},capture:badCapture,describe:async()=>assert.fail('No paid call after a capture barrier or wrong hashes')});assert.equal(inspected,1);assert.equal(result.deltas.length,0);assert.ok(result.stopped);assert.deepEqual(result.notAttempted,[url(1)]);
 }
});

test('capture rejects invalid geometry and cancellation before launching the optional browser',async()=>{
 const chromium={launch:async()=>assert.fail('Unexpected browser launch')};await assert.rejects(call('capturePublicPlayer',chromium,{...source(0),video:{...source(0).video,duration:601}}));const c=new AbortController();c.abort();await assert.rejects(call('capturePublicPlayer',chromium,source(0),{signal:c.signal}));
});

test('a challenge appearing after initial identity verification blocks all samples from release and all model work',async()=>{
 let reads=0,closed=0,decoded=0;const original=source(0);
 const page={setDefaultTimeout(){},on(){},url:()=>`https://www.tiktok.com/player/v1/1000?autoplay=1&muted=1`,goto:async()=>({status:()=>200}),waitForFunction:async()=>{},evaluate:async()=>({links:[{href:url(0)},{href:'https://www.tiktok.com/@visual_0'}],images:[],visibleChallenge:++reads>=3}),locator:()=>({evaluate:async(fn,time)=>time===undefined?{duration:10,width:720,height:1280}:(decoded++,{timestamp:time,dataUrl:'data:image/jpeg;base64,/9j/2Q=='})})};
 const chromium={launch:async()=>({newContext:async()=>({newPage:async()=>page,newCDPSession:async()=>({send:async()=>{},on(){}})}),close:async()=>{closed++;}})};
 const result=await call('collectPlayerVisuals',[url(0)],{inspect:async()=>original,capture:s=>call('capturePublicPlayer',chromium,s),describe:async()=>assert.fail('No model call after a late challenge')});
 assert.equal(result.deltas.length,0);assert.equal(result.stopped.code,'PLAYER_BARRIER');assert.equal(decoded,0);assert.ok(reads>=3);assert.equal(closed,1);
});

test('capture deadline and observed network budget stop the owned browser without evaluating frames',async()=>{
 await assert.rejects(call('capturePublicPlayer',{launch:async()=>new Promise(()=>{})},source(0),{timeoutMs:1000}),e=>e.code==='CAPTURE_TIMEOUT');
 let closed=0;const events={};const page={setDefaultTimeout(){},on(){},goto:async()=>{events['Network.dataReceived']({encodedDataLength:2048});return new Promise(()=>{});}};
 const chromium={launch:async()=>({newContext:async()=>({newPage:async()=>page,newCDPSession:async()=>({send:async()=>{},on:(name,fn)=>events[name]=fn})}),close:async()=>{closed++;}})};
 await assert.rejects(call('capturePublicPlayer',chromium,source(0),{maxBytes:1024,timeoutMs:1000}),e=>e.code==='CAPTURE_NETWORK_LIMIT');assert.ok(closed>=1);
});

test('hanging owned-browser cleanup cannot suppress the original network-limit failure',async()=>{
 let closes=0;const events={},page={setDefaultTimeout(){},on(){},goto:async()=>{events['Network.dataReceived']({encodedDataLength:2048});return new Promise(()=>{});}};
 const chromium={launch:async()=>({newContext:async()=>({newPage:async()=>page,newCDPSession:async()=>({send:async()=>{},on:(name,fn)=>{events[name]=fn;}})}),close:async()=>{closes++;return new Promise(()=>{});}})};
 let timer;try{const result=await Promise.race([call('capturePublicPlayer',chromium,source(0),{timeoutMs:1000,maxBytes:1024}).catch(e=>e),new Promise(resolve=>{timer=setTimeout(()=>resolve(null),5000);})]);assert.ok(result,'Capture must settle despite a stuck close');assert.equal(result.code,'CAPTURE_NETWORK_LIMIT');assert.equal(result.captureDiagnostic.cleanupTimedOut,true);assert.equal(closes,1);}finally{clearTimeout(timer);}
});

test('a decoded source is released only after a normally delayed owned Chrome close completes',async()=>{
 let closed=false,settled=false;
 const page={setDefaultTimeout(){},on(){},url:()=>`https://www.tiktok.com/player/v1/1000?autoplay=1&muted=1`,goto:async()=>({status:()=>200}),waitForFunction:async()=>{},evaluate:async()=>({links:[{href:url(0)},{href:'https://www.tiktok.com/@visual_0'}],images:[]}),locator:()=>({evaluate:async(fn,time)=>time===undefined?{duration:10,width:720,height:1280}:{timestamp:time,dataUrl:'data:image/jpeg;base64,/9j/2Q=='}})};
 const chromium={launch:async()=>({newContext:async()=>({newPage:async()=>page,newCDPSession:async()=>({send:async()=>{},on(){}})}),close:async()=>{await new Promise(r=>setTimeout(r,750));closed=true;}})};
 const pending=call('capturePublicPlayer',chromium,source(0)).then(value=>{settled=true;return value;},error=>{settled=true;throw error;});pending.catch(()=>{});
 await new Promise(r=>setTimeout(r,550));assert.equal(settled,false,'No early rejection or release while ordinary cleanup is still pending');assert.equal(closed,false);const result=await pending;assert.equal(closed,true);assert.equal(result.attachment.frames.length,8);
});

test('a failed owned-browser close never releases decoded samples as a successful capture',async()=>{
 const page={setDefaultTimeout(){},on(){},url:()=>`https://www.tiktok.com/player/v1/1000?autoplay=1&muted=1`,goto:async()=>({status:()=>200}),waitForFunction:async()=>{},evaluate:async()=>({links:[{href:url(0)},{href:'https://www.tiktok.com/@visual_0'}],images:[]}),locator:()=>({evaluate:async(fn,time)=>time===undefined?{duration:10,width:720,height:1280}:{timestamp:time,dataUrl:'data:image/jpeg;base64,/9j/2Q=='}})};
 const chromium={launch:async()=>({newContext:async()=>({newPage:async()=>page,newCDPSession:async()=>({send:async()=>{},on(){}})}),close:async()=>{throw Error('Controlled close failure');}})};
 await assert.rejects(call('capturePublicPlayer',chromium,source(0)),e=>e.code==='CAPTURE_CLEANUP_FAILED'&&e.captureDiagnostic.cleanupFailed===true);
});

test('cancellation while launch is pending waits for the owned late browser to close',async()=>{
 let closed=false,contexts=0;const c=new AbortController();
 const chromium={launch:async()=>{await new Promise(r=>setTimeout(r,150));return {newContext:async()=>{contexts++;assert.fail('No page after cancellation');},close:async()=>{await new Promise(r=>setTimeout(r,650));closed=true;}};}};
 const pending=call('capturePublicPlayer',chromium,source(0),{signal:c.signal}).catch(e=>e);setTimeout(()=>c.abort(),20);const result=await pending;assert.equal(result.code,'CAPTURE_CANCELLED');assert.equal(closed,true,'Cancelled request must account for its late-starting browser');assert.equal(contexts,0);
});
