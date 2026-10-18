import test from 'node:test';
import assert from 'node:assert/strict';
const module=await import('../lib/live-post-metadata.js').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const enrich=(...args)=>{assert.equal(typeof module.enrichPublicPosts,'function');return module.enrichPublicPosts(...args);};
const env={OPENREEL_POST_METADATA:'true'};
const rows=(creators=4,posts=4)=>Array.from({length:creators},(_,c)=>Array.from({length:posts},(_,p)=>({id:`tiktok-${10000+c*100+p}`,handle:'@creator_'+c,creatorId:String(5000+c),url:`https://www.tiktok.com/@creator_${c}/video/${10000+c*100+p}`,caption:'Coffee from the public embed',bio:'NYU\npublic@creator.example',school:'New York University',email:'public@creator.example',followers:1500,views:100+p,unavailableMetrics:['likes','comments','shares'],postedAt:'',sourceType:'tiktok-creator-embed',fetchedAt:'2024-10-01T00:00:00Z',demo:false}))).flat();
const page=(row,extra={})=>new Response('<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">'+JSON.stringify({__DEFAULT_SCOPE__:{'webapp.video-detail':{statusCode:0,itemInfo:{itemStruct:{id:row.id.slice(7),privateItem:false,createTime:'1728000000',author:{id:row.creatorId,uniqueId:row.handle.slice(1),privateAccount:false,signature:'NYU\ncoffee\ncurrent@creator.example'},authorStats:{followerCount:1200},stats:{playCount:0,shareCount:0},desc:'Fresh coffee caption',...extra}}}}})+'</script>',{headers:{'content-type':'text/html'}});
async function withFetch(fn,run){const old=globalThis.fetch;globalThis.fetch=fn;try{return await run();}finally{globalThis.fetch=old;}}

test('opt-out makes no request; enabled validation rejects unbounded inputs before fetching',async()=>{
 await withFetch(async()=>assert.fail('Unexpected metadata request'),async()=>{
  const input=rows();assert.deepEqual(await enrich(input,{}),{records:input});
  await assert.rejects(enrich(rows(7,20),env),e=>e.status===400);
  await assert.rejects(enrich(null,env),e=>e.status===400);
  const invalid=rows(1,1).map(r=>({...r,url:'https://evil.example/x'}));const result=await enrich(invalid,env);assert.equal(result.postMetadata.checked,0);assert.deepEqual(result.records,invalid);
 });
});
test('six explicit page checks cover creators first, cap concurrency at three and never mutate source records',async()=>{
 const input=rows(),before=JSON.stringify(input),calls=[];let active=0,max=0;
 await withFetch(async(url,init)=>{calls.push(url);active++;max=Math.max(max,active);assert.equal(init.redirect,'error');assert.equal(init.headers.authorization,undefined);await new Promise(r=>setTimeout(r,2));active--;return page(input.find(r=>r.url===url));},async()=>{
  const result=await enrich(input,env);assert.equal(calls.length,6);assert.equal(new Set(calls).size,6);assert.equal(max,3);assert.equal(new Set(calls.slice(0,4).map(url=>new URL(url).pathname.split('/')[1])).size,4);assert.deepEqual(calls.slice(0,4),[10003,10103,10203,10303].map((id,c)=>`https://www.tiktok.com/@creator_${c}/video/${id}`));
  assert.equal(result.postMetadata.checked,6);assert.equal(result.postMetadata.enriched,6);assert.equal(result.postMetadata.dated,6);assert.equal(result.postMetadata.candidateRecords,16);assert.equal(result.postMetadata.notAttempted,0);assert.equal(JSON.stringify(input),before);assert.equal(result.records.length,input.length);
  assert.ok(result.records.slice(0,6).every(r=>r.sourceType==='tiktok-public-post'&&r.postedAt==='2024-10-04T00:00:00.000Z'&&r.views===0&&r.followers===1200));assert.match(result.notice,/bounded|selected/i);
 });
});
test('source and creator binding reject an unrelated public author, without mixing new fields into the old record',async()=>{
 const input=rows(1,1);await withFetch(async()=>page(input[0],{author:{id:'999',uniqueId:'unrelated',privateAccount:false}}),async()=>{
  const result=await enrich(input,env);assert.equal(result.postMetadata.failed,1);assert.equal(result.postMetadata.enriched,0);assert.deepEqual(result.records,input);assert.equal(result.postMetadata.incomplete,true);
 });
});
test('a failed batch stops all later page calls, preserves confirmed sources and never retries',async()=>{
 const input=rows(4,4);const calls=[];
 await withFetch(async url=>{calls.push(url);if(calls.length===2)return new Response('upstream-secret',{status:403});return page(input.find(r=>r.url===url));},async()=>{
  const result=await enrich(input,env);assert.equal(calls.length,3);assert.equal(result.postMetadata.checked,3);assert.equal(result.postMetadata.enriched,2);assert.equal(result.postMetadata.failed,1);assert.equal(result.postMetadata.notAttempted,3);assert.equal(result.postMetadata.incomplete,true);assert.equal(result.records.length,input.length);assert.doesNotMatch(JSON.stringify(result),/upstream-secret/);
 });
});
test('404 metadata stays unavailable while later selected sources can be checked; no data is fabricated',async()=>{
 const input=rows(4,4);let calls=0;await withFetch(async url=>++calls===1?new Response('',{status:404}):page(input.find(r=>r.url===url)),async()=>{
  const result=await enrich(input,env);assert.equal(calls,6);assert.equal(result.postMetadata.unavailable,1);assert.equal(result.postMetadata.enriched,5);assert.equal(result.postMetadata.dated,5);assert.equal(result.postMetadata.failed,0);assert.equal(result.records.find(r=>r.id==='tiktok-10003').postedAt,'');
 });
});
test('no metadata requests follow a profile failure, and unknown dates/counts remain unknown',async()=>{
 const input=rows(1,2);await withFetch(async()=>assert.fail('No post requests after failed profile batch'),async()=>{const result=await enrich(input,env,{skip:true});assert.equal(result.postMetadata.checked,0);assert.equal(result.postMetadata.incomplete,true);assert.equal(result.postMetadata.notAttempted,2);assert.match(result.notice,/profile/i);});
 await withFetch(async url=>page(input.find(r=>r.url===url),{createTime:undefined,stats:{}}),async()=>{const result=await enrich(input,env);assert.equal(result.postMetadata.dated,0);assert.ok(result.records.every(r=>r.postedAt===''&&r.unavailableMetrics.includes('views')));});
});
test('shared deadline signal reaches every page request and source duplicates never inflate checks',async()=>{
 const input=rows(1,2);let calls=0;await withFetch(async(url,init)=>{calls++;assert.ok(init.signal instanceof AbortSignal);return page(input.find(r=>r.url===url));},async()=>{
  const result=await enrich([...input,input[0]],env);assert.equal(calls,2);assert.equal(result.postMetadata.checked,2);
 });
});

