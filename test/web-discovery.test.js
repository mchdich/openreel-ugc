import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../lib/api.js';

const module=await import('../lib/web-discovery.js').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const discover=(...args)=>{assert.equal(typeof module.discoverWebCreators,'function','verified web creator discovery must exist');return module.discoverWebCreators(...args);};
const env={OPENREEL_WEB_DISCOVERY:'true',OPENAI_API_KEY:'provider-test-secret',OPENAI_MODEL:'gpt-5.4-mini'};
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json',...headers}});
const candidate=(handle)=>({handle,sourceUrl:`https://creators.example/${handle}`});
const output=(candidates,extra={})=>({id:'resp-fixture',status:'completed',model:'gpt-5.4-mini',output:[{type:'web_search_call',status:'completed',action:{type:'search',query:'controlled search',sources:candidates.map(c=>({type:'url',url:c.sourceUrl}))}},{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({candidates}),annotations:[]}]}],...extra});
function profile(handle,{bio='NYU\ncoffee\ncurrent@creator.example',followers=1200,count=2,base=1000,available=true,caption='Coffee tasting recipe'}={}){
 const node={isReady:available,isError:false,userInfo:{id:String(base),uniqueId:handle,nickname:handle,code:200,privateAccount:false,signature:bio,followerCount:followers},videoList:Array.from({length:count},(_,i)=>({id:String(base+i),desc:caption,privateItem:false,authorUniqueId:handle,playCount:50+i,coverUrl:'https://images.example/cover.jpg',playAddr:'https://media.example/never-download.mp4'}))};
 return new Response('<script id="__FRONTITY_CONNECT_STATE__">'+JSON.stringify({source:{data:{['/embed/@'+handle]:node}}})+'</script>',{headers:{'content-type':'text/html'}});
}
const withFetch=async(fn,run)=>{const old=globalThis.fetch;globalThis.fetch=fn;try{return await run();}finally{globalThis.fetch=old;}};
const corpus=handles=>({search:async()=>handles.map(handle=>({id:'old-'+handle,handle:'@'+handle,demo:false,bio:'stale contact old@creator.example',followers:99999})),upsert(){throw new Error('Acquisition must not write directly.');}});
const post=(body,headers={},host='http://localhost')=>new Request(host+'/api/videos/discover',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});

// External transport fixtures test eligibility and boundaries, never real discovery quality.
test('web candidates and indexed seeds require current official evidence for every compound constraint',async()=>{
 const candidates=['newcampus','wrongschool','lowfollowers'].map(candidate);let providerCalls=0;const gets=[];
 await withFetch(async(url,init)=>{
  if(String(url).endsWith('/responses')){providerCalls++;const body=JSON.parse(init.body);assert.deepEqual(JSON.parse(body.input),{query:'Find coffee creators at NYU with at least 1000 followers and email in bio',excludeHandles:['seedcampus']});assert.equal(body.tools[0].type,'web_search');assert.equal(body.max_tool_calls,1);return json(output(candidates));}
  const handle=new URL(url).pathname.split('@')[1];gets.push(handle);assert.equal(init.headers.authorization,undefined);assert.equal(init.redirect,'error');
  return profile(handle,{base:{seedcampus:1000,newcampus:2000,wrongschool:3000,lowfollowers:4000}[handle],...(handle==='wrongschool'?{bio:'UCLA\ncoffee\ncurrent@creator.example'}:{}),...(handle==='lowfollowers'?{followers:999}:{})});
 },async()=>{
  const result=await discover('Find coffee creators at NYU with at least 1000 followers and email in bio',{},env,corpus(['seedcampus']));
  assert.deepEqual(result.records.map(r=>r.handle).sort(),['@newcampus','@seedcampus']);assert.ok(result.records.every(r=>r.followers===1200&&r.email==='current@creator.example'&&r.sourceType==='tiktok-creator-embed'));
  assert.equal(providerCalls,1);assert.deepEqual(gets.sort(),['lowfollowers','newcampus','seedcampus','wrongschool']);assert.equal(result.provider,'web-assisted-public-profile-verification');assert.equal(result.creatorsRefreshed,4);assert.equal(result.webSearchCalls,1);assert.match(result.notice,/limited|bounded/i);assert.doesNotMatch(JSON.stringify(result),/old@creator|never-download|provider-test-secret/);
 });
});

