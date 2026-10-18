/** Optional Node/Chromium source sampling; no manual video-asset request or saved footage. */
import {createHash} from 'node:crypto';
import {canonicalTikTokUrl} from './social.js';
import {sampleTimes} from '../public/media.js';
import {validateVideoAttachment} from './media.js';
import {normalizeVisualEvidence} from '../public/engine.js';
import {detectPlayerBarrier,parsePlayerMetadataSnapshot} from './player-metadata-dom.js';
const fail=(code,message)=>Object.assign(new Error(message),{code});
export const PLAYER_CLEANUP_TIMEOUT_MS=3000;
const digest=frame=>({timestamp:frame.timestamp,sha256:createHash('sha256').update(Buffer.from(frame.dataUrl.split(',')[1],'base64')).digest('hex')});
export function validateVisualSourceUrls(values,{limit=3}={}){
 if(!Number.isInteger(limit)||limit<1||limit>8||!Array.isArray(values)||!values.length||values.length>limit)throw fail('INVALID_VISUAL_SOURCES','Supply 1–8 unique direct source URLs within the chosen limit.');
 const urls=values.map(canonicalTikTokUrl);if(new Set(urls.map(u=>u.split('/').at(-1))).size!==urls.length)throw fail('INVALID_VISUAL_SOURCES','Source video IDs must be unique.');return urls;
}
export async function capturePublicPlayer(chromium,source,{executablePath,signal,timeoutMs=45000,maxBytes=50*1024*1024}={}){
 const r=source?.record,v=source?.video,url=canonicalTikTokUrl(r?.url),id=url.split('/').at(-1);
 if(r?.demo!==false||r.id!==`tiktok-${id}`||r.sourceType!=='tiktok-public-post'||!/^\d{1,30}$/.test(r.creatorId||'')||!v||!Number.isFinite(v.duration)||v.duration<=0||v.duration>600||![v.width,v.height].every(x=>Number.isInteger(x)&&x>0&&x<=7680)||typeof chromium?.launch!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>60000||!Number.isInteger(maxBytes)||maxBytes<1||maxBytes>50*1024*1024)throw fail('INVALID_PLAYER_CAPTURE','Verified post geometry and an installed Chromium runtime are required.');
 if(signal?.aborted)throw fail('CAPTURE_CANCELLED','Source capture was cancelled.');
 let browser,launch,timer,abort,halted=false,stop,closing,captureError;
 const requestClose=()=>closing??=(async()=>{if(!browser&&launch){try{browser=await launch;}catch{return true;}}if(!browser)return true;try{await browser.close();return true;}catch{return false;}})();
 const interrupted=new Promise((_,reject)=>{stop=(code,message)=>{halted=true;reject(fail(code,message));requestClose();};timer=setTimeout(()=>stop('CAPTURE_TIMEOUT','Public-player capture exceeded its deadline.'),timeoutMs);abort=()=>stop('CAPTURE_CANCELLED','Source capture was cancelled.');signal?.addEventListener('abort',abort,{once:true});});
 const snapshot={postId:id,sourceUrl:`https://www.tiktok.com/player/v1/${id}?autoplay=1&muted=1`,networkBytes:0,mediaResponses:[],playerErrors:[],phase:'launch'};
 try{return await Promise.race([interrupted,(async()=>{
  browser=await (launch=chromium.launch({executablePath,headless:true,timeout:Math.min(15000,timeoutMs)}));if(halted){requestClose();throw fail('CAPTURE_CANCELLED','Source capture stopped before browser startup.');}
  const context=await browser.newContext({viewport:{width:720,height:1280},acceptDownloads:false,serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(Math.min(10000,timeoutMs));
  const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');cdp.on('Network.dataReceived',event=>{snapshot.networkBytes+=event.encodedDataLength||event.dataLength||0;if(snapshot.networkBytes>maxBytes)stop('CAPTURE_NETWORK_LIMIT','Source capture exceeded its observed network-byte budget.');});
  page.on('download',d=>{d.cancel().catch(()=>{});stop('CAPTURE_DOWNLOAD','Unexpected download; source capture stopped.');});
  page.on('pageerror',error=>{if(snapshot.playerErrors.length<10)snapshot.playerErrors.push(String(error.message).replace(/https?:\/\/\S+/g,'remote resource').slice(0,200));});
  page.on('response',response=>{if(response.request().resourceType()==='document'&&[401,403,429].includes(response.status()))stop('PLAYER_HTTP_BARRIER','Public-player document access was denied or rate limited.');if(/^video\//i.test(response.headers()['content-type']||'')&&snapshot.mediaResponses.length<20)snapshot.mediaResponses.push({host:new URL(response.url()).hostname,status:response.status()});});
  snapshot.phase='navigation';const response=await page.goto(snapshot.sourceUrl,{waitUntil:'domcontentloaded',timeout:Math.min(15000,timeoutMs)});snapshot.documentStatus=response?.status();snapshot.finalUrl=page.url();
  const read=()=>page.evaluate(()=>{const visible=e=>Boolean(e&&e.getBoundingClientRect().width&&e.getBoundingClientRect().height&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none'),text=(document.body?.innerText||'').slice(0,100000);return {barrierText:text.match(/captcha|verify (?:that )?you are human|access denied|unusual traffic|security verification|log in to (?:tiktok|continue)|sign in to (?:tiktok|continue)/i)?.[0]||'',visibleChallenge:[...document.querySelectorAll('iframe[src*="captcha"],[id*="captcha"],[class*="captcha"]')].some(visible),hasPasswordInput:[...document.querySelectorAll('input[type="password"]')].some(visible),unavailable:/video currently unavailable|this video is unavailable|couldn't load video/i.test(text),links:[...document.querySelectorAll('a[href]')].slice(0,200).map(e=>({href:e.href})),images:[]};});
  snapshot.dom=await read();snapshot.observedAt=new Date().toISOString();if(snapshot.documentStatus!==200||detectPlayerBarrier(snapshot)||snapshot.dom.unavailable)throw fail('PLAYER_BARRIER','The source player is unavailable or requires access verification.');
  snapshot.phase='decoded-video';await page.waitForFunction(()=>{const video=document.querySelector('video');return video?.readyState>=2&&video.videoWidth>0;},null,{timeout:Math.min(15000,timeoutMs)});
  snapshot.phase='identity';snapshot.dom=await read();snapshot.observedAt=new Date().toISOString();const identity=parsePlayerMetadataSnapshot({...snapshot,videoId:id});if(detectPlayerBarrier(snapshot)||!identity||identity.patch.handle.toLowerCase()!==r.handle.toLowerCase())throw fail('PLAYER_IDENTITY','Playable frames could not be bound to the requested source and creator.');
  const geometry=await page.locator('video').evaluate(video=>{video.pause();return {duration:video.duration,width:video.videoWidth,height:video.videoHeight};});
  if(!Number.isFinite(geometry.duration)||geometry.duration<=0||geometry.duration>600||Math.abs(geometry.duration-v.duration)>1||Math.abs(geometry.width/geometry.height-v.width/v.height)>.03)throw fail('PLAYER_GEOMETRY','Player duration or dimensions conflict with the public source.');
  const checkAccess=async()=>{snapshot.dom=await read();snapshot.finalUrl=page.url();snapshot.observedAt=new Date().toISOString();if(detectPlayerBarrier(snapshot)||snapshot.dom.unavailable)throw fail('PLAYER_BARRIER','The source player became unavailable or requires verification.');const identity=parsePlayerMetadataSnapshot({...snapshot,videoId:id});if(!identity||identity.patch.handle.toLowerCase()!==r.handle.toLowerCase())throw fail('PLAYER_IDENTITY','Source identity changed during capture.');if(halted||signal?.aborted)throw fail('CAPTURE_CANCELLED','Source capture was cancelled.');};
  snapshot.phase='sampling';snapshot.geometry=geometry;const frames=[];
  for(const time of sampleTimes(geometry.duration)){
   await checkAccess();
   const frame=await page.locator('video').evaluate(async(video,target)=>{
    video.pause();if(Math.abs(video.currentTime-target)>.0005)await new Promise((resolve,reject)=>{const cleanup=()=>{clearTimeout(timer);video.removeEventListener('seeked',done);video.removeEventListener('error',failed);},done=()=>{cleanup();resolve();},failed=()=>{cleanup();reject(Error('Seek failed'));},timer=setTimeout(()=>{cleanup();reject(Error('Seek deadline'));},8000);video.addEventListener('seeked',done,{once:true});video.addEventListener('error',failed,{once:true});video.currentTime=target;});
    await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);if(video.seeking||video.readyState<2||Math.abs(video.currentTime-target)>.1)throw Error('Requested playhead not decoded');
    const canvas=document.createElement('canvas');let scale=Math.min(1,960/video.videoWidth,960/video.videoHeight);
    for(let pass=0;pass<5;pass++){canvas.width=Math.max(1,Math.round(video.videoWidth*scale));canvas.height=Math.max(1,Math.round(video.videoHeight*scale));canvas.getContext('2d',{alpha:false}).drawImage(video,0,0,canvas.width,canvas.height);const dataUrl=canvas.toDataURL('image/jpeg',Math.max(.3,.75-pass*.1));if(dataUrl.split(',')[1].length*.75<=160*1024)return {timestamp:Number(video.currentTime.toFixed(3)),dataUrl};scale*=.78;}throw Error('Frame exceeds byte budget');
   },time);await checkAccess();frames.push(frame);
  }
  await checkAccess();const attachment=validateVideoAttachment({name:'Public source '+id,...geometry,frames,transcript:''}),observedAt=new Date().toISOString();
  snapshot.phase='finished';return {attachment,visualEvidence:{sourceType:'tiktok-public-player-frames',sourceUrl:url,creatorId:r.creatorId,observedAt,duration:attachment.duration,frames:attachment.frames.map(digest)},snapshot:{...snapshot,dom:undefined,observedAt,frameCount:frames.length,playheadTimestamps:frames.map(f=>f.timestamp),audioAnalyzed:false}};
 })()]);}catch(error){const failure=error?.code?error:fail('PLAYER_CAPTURE_FAILED','The official player could not supply clean decoded frames. No retry or direct-media fallback was made.');failure.captureDiagnostic={...snapshot,dom:undefined};captureError=failure;throw failure;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);let cleanupTimer;try{const clean=await Promise.race([requestClose(),new Promise(resolve=>{cleanupTimer=setTimeout(()=>resolve(null),PLAYER_CLEANUP_TIMEOUT_MS);})]);if(clean!==true){const diagnostic={cleanupTimedOut:clean===null,cleanupFailed:clean===false};if(captureError)Object.assign(captureError.captureDiagnostic,diagnostic);else throw Object.assign(fail(clean===null?'CAPTURE_CLEANUP_TIMEOUT':'CAPTURE_CLEANUP_FAILED',clean===null?'Owned browser cleanup exceeded its deadline; no sampled attachment was released.':'Owned browser could not close; no sampled attachment was released.'),{captureDiagnostic:{...snapshot,dom:undefined,...diagnostic}});}}finally{clearTimeout(cleanupTimer);}}
}
export async function collectPlayerVisuals(urls,{inspect,capture,describe,afterEach,signal,limit=3}={}){
 const selected=validateVisualSourceUrls(urls,{limit});if([inspect,capture,describe].some(f=>typeof f!=='function'))throw Error('Inspection, capture and description callbacks are required.');
 const report={requested:selected.length,observations:[],deltas:[],stopped:null,notAttempted:[...selected]};
 for(const url of selected){
  if(signal?.aborted){report.stopped={code:'COLLECTION_CANCELLED'};break;}
  const observation={sourceUrl:url,startedAt:new Date().toISOString()};report.observations.push(observation);
  try{
   const source=await inspect(url,{signal});if(source?.record?.id!==`tiktok-${url.split('/').at(-1)}`)throw fail('SOURCE_IDENTITY','Inspected source identity changed.');
   const sampled=await capture(source,{signal}),attachment=validateVideoAttachment(sampled.attachment);
   const evidence=normalizeVisualEvidence(sampled.visualEvidence,{...source.record,visualDescription:'Captured visual samples',descriptionSource:'openreel-vision'});
   if(evidence.duration!==attachment.duration||JSON.stringify(evidence.frames)!==JSON.stringify(attachment.frames.map(digest)))throw fail('CAPTURE_RECEIPT','Captured frames do not match their source receipt.');
   if(signal?.aborted)throw fail('COLLECTION_CANCELLED','Collection was cancelled.');const value=await describe(attachment,{signal}),frames=evidence.frames.filter(f=>value.timestamps.includes(f.timestamp));if(frames.length!==value.timestamps.length)throw fail('DESCRIPTION_BINDING','Description referenced uncaptured samples.');
   observation.capture=sampled.snapshot;observation.capturedFrames=attachment.frames.length;observation.citedFrames=frames.length;observation.description=value.description;report.deltas.push({recordId:source.record.id,visualDescription:value.description,visualEvidence:{...evidence,frames}});
  }catch(error){observation.errorCode=error?.code||'COLLECTION_FAILED';if(error?.captureDiagnostic)observation.captureDiagnostic=error.captureDiagnostic;report.stopped={code:observation.errorCode,sourceUrl:url};}
  observation.finishedAt=new Date().toISOString();report.notAttempted=selected.slice(report.observations.length);if(afterEach)await afterEach(report);if(report.stopped)break;
 }
 return report;
}
