import {canonicalTikTokUrl,ingestPublicPost} from './social.js';
import {creatorKey,retainPostingDate} from '../public/engine.js';
const failure=message=>Object.assign(new Error(message),{status:400,code:'INVALID_POST_METADATA_INPUT'});
function candidates(records,knownDates=new Set()){
 const groups=new Map(),seen=new Set();let count=0;
 for(const record of records){
  if(!record||record.demo!==false||record.synthetic||record.sourceType!=='tiktok-creator-embed'||typeof record.id!=='string'||seen.has(record.id))continue;
  let url;try{url=canonicalTikTokUrl(record.url);}catch{continue;}
  const id=url.match(/\/video\/(\d+)$/)[1],key=creatorKey(record);
  if(record.id!==`tiktok-${id}`||!key)continue;
  seen.add(record.id);count++;if(!groups.has(key))groups.set(key,[]);groups.get(key).push({record,url,id});
 }
 for(const rows of groups.values())rows.sort((a,b)=>BigInt(a.id)>BigInt(b.id)?-1:BigInt(a.id)<BigInt(b.id)?1:0);
 const selected=[];
 for(const known of [false,true]){
  const eligible=[...groups.values()].map(rows=>rows.filter(row=>knownDates.has(row.record.id)===known));
  for(let offset=0;selected.length<6;offset++){
   let added=false;for(const rows of eligible){if(rows[offset]){selected.push(rows[offset]);added=true;}if(selected.length===6)break;}
   if(!added)break;
  }
 }
 return {selected,count,all:[...groups.values()].flat(),keys:new Map([...groups].flatMap(([key,rows])=>rows.map(({record})=>[record.id,key])))};
}

/** Enrich only independently confirmed public embed records; never persist here. */
export async function enrichPublicPosts(records,env={}, {skip=false}={}){
 if(!Array.isArray(records)||records.length>120)throw failure('Public post metadata needs at most 120 confirmed embed records.');
 if(env.OPENREEL_POST_METADATA!=='true')return {records};
 const knownDates=new Set();
 if(!skip&&typeof env.OPENREEL_CORPUS?.getMany==='function'){
  try{
   const eligible=candidates(records).all.map(({record})=>({...record,postedAt:''}));
   for(const record of await retainCorpusPostingDates(eligible,env.OPENREEL_CORPUS))if(record.postedAt)knownDates.add(record.id);
  }catch{throw Object.assign(new Error('Previously observed posting-date coverage could not be read. No post pages were requested.'),{status:503,code:'POST_COVERAGE_UNAVAILABLE'});}
 }
 const {selected,count,keys}=candidates(records,knownDates),accepted=new Map();
 const selectedKnownDated=selected.filter(({record})=>knownDates.has(record.id)).length;
 const postMetadata={checked:0,enriched:0,dated:0,unavailable:0,failed:0,notAttempted:selected.length,candidateRecords:count,knownDatedCandidates:knownDates.size,selectedUndated:selected.length-selectedKnownDated,selectedKnownDated,limit:6,incomplete:false,selection:'undated-first-creator-round-robin-numeric-id'};
 const signal=AbortSignal.timeout(20000);
 if(!skip)for(let offset=0;offset<selected.length;offset+=3){
  if(signal.aborted)break;
  const batch=selected.slice(offset,offset+3);
  await Promise.all(batch.map(async({record,url})=>{
   postMetadata.checked++;
   try{
    const observed=await ingestPublicPost(url,{signal});
    if(observed.id!==record.id||(record.creatorId?observed.creatorId!==record.creatorId:observed.handle.toLowerCase()!==String(record.handle).toLowerCase()))throw new Error('Post identity mismatch.');
    accepted.set(record.id,observed);postMetadata.enriched++;if(observed.postedAt)postMetadata.dated++;
   }catch(error){if(error?.status===404)postMetadata.unavailable++;else postMetadata.failed++;}
  }));
  if(postMetadata.failed)break;
 }
 postMetadata.notAttempted=selected.length-postMetadata.checked;
 postMetadata.incomplete=postMetadata.failed>0||postMetadata.notAttempted>0;
 // A later observed profile snapshot applies to that creator's other posts too.
 // Keep the exact post URL with its profile evidence; untouched video fields and
 // unknown posting dates still come from the independent creator embed.
 const profiles=new Map();
 for(const observed of accepted.values()){
  const key=keys.get(observed.id),old=profiles.get(key);
  if(!old||observed.fetchedAt>old.fetchedAt||observed.fetchedAt===old.fetchedAt&&observed.id>old.id)profiles.set(key,observed);
 }
 const withProfile=record=>{
  const profile=profiles.get(keys.get(record.id));if(!profile||record.demo!==false||record.synthetic)return record;
  const updated={...record};
  for(const field of ['handle','creatorId','bio','email','school','location','followers','authorUrl','avatar'])updated[field]=profile[field];
  updated.profileEvidence={...profile.profileEvidence,url:profile.url};
  updated.unavailableMetrics=[...(record.unavailableMetrics||[]).filter(field=>field!=='followers'),...(profile.unavailableMetrics.includes('followers')?['followers']:[])];
  updated.url=`https://www.tiktok.com/${profile.handle}/video/${record.id.slice(7)}`;
  if(!accepted.has(record.id)){updated.sourceType='tiktok-public-profile-and-post';updated.fetchedAt=profile.fetchedAt;}
  return updated;
 };
 const ordered=selected.flatMap(({record})=>accepted.has(record.id)?[withProfile(accepted.get(record.id))]:[]);
 const notice=skip?'Public post metadata was not requested after a profile check failed. Confirmed embed records retain their available fields.':`Public post metadata: ${postMetadata.checked} of ${selected.length} selected sources checked, ${postMetadata.enriched} inspected and ${postMetadata.dated} dated. ${postMetadata.selectedUndated} selected sources lacked a previously verified posting date. ${postMetadata.failed?`${postMetadata.failed} failed; no later batch or automatic retry was requested. `:''}${postMetadata.unavailable?`${postMetadata.unavailable} unavailable. `:''}Uninspected posts supply no new posting dates; earlier attributed dates may be retained. Selection is bounded creator coverage, not a representative or platform-wide trend sample.`;
 return {records:[...ordered,...records.filter(record=>!accepted.has(record.id)).map(withProfile)],observedRecords:ordered,postMetadata,notice};
}

/** Reuse only an independently observed creation date from this persisted source. */
export async function retainCorpusPostingDates(records,corpus){
 if(!corpus||typeof corpus.get!=='function'&&typeof corpus.getMany!=='function')return records;
 const ids=[...new Set(records.filter(record=>!record.postedAt&&record.demo===false).map(record=>record.id))];if(!ids.length)return records;
 const prior=[];
 for(let offset=0;offset<ids.length;offset+=40){const batch=ids.slice(offset,offset+40);prior.push(...(typeof corpus.getMany==='function'?await corpus.getMany(batch):await Promise.all(batch.map(id=>corpus.get(id)))));}
 const known=new Map(prior.filter(Boolean).map(record=>[record.id,record]));
 return records.map(record=>{const previous=known.get(record.id);return previous?.corpusKind==='real'&&previous.corpusVerification==='provider-observed'?retainPostingDate(previous,record):record;});
}
