import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRecords,research,researchQuery,searchPlan} from '../public/engine.js';
import {handleApi} from '../lib/api.js';
const question='Analyze cooking hooks across creators. Cite five source videos and suggest three openings for a 20-second recipe video.';
const records=normalizeRecords([
 {id:'cook',handle:'cook',caption:'Cooking pasta',transcript:'Make creamy pasta in one pan.',niche:'cooking',views:1000},
 {id:'cook-again',handle:'cook',caption:'Cooking rice',transcript:'Make rice in one pot.',niche:'cooking',views:800},
 {id:'other',handle:'other',caption:'Gaming setup',views:900}
]);
const request=body=>new Request('http://localhost/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
test('hook research across creators ignores citation and writing directions during retrieval',()=>{
 assert.deepEqual(searchPlan(question).terms,['cooking']);
 const result=research(records,question);
 assert.equal(result.kind,'research');
 assert.deepEqual(result.sources.map(r=>r.id),['cook','cook-again']);
});
test('creative brief followups retain the original topic before corpus retrieval',async()=>{
 let retrieved;
 const corpus={search:(q)=>{retrieved=q;return q.includes('cooking')?records:[];},stats:()=>({total:3})};
 const history=[{role:'user',content:question},{role:'assistant',content:'Cooking hook research.'}];
 const response=await handleApi(request({question:'Turn this into a creative brief with hooks and a shot list',history,corpus:true,records:[]}),{OPENREEL_CORPUS:corpus});
 const result=await response.json();
 assert.match(retrieved,/cooking/);
 assert.deepEqual(result.sources.map(r=>r.id),['cook','cook-again']);
 assert.ok(result.sections.some(s=>/shot list/i.test(s.heading)));
 assert.doesNotMatch(result.summary,/cannot fetch/);
});
test('another writing followup keeps research constraints through multiple turns',()=>{
 const history=[{role:'user',content:'Find cooking creators with at least 1000 followers'},{role:'assistant',content:'Results'},{role:'user',content:'Turn this into a creative brief with hooks and a shot list'},{role:'assistant',content:'Brief'}];
 assert.match(researchQuery('Write three alternative opening lines',history),/cooking creators with at least 1000 followers/);
});
test('creator discovery still applies constraints while hook comparisons remain research',()=>{
 const result=research(records,'Find cooking creators');
 assert.equal(result.kind,'creators');assert.deepEqual(result.creators.map(r=>r.id),['cook']);
 assert.equal(research(records,'Compare cooking hooks across creators').kind,'research');
 assert.equal(research(records,'Find cooking hooks across creators').kind,'research');
});
test('current-week trend requests cannot rewrite archival patterns as current evidence',async()=>{
 const response=await handleApi(request({question:'What cooking video formats are trending this week?',records:[{id:'old',handle:'old',caption:'Cooking pasta',format:'Unboxing',postedAt:'2024-07-10'}]}));
 const result=await response.json();
 assert.equal(result.temporal?.windowDays,7);
 assert.deepEqual(result.sources,[]);
 assert.match(result.summary,/no dated records/i);
});
test('GPT-5 text synthesis reaches the provider without incompatible legacy controls',async t=>{
 t.mock.method(globalThis,'fetch',async(_url,init)=>{
  const body=JSON.parse(init.body);
  if(body.max_tokens!==undefined||body.temperature!==undefined||!body.max_completion_tokens)return new Response('{}',{status:400});
  return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({summary:'Cooking source research.',sections:[{heading:'Cooking',text:'Proposed opening based on the supplied cooking transcript.',sourceIds:['cook']}]})}}]}));
 });
 const response=await handleApi(request({question:'Analyze cooking hooks',records}),{OPENAI_API_KEY:'test-only',OPENAI_MODEL:'gpt-5.4-mini'});
 const result=await response.json();assert.equal(result.mode,'ai');assert.equal(result.sections[0].sourceIds[0],'cook');
});
test('creator synthesis includes the actual bio, school, dates and profile evidence',async t=>{
 const source={id:'ucla',handle:'campus',caption:'Cooking pasta',school:'UCLA',location:'Los Angeles',bio:'UCLA alumna',followers:2000,postedAt:'2025-01-02',profileEvidence:{url:'https://www.tiktok.com/@campus',fetchedAt:'2026-10-17T12:00:00Z',school:{value:'UCLA',source:'public-bio-self-description',text:'UCLA alumna'}}};
 let supplied;
 t.mock.method(globalThis,'fetch',async(_url,init)=>{
  supplied=JSON.parse(JSON.parse(init.body).messages.at(-1).content).sources[0];
  return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({summary:'One creator with a public-bio self-description.',sections:[]})}}]}));
 });
 const result=await(await handleApi(request({question:'Find UCLA creators',records:[source]}),{OPENAI_API_KEY:'test-only'})).json();
 assert.equal(result.mode,'ai');assert.equal(supplied.school,'UCLA');assert.equal(supplied.bio,'UCLA alumna');assert.equal(supplied.location,'Los Angeles');assert.equal(supplied.postedAt,'2025-01-02');assert.equal(supplied.profileEvidence.school.text,'UCLA alumna');
});
test('bounded synthesis retains available media evidence beyond the first twenty hits',async t=>{
 const records=Array.from({length:22},(_,i)=>({id:'cook'+i,handle:'cook'+i,caption:'Cooking pasta',...(i===21?{thumbnail:'https://example.com/cover.jpg'}:{})}));
 let supplied;
 t.mock.method(globalThis,'fetch',async(_url,init)=>{
  supplied=JSON.parse(JSON.parse(init.body).messages.at(-1).content).sources;
  return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({summary:'Cooking examples.',sections:[{heading:'Example',text:'A cooking caption.',sourceIds:['cook21']}]})}}]}));
 });
 const result=await(await handleApi(request({question:'Analyze cooking hooks',records}),{OPENAI_API_KEY:'test-only'})).json();
 assert.equal(result.mode,'ai');assert.equal(result.sources.length,22);assert.equal(supplied.length,20);assert.equal(supplied[0].id,'cook21');assert.equal(supplied[0].previewAvailable,true);
});
test('citation cleanup preserves required creator email filters',()=>{
 const records=normalizeRecords([{id:'yes',handle:'yes',caption:'Cooking pasta',email:'yes@example.com'},{id:'no',handle:'no',caption:'Cooking pasta'}]);
 const result=research(records,'Find cooking creators and include only those with public emails');
 assert.deepEqual(result.sources.map(r=>r.id),['yes']);
});
test('an explicit new writing topic replaces the previous research topic',()=>{
 const history=[{role:'user',content:'Analyze cooking hooks across creators'}];
 const query=researchQuery('Write three hooks for beauty',history);
 assert.doesNotMatch(query,/cooking/);
 const result=research(normalizeRecords([{id:'beauty',handle:'beauty',caption:'Beauty routine'},{id:'cook',handle:'cook',caption:'Cooking pasta'}]),'Write three hooks for beauty',history);
 assert.deepEqual(result.sources.map(r=>r.id),['beauty']);
});
test('a brief after dated trends keeps retrieval dates without repeating the trend comparison',async()=>{
 const day=new Date().toISOString().slice(0,10);const records=[{id:'cook',handle:'cook',caption:'Cooking pasta',transcript:'Make pasta in one pan.',format:'Tutorial',postedAt:day}];
 const searches=[];const corpus={search:(query,options)=>{searches.push({query,options});return records;},stats:()=>({total:1})};
 const response=await handleApi(request({question:'Turn this into a creative brief with hooks and a shot list',history:[{role:'user',content:'What cooking video formats are trending this week?'}],corpus:true,records:[]}),{OPENREEL_CORPUS:corpus});
 const result=await response.json();assert.equal(result.kind,'critique');assert.match(result.title,/brief/i);assert.ok(result.sections.some(s=>/shot list/i.test(s.heading)));assert.ok(searches.every(s=>s.options.postedFrom&&s.options.postedThrough));
});
test('corpus video research retains different videos from the same creator',async()=>{
 const {openCorpus}=await import('../lib/corpus.js');const corpus=openCorpus(':memory:');
 try{
  corpus.upsert([{id:'first',handle:'cook',caption:'Cooking pasta',url:'https://www.tiktok.com/@cook/video/7000000000000000001',sourceType:'test-fixture',fetchedAt:'2026-10-18T00:00:00Z'},{id:'second',handle:'cook',caption:'Cooking rice',url:'https://www.tiktok.com/@cook/video/7000000000000000002',sourceType:'test-fixture',fetchedAt:'2026-10-18T00:00:00Z'}],{kind:'real'});
  const result=await(await handleApi(request({question,corpus:true,records:[]}),{OPENREEL_CORPUS:corpus})).json();
  assert.equal(result.kind,'research');assert.equal(result.sources.length,2);
 }finally{corpus.close();}
});