test('one attributed profile snapshot updates unchecked posts without inventing their dates or video metrics',async()=>{
 const input=rows(1,8),before=JSON.stringify(input);await withFetch(async url=>page(input.find(r=>r.url===url),{authorStats:{followerCount:999},author:{id:'5000',uniqueId:'renamed_creator',privateAccount:false,signature:'UCLA\nCoffee creator'}}),async()=>{
  const result=await enrich(input,env);assert.equal(result.postMetadata.enriched,6);assert.ok(result.records.every(r=>r.followers===999&&r.school==='University of California, Los Angeles'&&r.email===''&&r.handle==='@renamed_creator'));assert.equal(JSON.stringify(input),before);
  const uninspected=result.records.find(r=>r.id==='tiktok-10000');assert.equal(uninspected.sourceType,'tiktok-public-profile-and-post');assert.equal(uninspected.postedAt,'');assert.equal(uninspected.views,100);assert.equal(uninspected.caption,input[0].caption);assert.ok(uninspected.profileEvidence.url.includes('/video/'));assert.equal(new Set(result.records.map(r=>JSON.stringify(r.profileEvidence))).size,1);
 });
});

test('numeric identity learned from an inspected post binds all same-handle embed records',async()=>{
 const input=rows(1,8).map(r=>({...r,creatorId:''}));await withFetch(async url=>page({...input.find(r=>r.url===url),creatorId:'5000'}),async()=>{
  const result=await enrich(input,env);assert.ok(result.records.every(r=>r.creatorId==='5000'));assert.equal(new Set(result.records.map(r=>r.creatorId)).size,1);
 });
});

test('one shared20-second deadline is composed with each10-second GET and abort stops the next batch',async t=>{
 const input=rows(),shared=new AbortController(),budgets=[],combinations=[];const realAny=AbortSignal.any.bind(AbortSignal);
 t.mock.method(AbortSignal,'timeout',ms=>{budgets.push(ms);return ms===20000?shared.signal:new AbortController().signal;});
 t.mock.method(AbortSignal,'any',signals=>{combinations.push(signals);return realAny(signals);});
 let calls=0;await withFetch(async()=>{calls++;shared.abort();throw new DOMException('Deadline','AbortError');},async()=>{
  const result=await enrich(input,env);assert.equal(calls,3);assert.equal(result.postMetadata.checked,3);assert.equal(result.postMetadata.failed,3);assert.equal(result.postMetadata.notAttempted,3);assert.deepEqual(budgets,[20000,10000,10000,10000]);assert.ok(combinations.every(signals=>signals[0]===shared.signal));
 });
});

test('a renamed profile keeps every accepted canonical post URL consistent and corpus-persistable',async()=>{
 const input=rows(1,2);await withFetch(async url=>page(input.find(r=>r.url===url),{author:{id:'5000',uniqueId:url.endsWith('10001')?'old_name':'new_name',privateAccount:false,signature:'Coffee creator'}}),async()=>{
  const result=await enrich(input,env);for(const record of result.records)assert.ok(record.url.includes('/'+record.handle+'/video/'),record.id);
  const {openCorpus}=await import('../lib/corpus.js');const db=openCorpus(':memory:');try{assert.doesNotThrow(()=>db.upsert(result.records,{kind:'real',source:'controlled rename regression',verification:'provider-observed'}));}finally{db.close();}
 });
});
