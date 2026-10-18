/** Optional Node-only source review. Frames/session tokens never enter persistent records. */
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {isAbsolute} from 'node:path';
import {statSync} from 'node:fs';
import {canonicalTikTokUrl,inspectPublicPost} from './social.js';
import {capturePublicPlayer,PLAYER_CLEANUP_TIMEOUT_MS} from './player-visuals.js';
import {validateVideoAttachment,analyzeVideo} from './media.js';
import {frameDescriptionConfiguration} from './frame-description.js';
import {normalizeRecords,normalizeCapturedFrames} from '../public/engine.js';
const failure=(code,message,status=400)=>Object.assign(new Error(message),{code,status});

export function createSourceVideoService(env,{inspect=inspectPublicPost,capture,analyze=analyzeVideo,now=Date.now,deadlineMs=240000}={}){
 if(typeof capture!=='function'||!Number.isInteger(deadlineMs)||deadlineMs<1000||deadlineMs>240000)throw Error('A bounded source capture implementation is required.');
 const sessions=new Map();let active=false,cleanupFailed=false;
 const remove=id=>{clearTimeout(sessions.get(id)?.expiry);sessions.delete(id);};
 return async function review(payload,{signal}={}){
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.keys(payload).length!==2||!Object.hasOwn(payload,'question')||typeof payload.question!=='string'||!payload.question.trim()||payload.question.length>6000||Number(Object.hasOwn(payload,'url'))+Number(Object.hasOwn(payload,'sessionId'))!==1)throw failure('INVALID_SOURCE_REVIEW','Choose one source URL or active review session and a question of 1–6000 characters.');
  const url=Object.hasOwn(payload,'url')?canonicalTikTokUrl(payload.url):null;
  if(!url&&(typeof payload.sessionId!=='string'||!/^[-a-f0-9]{36}$/.test(payload.sessionId)))throw failure('INVALID_SOURCE_SESSION','Invalid source-review session.');
  frameDescriptionConfiguration(env);signal?.throwIfAborted();
  if(cleanupFailed)throw failure('SOURCE_CAPTURE_UNAVAILABLE','Source browser cleanup did not complete. Restart the local server before another source capture.',503);
  if(active)throw failure('SOURCE_REVIEW_BUSY','Another source review is running. Wait for it to finish.',429);
  for(const [id,value]of sessions)if(now()-value.createdAt>=600000)remove(id);
  let cached=url?null:sessions.get(payload.sessionId);if(!url&&!cached)throw failure('SOURCE_SESSION_EXPIRED','This source review expired. Open its source details and choose Review video again.',410);
  active=true;let timer,operation;const controller=new AbortController(),combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(failure('SOURCE_REVIEW_TIMEOUT','Source review exceeded its deadline. No automatic recapture was made.',504));},deadlineMs);});
  try{operation=(async()=>{
   if(!cached){
    const source=await inspect(url,{signal:combined});combined.throwIfAborted();
    const record=normalizeRecords([source.record])[0];if(record.id!==`tiktok-${url.split('/').at(-1)}`||record.demo||record.url!==url)throw failure('SOURCE_IDENTITY','Source identity did not match the selected video.',502);
    const sampled=await capture(source,{signal:combined});combined.throwIfAborted();const attachment=validateVideoAttachment(sampled.attachment),evidence=normalizeCapturedFrames(sampled.visualEvidence,record);
    const hashes=attachment.frames.map(frame=>({timestamp:frame.timestamp,sha256:createHash('sha256').update(Buffer.from(frame.dataUrl.split(',')[1],'base64')).digest('hex')}));
    if(attachment.transcript||evidence.duration!==attachment.duration||JSON.stringify(evidence.frames)!==JSON.stringify(hashes))throw failure('SOURCE_RECEIPT','Captured frames did not match their source receipt.',502);
    cached={record,attachment,evidence,createdAt:now()};
   }
   const result=await analyze(cached.attachment,payload.question,env,{signal:combined});combined.throwIfAborted();
   const sessionId=url?randomUUID():payload.sessionId;if(url){while(sessions.size>=2)remove(sessions.keys().next().value);cached.expiry=setTimeout(()=>remove(sessionId),Math.max(1,600000-(now()-cached.createdAt)));cached.expiry.unref?.();sessions.set(sessionId,cached);}
   return {...result,sections:result.sections.map(section=>({...section,sourceIds:[cached.record.id]})),sources:[cached.record],sourceSessionId:sessionId,videoAnalysis:{name:cached.attachment.name,duration:cached.attachment.duration,frameCount:cached.attachment.frames.length,timestamps:cached.attachment.frames.map(f=>f.timestamp),audioAvailable:false,transcriptProvided:false,sourceEvidence:cached.evidence},notice:[result.notice,'This review used decoded samples from the cited public player. Source audio was not acquired; intervening footage is unverified. The capture expires after ten minutes and is not written to the corpus.'].filter(Boolean).join(' ')};
  })().catch(error=>{if((error?.captureDiagnostic?.cleanupTimedOut||error?.captureDiagnostic?.cleanupFailed))cleanupFailed=true;throw error;});return await Promise.race([deadline,operation]);}catch(error){if((error?.captureDiagnostic?.cleanupTimedOut||error?.captureDiagnostic?.cleanupFailed))cleanupFailed=true;if(combined.aborted)throw failure(signal?.aborted?'SOURCE_REVIEW_CANCELLED':'SOURCE_REVIEW_TIMEOUT',signal?.aborted?'Source review was cancelled.':'Source review exceeded its deadline.',signal?.aborted?499:504);throw error;}finally{clearTimeout(timer);if(combined.aborted&&operation){let cleanupTimer;try{const finished=await Promise.race([operation.then(()=>true,()=>true),new Promise(resolve=>{cleanupTimer=setTimeout(()=>resolve(false),PLAYER_CLEANUP_TIMEOUT_MS+50);})]);if(!finished)cleanupFailed=true;}finally{clearTimeout(cleanupTimer);}}active=false;}
 };
}

/** Paths are operator configuration; no installation or caller-controlled runtime loading. */
export function createNativeSourceVideoService(env){
 const modulePath=env.OPENREEL_PLAYWRIGHT_MODULE,browserPath=env.OPENREEL_BROWSER_PATH;
 if(!modulePath&&!browserPath)return undefined;
 if(!modulePath||!browserPath||!isAbsolute(modulePath)||!isAbsolute(browserPath)||!statSync(browserPath).isFile())throw Error('Configure absolute installed OPENREEL_PLAYWRIGHT_MODULE and OPENREEL_BROWSER_PATH paths.');
 const {chromium}=createRequire(import.meta.url)(modulePath);if(typeof chromium?.launch!=='function')throw Error('Configured Playwright runtime has no Chromium launcher.');
 return createSourceVideoService(env,{capture:(source,options)=>capturePublicPlayer(chromium,source,{...options,executablePath:browserPath})});
}