test('sampled-frame questions search the named clip and preserve separate profile constraints',async()=>{
 const question='In the Fleur de Sel coffee clip, what do the sampled frames actually show? Distinguish visible objects from any action that is not established. Cite the source.';
 const clip=normalizeRecords([{id:'salt',handle:'brewer',url:'https://www.tiktok.com/@brewer/video/7000000000000000011',sourceType:'test-fixture',fetchedAt:'2026-10-18T00:00:00Z',caption:'Coffee',visualDescription:'A hand holds a canister labeled Fleur de Sel near the mug; adding its contents is not established.',descriptionSource:'user-supplied',followers:2000,school:'UCLA',email:'brewer@example.com',bio:'UCLA brewer brewer@example.com'}])[0];
 const plan=searchPlan(question);assert.deepEqual(plan.filters,{});assert.deepEqual(plan.terms,['fleur','de','sel','coffee']);assert.deepEqual(research([clip],question).sources.map(r=>r.id),['salt']);
 const constrained='In the Fleur de Sel coffee clip, what do the sampled frames actually show? Only UCLA creators with at least 1000 followers and email in bio.';
 const strict=searchPlan(constrained);assert.equal(strict.filters.school,'ucla');assert.equal(strict.filters.minFollowers,1000);assert.equal(strict.filters.emailInBio,true);
 const {openCorpus}=await import('../lib/corpus.js');const corpus=openCorpus(':memory:');try{corpus.upsert([clip],{kind:'real'});const result=await(await handleApi(request({question,records:[],corpus:true}),{OPENREEL_CORPUS:corpus})).json();assert.deepEqual(result.sources.map(r=>r.id),['salt']);assert.equal(result.sources[0].visualDescription,clip.visualDescription);}finally{corpus.close();}
});