test('missing followers and caption-only contact details cannot satisfy fresh profile constraints',async()=>{
 for(const settings of [{followers:null},{bio:'NYU\ncoffee',caption:'Coffee contact caption@example.com'}])await withFetch(async(url)=>String(url).endsWith('/responses')?json(output([candidate('newperson')])):profile('newperson',settings),async()=>{
  const result=await discover('Find coffee creators at NYU with at least 1000 followers and email in bio',{},env);assert.deepEqual(result.records,[]);
 });
});

test('creator topics require public identity evidence or repeated relevant posts rather than one incidental caption',async()=>{
 const candidates=['barista','pets','drinks'].map(candidate);
 await withFetch(async(url)=>{
  if(String(url).endsWith('/responses'))return json(output(candidates));
  const handle=new URL(url).pathname.split('@')[1];
  if(handle==='barista')return profile(handle,{base:1000,bio:'I make coffee videos',caption:'My new book',count:1});
  if(handle==='pets')return profile(handle,{base:2000,bio:'Cute dog adventures',caption:'Coffee and cuddles',count:1});
  return profile(handle,{base:3000,bio:'Making drinks at home',caption:'Coffee brewing technique',count:3});
 },async()=>{
  const result=await discover('Find coffee creators',{},env);
  assert.deepEqual(result.records.map(record=>record.handle),['@barista','@drinks']);
 });
 // A topic-video query can still find the actual relevant clip without claiming
 // that an occasional caption establishes the account's content niche.
 await withFetch(async(url)=>String(url).endsWith('/responses')?json(output([candidate('pets')])):profile('pets',{bio:'Cute dog adventures',caption:'Coffee and cuddles',count:1}),async()=>{
  const result=await discover('Find coffee videos',{},env);
  assert.deepEqual(result.records.map(record=>record.handle),['@pets']);
 });
});

test('one repeated topic among a mostly unrelated public selection does not establish a creator niche',async()=>{
 const response=()=>{
  const selected=profile('pets',{bio:'Cute dog adventures',caption:'Coffee and cuddles',count:6});
  return selected.text().then(html=>new Response(html.replace(/Coffee and cuddles/g,()=>++mentions<=2?'Coffee and cuddles':'Cute dog at the park'),{headers:{'content-type':'text/html'}}));
 };
 let mentions=0;
 await withFetch(async(url)=>String(url).endsWith('/responses')?json(output([candidate('pets')])):response(),async()=>{
  const result=await discover('Find coffee creators',{},env);assert.deepEqual(result.records,[]);
 });
});

test('discovery checks at most six unique profiles with at most three concurrent public GETs and thirty output videos',async()=>{
 const candidates=['fourth','fifth','sixth'].map(candidate);let active=0,maximum=0;const gets=[];
 await withFetch(async(url)=>{
  if(String(url).endsWith('/responses'))return json(output(candidates));
  const handle=new URL(url).pathname.split('@')[1];gets.push(handle);const base=1000*(gets.length);active++;maximum=Math.max(maximum,active);await new Promise(r=>setTimeout(r,2));active--;return profile(handle,{count:20,base});
 },async()=>{
  const result=await discover('coffee videos',{limit:999},env,corpus(['first','second','third','extra']));
  assert.equal(gets.length,6);assert.equal(new Set(gets).size,6);assert.ok(maximum<=3);assert.equal(result.records.length,30);assert.equal(new Set(result.records.map(r=>r.id)).size,30);
 });
});

