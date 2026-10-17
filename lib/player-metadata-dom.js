/** Pure public-player snapshot parsing. No browser runtime, network, or database dependency. */
const ID=/^\d{1,30}$/;
const HANDLE=/^[a-zA-Z0-9_][a-zA-Z0-9_.]{0,79}$/;
const SOURCE='tiktok-public-player-dom';
const CHALLENGE=/captcha|verify (?:that )?you are human|access denied|unusual traffic|security verification|log in to (?:tiktok|continue)|sign in to (?:tiktok|continue)/i;
export function validatePlayerPostIds(ids,{limit=5}={}) {
 if(!Number.isSafeInteger(limit)||limit<1||limit>40)throw new Error('Collection limit must be an integer from 1 to 40.');
 if(!Array.isArray(ids)||ids.length<1||ids.length>limit||ids.some(id=>typeof id!=='string'||!ID.test(id))||new Set(ids).size!==ids.length)throw new Error('Supply 1–limit unique numeric post IDs as strings (default limit 5, maximum 40). URLs and numeric values are not accepted.');
 return [...ids];
}
function official(value) {
 if(typeof value!=='string'||value.length>2000||/[\u0000-\u0020\u007f\\]/.test(value))return null;
 try{const url=new URL(value);return url.protocol==='https:'&&['www.tiktok.com','tiktok.com'].includes(url.hostname)&&!url.port&&!url.username&&!url.password&&!url.hash?url:null;}catch{return null;}
}
function postLink(value,id) {
 const url=official(value);if(!url)return null;
 const match=url.pathname.match(/^\/@([^/]+)\/video\/(\d{1,30})\/?$/);
 if(!match||match[2]!==id||!HANDLE.test(match[1]))return null;
 return {url,handle:match[1],canonical:`https://www.tiktok.com/@${match[1]}/video/${id}`};
}
function authorLink(value,handle) {
 const url=official(value);return url&&url.pathname.replace(/\/$/,'')===`/@${handle}`?url:null;
}
function imageUrl(value) {
 if(typeof value!=='string'||value.length>2000)return null;
 if(/[\u0000-\u0020\u007f\\]/.test(value))return null;
 try{const url=new URL(value);return url.protocol==='https:'&&!url.port&&!url.username&&!url.password&&!url.hash&&['tiktokcdn-us.com','tiktokcdn.com','tiktokcdn-eu.com'].some(domain=>url.hostname.endsWith('.'+domain))?url:null;}catch{return null;}
}
function expiry(value) {
 const parameter=new URL(value).searchParams.get('x-expires');
 if(!parameter||!/^\d{1,12}$/.test(parameter))return {};
 const date=new Date(Number(parameter)*1000);
 return Number.isFinite(date.getTime())?{urlExpiryParameter:parameter,urlExpiresAt:date.toISOString()}:{};
}
export function detectPlayerBarrier(snapshot) {
 if(!snapshot||typeof snapshot!=='object')return {code:'INVALID_PLAYER_NAVIGATION'};
 if([401,403,429].includes(snapshot.documentStatus)||snapshot.documentBarrierStatus)return {code:'HTTP_BARRIER',status:snapshot.documentBarrierStatus||snapshot.documentStatus};
 const url=official(snapshot.finalUrl||snapshot.sourceUrl);
 if(!url||/\/login\b|\/passport\b|captcha|challenge/i.test(url.pathname))return {code:'LOGIN_OR_CHALLENGE_NAVIGATION'};
 if(snapshot.dom?.visibleChallenge||snapshot.dom?.hasPasswordInput||CHALLENGE.test(snapshot.dom?.barrierText||''))return {code:'LOGIN_OR_CAPTCHA'};
 return null;
}
export function parsePlayerMetadataSnapshot(snapshot) {
 if(!snapshot||typeof snapshot!=='object')return null;
 if(typeof snapshot.videoId!=='string'||!ID.test(snapshot.videoId)||snapshot.documentStatus!==200||detectPlayerBarrier(snapshot)||typeof snapshot.observedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(snapshot.observedAt)||!Number.isFinite(Date.parse(snapshot.observedAt))||new Date(snapshot.observedAt).toISOString()!==snapshot.observedAt)return null;
 const source=official(snapshot.sourceUrl),final=official(snapshot.finalUrl);
 if(!source||!final||source.hostname!=='www.tiktok.com'||final.hostname!=='www.tiktok.com'||source.pathname!==`/player/v1/${snapshot.videoId}`||final.pathname!==source.pathname)return null;
 const links=Array.isArray(snapshot.dom?.links)?snapshot.dom.links.filter(link=>link&&typeof link==='object'):[];
 const matched=links.map((link,index)=>({...postLink(link.href,snapshot.videoId),raw:link.href,index})).filter(link=>link.canonical);
 const handles=new Set(matched.map(link=>link.handle));
 if(handles.size!==1)return null;
 const primary=matched[0],handle=primary.handle;
 const authorIndex=links.findIndex(link=>authorLink(link.href,handle));
 if(authorIndex<0)return null;
 const profile=links[authorIndex];
 const evidence=(selector,attribute,observedValue,extra={})=>({sourceType:SOURCE,sourceUrl:snapshot.sourceUrl,observedAt:snapshot.observedAt,postId:snapshot.videoId,selector,attribute,observedValue,...extra});
 const cssValue=value=>String(value).replaceAll('\\','\\\\').replaceAll('"','\\"');
 const postSelector=`a[href="${cssValue(primary.raw)}"]`;
 const authorSelector=`a[href="${cssValue(profile.href)}"]`;
 const proof={inputPostIdMatched:true,officialHttpsHost:true,authorAnchorMatches:true};
 const delta={recordId:`tiktok-${snapshot.videoId}`,postId:snapshot.videoId,observedAt:snapshot.observedAt,patch:{handle:'@'+handle,url:primary.canonical,authorUrl:`https://www.tiktok.com/@${handle}`},metadataEvidence:{handle:evidence(postSelector,'href',primary.raw,{validation:proof}),url:evidence(postSelector,'href',primary.raw,{validation:proof,normalization:'Removed tracking query only.'}),authorUrl:evidence(authorSelector,'href',profile.href,{validation:proof})},unknownFields:[]};
 const images=Array.isArray(snapshot.dom?.images)?snapshot.dom.images.filter(image=>image&&typeof image==='object'):[];
 const selected=image=>image.currentSrc||image.src;
 const loaded=image=>Number.isSafeInteger(image.width)&&image.width>0&&Number.isSafeInteger(image.height)&&image.height>0&&imageUrl(selected(image));
 const imageProof=(image,extra={})=>({validation:{inputPostIdMatched:true,imageElementLoaded:true,loadedSourceVerified:Boolean(image.currentSrc),officialCdnHttps:true,...extra},width:image.width,height:image.height,src:image.src,currentSrc:image.currentSrc||'',srcset:image.srcset??null,...expiry(selected(image))});
 const covers=images.filter(image=>image.alt==='Video Cover'&&loaded(image));
 if(new Set(covers.map(selected)).size===1){
  const cover=covers[0];delta.patch.thumbnail=selected(cover);delta.metadataEvidence.thumbnail=evidence('img[alt="Video Cover"]',cover.currentSrc?'currentSrc':'src',selected(cover),imageProof(cover));
 }else delta.unknownFields.push('thumbnail');
 const avatars=images.filter(image=>image.alt!=='Video Cover'&&loaded(image)&&authorLink(image.ancestorHref,handle));
 if(new Set(avatars.map(selected)).size===1){
  const avatar=avatars[0];delta.patch.avatar=selected(avatar);delta.metadataEvidence.avatar=evidence(authorSelector+' img',avatar.currentSrc?'currentSrc':'src',selected(avatar),{authorAnchorHref:avatar.ancestorHref,...imageProof(avatar,{insideVerifiedAuthorAnchor:true})});
 }else delta.unknownFields.push('avatar');
 return delta;
}
/** One observation per supplied ID. A barrier, navigation failure, or deadline ends the batch. */
export async function collectPlayerMetadataSequential(ids,observe,{afterEach,limit=5,maxElapsedMs=120000,now=()=>performance.now()}={}) {
 const selected=validatePlayerPostIds(ids,{limit});
 if(typeof observe!=='function')throw new Error('An observation function is required.');
 if(!Number.isSafeInteger(maxElapsedMs)||maxElapsedMs<1000||maxElapsedMs>600000)throw new Error('Batch time limit must be 1000–600000 milliseconds.');
 const started=now();
 const result={schema:'openreel-public-player-metadata-delta-v1',requested:selected.length,startedAt:new Date().toISOString(),observations:[],deltas:[],stopped:null};
 for(const videoId of selected){
  const remainingMs=maxElapsedMs-(now()-started);
  if(remainingMs<=0){result.stopped={code:'BATCH_TIMEOUT',nextPostId:videoId};break;}
  let snapshot,timer;
  const abort=new AbortController();
  try{
   snapshot=await Promise.race([
    Promise.resolve().then(()=>observe(videoId,{remainingMs,signal:abort.signal})),
    new Promise((_,reject)=>{timer=setTimeout(()=>{abort.abort();reject(Object.assign(new Error('Batch deadline exceeded.'),{code:'BATCH_TIMEOUT'}));},Math.ceil(remainingMs));})
   ]);
  }catch(error){snapshot={videoId,observedAt:new Date().toISOString(),error:String(error.message||error).slice(0,500),...(error.code==='BATCH_TIMEOUT'?{errorCode:'BATCH_TIMEOUT'}:{})};}
  finally{clearTimeout(timer);}
  result.observations.push(snapshot);
  const barrier=snapshot?.errorCode==='BATCH_TIMEOUT'?{code:'BATCH_TIMEOUT'}:snapshot?.error?{code:'NAVIGATION_ERROR'}:snapshot?.videoId!==videoId?{code:'OBSERVATION_ID_MISMATCH'}:detectPlayerBarrier(snapshot);
  if(barrier)result.stopped={videoId,...barrier};
  else {const delta=parsePlayerMetadataSnapshot(snapshot);if(delta)result.deltas.push(delta);}
  if(afterEach)await afterEach(result);
  if(result.stopped)break;
 }
 result.notAttempted=selected.slice(result.observations.length);
 result.finishedAt=new Date().toISOString();
 return result;
}
