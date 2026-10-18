import {discoverCreator} from './social.js';
import {searchRecords,searchPlan,creatorKey,wantsCreatorSearch} from '../public/engine.js';
import {parseTemporalQuery} from '../public/temporal-query.js';
import {enrichPublicPosts} from './live-post-metadata.js';

const failure=(message,status,code)=>Object.assign(new Error(message),{status,code});
const coverage='Coverage is limited to creators selected from the real seed index and their current public embed videos. This does not search all of TikTok or discover creators outside that index.';

/** One incidental caption is a video match, not evidence of a creator niche. */
export function searchFreshCreatorRecords(records,query){
 const {terms}=searchPlan(query,{},records);
 const creators=wantsCreatorSearch(query);
 if(!creators||!terms.length)return searchRecords(records,query,{uniqueCreators:creators});
 const clean=value=>String(value||'').toLowerCase().replace(/[^a-z0-9@.\s]/g,' ').replace(/\s+/g,' ').trim();
 const relevant=value=>terms.every(term=>clean(value).includes(term));
 const groups=new Map();
 for(const record of records){const key=creatorKey(record);if(!groups.has(key))groups.set(key,new Map());groups.get(key).set(record.id,record);}
 const eligible=new Set();
 for(const [key,posts] of groups){
  const rows=[...posts.values()];
  const identity=rows.some(row=>relevant([row.handle,row.bio,row.niche].join(' ')));
  const matching=rows.filter(row=>relevant([row.caption,row.transcript,row.visualDescription,row.hook].join(' '))).length;
  if(identity||matching>=2&&matching*2>=rows.length)eligible.add(key);
 }
 return searchRecords(records.filter(record=>eligible.has(creatorKey(record))),query,{uniqueCreators:true});
}

/** Select known handles without treating stale counts or contacts as fresh eligibility. */
export async function indexedCreatorHandles(query,corpus,maxCreators=3){
 if(typeof query!=='string'||!query.trim()||query.length>1000)throw failure('Live discovery needs a search query of 1–1000 characters.',400,'INVALID_DISCOVERY_QUERY');
 if(!Number.isInteger(maxCreators)||maxCreators<1||maxCreators>3)throw failure('Select one to three indexed creators.',400,'INVALID_DISCOVERY_OPTIONS');
 if(!corpus||typeof corpus.search!=='function')throw failure('No real seed index is configured. Configure a corpus or import known public creators first.',503,'LIVE_INDEX_UNAVAILABLE');
 let seeds;
 // Cached follower counts and contacts are not eligibility checks for a fresh
 // acquisition. Use topic/known affiliation to choose seeds, then check all
 // requested constraints against the new profile snapshot below.
 const plan=searchPlan(query.trim());
 const seedOptions={kind:'real',uniqueCreators:true,knownHandlesOnly:true,limit:maxCreators};
 for(const field of ['school','location','niche','format','handle'])if(plan.filters[field])seedOptions[field]=plan.filters[field];
 try{seeds=await corpus.search(plan.terms.join(' '),seedOptions);}
 catch{throw failure('The real seed index could not be queried. Check the server corpus configuration.',503,'LIVE_INDEX_UNAVAILABLE');}
 if(!Array.isArray(seeds))throw failure('The real seed index returned an invalid result. Check the corpus adapter.',502,'INVALID_INDEX_RESPONSE');
 const handles=[];
 for(const seed of seeds){
  if(typeof seed?.handle!=='string')continue;
  const handle=seed.handle.trim().replace(/^@/,'').toLowerCase();
  if(!/^[a-z0-9_][a-z0-9_.]{0,79}$/.test(handle)||handles.includes(handle))continue;
  handles.push(handle);
  if(handles.length>=maxCreators)break;
 }
 return handles;
}

/** Refresh a bounded set of known creators, then reapply every query constraint. */
export async function discoverIndexedVideos(query,options={},corpus,env={}){
 if(typeof query!=='string'||!query.trim()||query.length>1000)throw failure('Live discovery needs a search query of 1–1000 characters.',400,'INVALID_DISCOVERY_QUERY');
 if(!options||typeof options!=='object'||Array.isArray(options)||['limit','maxCreators'].some(key=>options[key]!==undefined&&(!Number.isInteger(options[key])||options[key]<1)))throw failure('Live discovery limits must be positive whole numbers: up to 30 videos from up to 3 creators.',400,'INVALID_DISCOVERY_OPTIONS');
 const limit=Math.min(options.limit??20,30);
 const topic=parseTemporalQuery(query)?.query||query;
 const handles=await indexedCreatorHandles(topic,corpus,Math.min(options.maxCreators??3,3));
 const current=[];
 let creatorsRefreshed=0,unavailable=0;
 for(const handle of handles){
  // The official adapter performs one bounded GET. Failures propagate safely;
  // neither an automatic retry nor stale cached records can enter the result.
  const result=await discoverCreator(handle);
  if(result.creator){creatorsRefreshed++;current.push(...result.records);}
  else unavailable++;
 }
 const enriched=await enrichPublicPosts(current,{...env,OPENREEL_CORPUS:corpus});
 const seen=new Set();
 const records=searchFreshCreatorRecords(enriched.records,topic.trim()).filter(record=>{
  if(seen.has(record.id))return false;
  seen.add(record.id);return true;
 }).slice(0,limit);
 return {records,provider:'indexed-public-profile-refresh',creatorsRefreshed,fetchedAt:new Date().toISOString(),...(enriched.postMetadata?{postMetadata:enriched.postMetadata,observedRecords:enriched.observedRecords}:{}),
  notice:`${coverage}${!handles.length?' No indexed creators matched this query.':''}${unavailable?` ${unavailable} selected public profile${unavailable===1?' is':'s are'} unavailable; no cached videos were substituted.`:''}${enriched.notice?' '+enriched.notice:''}`};
}