test('unattributed model guesses never trigger profile requests while sourced candidates can proceed',async()=>{
 const sourced=candidate('realcandidate'),guess={handle:'guessed',sourceUrl:'https://not-searched.example/guess'};const body=output([sourced,guess]);body.output[0].action.sources=[{type:'url',url:sourced.sourceUrl}];const gets=[];
 await withFetch(async(url)=>{if(String(url).endsWith('/responses'))return json(body);gets.push(String(url));return profile('realcandidate');},async()=>{
  const result=await discover('coffee',{},env);assert.ok(result.records.length>0);assert.deepEqual(gets,['https://www.tiktok.com/embed/@realcandidate']);assert.equal(result.candidatesRejected,1);
 });
});

test('empty web results do not manufacture profiles or stale records',async()=>{
 let calls=0;await withFetch(async(url)=>{calls++;assert.ok(String(url).endsWith('/responses'));return json(output([]));},async()=>{
  const result=await discover('an unknown topic',{},env);assert.deepEqual(result.records,[]);assert.equal(result.creatorsRefreshed,0);assert.equal(calls,1);
 });
});

test('one explicitly missing profile does not discard independently verified matches',async()=>{
 const gets=[];
 await withFetch(async(url)=>{
  if(String(url).endsWith('/responses'))return json(output(['available','gone'].map(candidate)));
  const handle=new URL(url).pathname.split('@')[1];gets.push(handle);
  return handle==='gone'?new Response('Unavailable',{status:404}):profile(handle);
 },async()=>{
  const result=await discover('coffee creators',{},env);
  assert.deepEqual(result.records.map(r=>r.handle),['@available']);
  assert.equal(result.profilesChecked,2);assert.equal(result.creatorsRefreshed,1);
  assert.match(result.notice,/1 public profile was unavailable/);
  assert.deepEqual(gets.sort(),['available','gone']);
 });
});

test('public access barriers and malformed responses remain errors rather than skipped profiles',async()=>{
 for(const response of [()=>new Response('Forbidden',{status:403}),()=>new Response('Rate limited',{status:429}),()=>new Response('<html>Login required</html>',{headers:{'content-type':'text/html'}})]){
  let gets=0;
  await withFetch(async(url)=>{if(String(url).endsWith('/responses'))return json(output([candidate('newperson')]));gets++;return response();},async()=>{
   await assert.rejects(discover('coffee',{},env),error=>error.status===502);
   assert.equal(gets,1);
  });
 }
});

test('a failed profile batch preserves confirmed matches and reports partial coverage without retry',async()=>{
 const gets=[];let providerCalls=0;
 await withFetch(async(url)=>{
  if(String(url).endsWith('/responses')){providerCalls++;return json(output(['available','blocked'].map(candidate)));}
  const handle=new URL(url).pathname.split('@')[1];gets.push(handle);
  return handle==='blocked'?new Response('Forbidden',{status:403}):profile(handle);
 },async()=>{
  const result=await discover('Find coffee creators',{},env);
  assert.deepEqual(result.records.map(record=>record.handle),['@available']);
  assert.equal(result.incomplete,true);assert.equal(result.profilesFailed,1);
  assert.equal(result.profilesChecked,2);assert.equal(result.creatorsRefreshed,1);
  assert.match(result.notice,/partial results/i);assert.match(result.notice,/no further profiles/i);
  assert.equal(providerCalls,1);assert.deepEqual(gets.sort(),['available','blocked']);
 });
});

test('a failed indexed-profile batch prevents the proposed-profile batch while retaining valid fresh seed evidence',async()=>{
 const gets=[];
 await withFetch(async(url)=>{
  if(String(url).endsWith('/responses'))return json(output([candidate('must_not_fetch')]));
  const handle=new URL(url).pathname.split('@')[1];gets.push(handle);
  return handle==='blocked'?new Response('Rate limited',{status:429}):profile(handle);
 },async()=>{
  const result=await discover('Find coffee creators',{},env,corpus(['available','blocked']));
  assert.deepEqual(result.records.map(record=>record.handle),['@available']);
  assert.equal(result.incomplete,true);assert.equal(result.profilesFailed,1);
  assert.equal(result.profilesChecked,2);assert.deepEqual(gets.sort(),['available','blocked']);
 });
});