test('evidence instructions cannot discard profile constraints in their own sentence',()=>{
 const question='In the Fleur de Sel coffee clip, what do the sampled frames actually show? Distinguish visible objects from inferred actions, using only UCLA creators with at least 1000 followers and email in bio.';
 const records=normalizeRecords([{id:'eligible',handle:'eligible',caption:'Fleur de Sel coffee',school:'UCLA',followers:2000,email:'yes@example.com',bio:'UCLA yes@example.com'},{id:'excluded',handle:'excluded',caption:'Fleur de Sel coffee',school:'Yale',followers:5}]);
 for(const q of [question,question.replace(', using only',' using only')]){const plan=searchPlan(q);assert.equal(plan.filters.school,'ucla');assert.equal(plan.filters.minFollowers,1000);assert.equal(plan.filters.emailInBio,true);assert.deepEqual(research(records,q).sources.map(r=>r.id),['eligible']);}
});

test('plain Make a brief followup produces a brief with hooks and proposed shots from the original sources',async()=>{
 const history=[{role:'user',content:question},{role:'assistant',content:'Cooking hook research.'}];
 const result=await(await handleApi(request({question:'Make a brief.',history,records}))).json();
 assert.equal(result.kind,'critique');assert.match(result.title,/creative brief/i);
 assert.deepEqual(result.sources.map(r=>r.id),['cook','cook-again']);
 assert.ok(result.sections.some(s=>/hooks to test/i.test(s.heading)));
 assert.ok(result.sections.some(s=>/shot list/i.test(s.heading)&&/suggestions|proposed/i.test(s.text)));
 assert.doesNotMatch(result.title,/your script/i);
});

test('mentioning a brief outside a writing request does not replace creator or research intent',()=>{
 assert.equal(research(records,'Find cooking creators that match my brief').kind,'creators');
 assert.equal(research(records,'Compare cooking creative brief examples').kind,'research');
});

test('explicit creative brief and shot-list requests retain the original research topic',()=>{
 const history=[{role:'user',content:question}];
 for(const request of ['Write a creative brief.','Give me a creative brief.','Make a shot list.','Create a shot list.','Make this into a creative brief.','Please write a creative brief.']){
  const result=research(records,request,history);assert.equal(result.kind,'critique',request);assert.match(result.title,/creative brief/i,request);assert.ok(result.sections.some(s=>/shot list/i.test(s.heading)),request);assert.deepEqual(result.sources.map(r=>r.id),['cook','cook-again'],request);
 }
});

test('a brevity instruction does not demand a new creative-brief deliverable',()=>{
 const result=research(records,'Make this brief.',[{role:'user',content:question}]);assert.notEqual(result.title,'Creative brief');assert.ok(!result.sections.some(s=>/shot list/i.test(s.heading)));assert.deepEqual(result.sources.map(r=>r.id),['cook','cook-again']);
});
