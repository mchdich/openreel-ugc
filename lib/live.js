import {discoverCreator} from './social.js';
import {searchRecords} from '../public/engine.js';

const failure=(message,status,code)=>Object.assign(new Error(message),{status,code});
const coverage='Coverage is limited to creators selected from the real seed index and their current public embed videos. This does not search all of TikTok or discover creators outside that index.';

/** Refresh a bounded set of known creators, then reapply every query constraint. */
export async function discoverIndexedVideos(query,options={},corpus){
 if(typeof query!=='string'||!query.trim()||query.length>1000)throw failure('Live discovery needs a search query of 1–1000 characters.',400,'INVALID_DISCOVERY_QUERY');
 if(!options||typeof options!=='object'||Array.isArray(options)||['limit','maxCreators'].some(key=>options[key]!==undefined&&(!Number.isInteger(options[key])||options[key]<1)))throw failure('Live discovery limits must be positive whole numbers: up to 30 videos from up to 3 creators.',400,'INVALID_DISCOVERY_OPTIONS');
 const limit=Math.min(options.limit??20,30);
 const maxCreators=Math.min(options.maxCreators??3,3);
 if(!corpus||typeof corpus.search!=='function')throw failure('No real seed index is configured. Configure a corpus or import known public creators first.',503,'LIVE_INDEX_UNAVAILABLE');
 let seeds;
 try{seeds=await corpus.search(query.trim(),{kind:'real',uniqueCreators:true,limit:maxCreators});}
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
 const current=[];
 let creatorsRefreshed=0,unavailable=0;
 for(const handle of handles){
  // The official adapter performs one bounded GET. Failures propagate safely;
  // neither an automatic retry nor stale cached records can enter the result.
  const result=await discoverCreator(handle);
  if(result.creator){creatorsRefreshed++;current.push(...result.records);}
  else unavailable++;
 }
 const seen=new Set();
 const records=searchRecords(current,query.trim()).filter(record=>{
  if(seen.has(record.id))return false;
  seen.add(record.id);return true;
 }).slice(0,limit);
 return {records,provider:'indexed-public-profile-refresh',creatorsRefreshed,fetchedAt:new Date().toISOString(),
  notice:`${coverage}${!handles.length?' No indexed creators matched this query.':''}${unavailable?` ${unavailable} selected public profile${unavailable===1?' is':'s are'} unavailable; no cached videos were substituted.`:''}`};
}