test('searched URLs are global proposal context and never a verified handle-to-page attribution',async()=>{
 const proposed={handle:'available',sourceUrl:'https://another-creator.example/about'};
 await withFetch(async(url)=>String(url).endsWith('/responses')?json(output([proposed])):profile('available'),async()=>{
  const result=await discover('coffee creators',{},env);
  assert.deepEqual(result.records.map(r=>r.handle),['@available']);
  assert.equal(result.records[0].authorUrl,'https://www.tiktok.com/@available');
  assert.equal(result.discoverySources,undefined);
  assert.deepEqual(result.webSearchSources,[proposed.sourceUrl]);
  assert.match(result.notice,/model proposed handles using web-search context/i);
 });
});

test('a completed response may contain an unexecuted search attempt after the provider tool limit',async()=>{
 const good=candidate('available'),pending=candidate('unexecuted');
 const body=output([good,pending]);
 body.output[0].action.sources=[{url:good.sourceUrl}];
 body.output.splice(1,0,{type:'web_search_call',status:'searching',action:{type:'search',query:'unused search',sources:[{url:pending.sourceUrl}]}});
 const gets=[];
 await withFetch(async(url)=>{if(String(url).endsWith('/responses'))return json(body);gets.push(String(url));return profile('available');},async()=>{
  const result=await discover('Find coffee creators',{},env);
  assert.deepEqual(result.records.map(record=>record.handle),['@available']);
  assert.equal(result.webSearchCalls,1);assert.equal(result.candidatesRejected,1);
  assert.deepEqual(result.webSearchSources,[good.sourceUrl]);
  assert.deepEqual(gets,['https://www.tiktok.com/embed/@available']);
 });
});

test('invalid provider structures, refusals, excess search calls and incomplete replies remain explicit errors',async()=>{
 const noSearch=output([candidate('newperson')]);noSearch.output.shift();
 const extraSearch=output([candidate('newperson')]);extraSearch.output.unshift(extraSearch.output[0]);
 const fields=output([candidate('newperson')]);fields.output[1].content[0].text=JSON.stringify({candidates:[{...candidate('newperson'),email:'invented@example.com'}]});
 const refusal=output([]);refusal.output[1].content=[{type:'refusal',refusal:'refused'}];
 for(const body of [noSearch,extraSearch,fields,refusal,output([],{status:'incomplete'}),output(Array.from({length:4},(_,i)=>candidate('person'+i)))]){
  let calls=0;await withFetch(async(url)=>{calls++;assert.ok(String(url).endsWith('/responses'));return json(body);},async()=>{await assert.rejects(discover('coffee',{},env),e=>e.status===502&&e.code==='WEB_DISCOVERY_INVALID_RESPONSE'&&!e.message.includes('provider-test-secret'));assert.equal(calls,1);});
 }
});

test('disabled discovery, invalid inputs and unsafe provider configuration make no external request',async()=>{
 await withFetch(async()=>{throw new Error('Unexpected request');},async()=>{
  for(const settings of [{},{...env,OPENREEL_WEB_DISCOVERY:'false'},{...env,OPENAI_API_KEY:''}])await assert.rejects(discover('coffee',{},settings),e=>e.status===503);
  for(const query of ['',null,'x'.repeat(1001)])await assert.rejects(discover(query,{},env),e=>e.status===400);
  await assert.rejects(discover('coffee',{limit:0},env),e=>e.status===400);
  for(const base of ['http://public.example/v1','https://user:pass@public.example/v1','https://public.example/v1?key=secret'])await assert.rejects(discover('coffee',{}, {...env,OPENAI_BASE_URL:base}),e=>e.status===503);
 });
});

