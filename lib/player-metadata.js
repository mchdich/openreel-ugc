/** Explicit public-player field deltas. No network, database or browser dependencies. */
import {normalizeRecords} from '../public/engine.js';

const FIELDS=['handle','url','authorUrl','thumbnail','avatar'];
const SOURCE='tiktok-public-player-dom';
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const fail=message=>new Error(`Invalid player metadata: ${message}`);
function timestamp(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value)throw fail('observedAt must be a valid ISO UTC timestamp.');
 return value;
}
function httpsUrl(value){
 if(typeof value!=='string'||!value||value.length>2000||/[\u0000-\u0020\u007f\\]/.test(value))throw fail('evidence URL must be bounded absolute HTTPS text.');
 let url;try{url=new URL(value);}catch{throw fail('evidence URL must be absolute HTTPS.');}
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash)throw fail('evidence URL must be HTTPS without credentials, port or fragment.');
 return url;
}
function officialUrl(value){
 const url=httpsUrl(value);
 if(!value.startsWith('https://www.tiktok.com/')||url.hostname!=='www.tiktok.com')throw fail('evidence URL must use the official www.tiktok.com HTTPS host.');
 return url;
}
function observedLink(value){
 const url=httpsUrl(value);
 if(!/^https:\/\/(?:www\.)?tiktok\.com\//.test(value)||!['www.tiktok.com','tiktok.com'].includes(url.hostname))throw fail('observed link must use an official TikTok HTTPS host.');
 return `https://www.tiktok.com${url.pathname.replace(/\/$/,'')}`;
}
function imageUrl(value){
 const url=httpsUrl(value);
 if(!['tiktokcdn.com','tiktokcdn-us.com','tiktokcdn-eu.com'].some(host=>url.hostname===host||url.hostname.endsWith(`.${host}`)))throw fail('image URL must use an official TikTok CDN HTTPS host.');
 return url.href;
}

/** Validate original observations, then discard diagnostic claims and signed URLs from provenance. */
export function normalizePlayerMetadataDelta(delta){
 if(!object(delta)||typeof delta.postId!=='string'||!/^\d{1,30}$/.test(delta.postId)||delta.recordId!==`tiktok-${delta.postId}`)throw fail('record identity must match a numeric post ID.');
 const {postId,recordId}=delta,observedAt=timestamp(delta.observedAt);
 if(!object(delta.patch)||Object.keys(delta.patch).some(field=>!FIELDS.includes(field)))throw fail('patch may contain only handle, url, authorUrl, thumbnail and avatar.');
 const fields=FIELDS.filter(field=>Object.hasOwn(delta.patch,field));
 const patch={};
 for(const field of fields){
  if(typeof delta.patch[field]!=='string'||!delta.patch[field]||delta.patch[field].length>2000)throw fail(`${field} patch must be nonempty bounded text.`);
  patch[field]=delta.patch[field];
 }
 if(!/^@[a-z0-9_][a-z0-9_.]{0,79}$/i.test(patch.handle||'')||patch.url!==`https://www.tiktok.com/${patch.handle}/video/${postId}`||patch.authorUrl!==`https://www.tiktok.com/${patch.handle}`)throw fail('patch requires a matching public handle, canonical post URL and author URL.');
 for(const field of ['thumbnail','avatar'])if(Object.hasOwn(patch,field)&&imageUrl(patch[field])!==patch[field])throw fail(`${field} must be a canonical HTTPS image URL.`);
 if(!object(delta.metadataEvidence)||Object.keys(delta.metadataEvidence).length!==fields.length||Object.keys(delta.metadataEvidence).some(field=>!fields.includes(field)))throw fail('every patched field requires its own observation evidence.');
 for(const field of fields){
  const evidence=delta.metadataEvidence[field];
  if(!object(evidence)||evidence.sourceType!==SOURCE||evidence.postId!==postId||timestamp(evidence.observedAt)!==observedAt)throw fail(`${field} evidence must match the post and observation timestamp.`);
  const source=officialUrl(evidence.sourceUrl);
  if(source.pathname!==`/player/v1/${postId}`)throw fail(`${field} source player post ID does not match.`);
  if(typeof evidence.selector!=='string'||!evidence.selector||evidence.selector.length>4000)throw fail(`${field} evidence needs a bounded DOM selector.`);
  if(['handle','url','authorUrl'].includes(field)){
   if(evidence.attribute!=='href')throw fail(`${field} evidence must be an observed link href.`);
   if(observedLink(evidence.observedValue)!==(field==='authorUrl'?patch.authorUrl:patch.url))throw fail(`${field} observed URL does not match the post or author.`);
  }else{
   if(!['src','currentSrc'].includes(evidence.attribute)||imageUrl(evidence.observedValue)!==patch[field])throw fail(`${field} observed image URL does not match the patch.`);
   if(evidence[evidence.attribute]!==undefined&&evidence[evidence.attribute]!==evidence.observedValue)throw fail(`${field} observed image source does not match its attribute.`);
   if(field==='avatar'){
    if(observedLink(evidence.authorAnchorHref)!==patch.authorUrl)throw fail('avatar evidence must be inside the matching author anchor.');
   }
  }
 }
 return {recordId,postId,observedAt,patch,metadataEvidence:{sourceType:SOURCE,sourceUrl:`https://www.tiktok.com/player/v1/${postId}`,observedAt,postId,fields}};
}

/** Return a normalized new record; existing ingestion, identity, text and metrics stay untouched. */
export function mergePlayerMetadataRecord(record,delta){
 const change=normalizePlayerMetadataDelta(delta);
 if(!object(record)||record.id!==change.recordId)throw fail('existing record identity does not match the delta post ID.');
 const source=officialUrl(record.url);
 const match=source.pathname.match(/^\/player\/v1\/(\d{1,30})$/)||source.pathname.match(/^\/@[a-z0-9_][a-z0-9_.]{0,79}\/video\/(\d{1,30})$/i);
 if(!match||match[1]!==change.postId||source.search)throw fail('existing record source post ID does not match the metadata delta.');
 return normalizeRecords([{...record,...change.patch,metadataEvidence:change.metadataEvidence}])[0];
}