test('provider HTTP failures, oversized replies and timeouts are secret-free and never automatically retried',async()=>{
 for(const [response,status] of [[()=>json({error:'provider-test-secret'},429),502],[()=>json({},200,{'content-length':'200000'}),502],[()=>{throw new DOMException('provider-test-secret','TimeoutError');},504]]){
  let calls=0;await withFetch(async()=>{calls++;return response();},async()=>{await assert.rejects(discover('coffee',{},env),e=>e.status===status&&!e.message.includes('provider-test-secret'));assert.equal(calls,1);});
 }
});

test('public web discovery is bearer-protected before any paid or profile request',async()=>{
 const settings={...env,OPENREEL_API_TOKEN:'owner-token'};let calls=0;
 await withFetch(async()=>{calls++;throw new Error('Must not call providers');},async()=>{
  assert.equal((await handleApi(post({query:'coffee'},{},'https://public.example'),settings)).status,401);
  assert.equal((await handleApi(post({query:'coffee'},{authorization:'Bearer wrong'},'https://public.example'),settings)).status,401);
  assert.equal((await handleApi(post({query:'coffee'},{authorization:'Bearer owner-token',origin:'https://foreign.example'},'https://public.example'),settings)).status,403);
  assert.equal(calls,0);
 });
 const status=await handleApi(new Request('http://localhost/api/status'),settings);assert.equal((await status.json()).webDiscoveryConfigured,true);
});

test('the discovery API persists only independently verified matching official records',async()=>{
 const stored=[];const index={search:async()=>[],upsert:async(records,options)=>{stored.push({records,options});return {changed:records.length};}};
 await withFetch(async(url)=>String(url).endsWith('/responses')?json(output(['newperson','blocked'].map(candidate))):String(url).endsWith('@blocked')?new Response('Forbidden',{status:403}):profile('newperson'),async()=>{
  const response=await handleApi(post({query:'Find coffee creators at NYU with at least 1000 followers and email in bio'}),{...env,OPENREEL_CORPUS:index});assert.equal(response.status,200);const body=await response.json();assert.equal(body.provider,'web-assisted-public-profile-verification');assert.equal(body.incomplete,true);assert.equal(body.profilesFailed,1);assert.match(body.notice,/partial results/i);assert.equal(body.records.length,1);assert.equal(stored.length,1);assert.equal(stored[0].options.kind,'real');assert.equal(stored[0].options.verification,'provider-observed');assert.equal(stored[0].records[0].bio,'NYU\ncoffee\ncurrent@creator.example');assert.equal(stored[0].records[0].sourceType,'tiktok-creator-embed');
 });
});

test('compound creator topics combine explicit bio terms with recurrent post terms while preserving school/contact filters',async()=>{
 const candidates=['splitbio','sporadic','wrongschool'].map(candidate);
 await withFetch(async url=>{
  if(String(url).endsWith('/responses'))return json(output(candidates));
  const handle=new URL(url).pathname.split('@')[1],base={splitbio:41000,sporadic:42000,wrongschool:43000}[handle];
  const response=profile(handle,{base,bio:`${handle==='wrongschool'?'UCLA':'NYU'}\nBuild strength with me\ncoach@creator.example`,caption:'Training session',count:4});
  const html=await response.text();let seen=0;
  return new Response(html.replace(/Training session/g,()=>++seen<=(handle==='sporadic'?1:2)?'Training session':'My daily meal'),{headers:{'content-type':'text/html'}});
 },async()=>{
  const result=await discover('Find strength training creators at NYU with at least 1,000 followers and email in bio',{},env);
  assert.deepEqual(result.records.map(r=>r.handle),['@splitbio']);assert.ok(result.records.every(r=>r.bio.includes('Build strength')&&r.caption==='Training session'&&r.followers===1200&&r.email==='coach@creator.example'&&r.school==='New York University'));
 });
});
