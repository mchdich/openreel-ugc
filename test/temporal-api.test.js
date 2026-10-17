import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../lib/api.js';
const request=(body,path='/api/chat')=>new Request('http://temporal-api.example'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
function samples(){
 const result=[];
 for(const [prefix,day,count] of [['current','2024-07-20',6],['prior','2024-07-10',1]])for(let i=0;i<count;i++)result.push({id:prefix+i,creatorId:String(500+i%3),handle:'',caption:'Skincare demonstration',postedAt:day,format:'Unboxing',views:100,archiveProvenance:{dataset:'Actual source test fixture',license:'CC-BY-NC-4.0',sourceUrl:'https://example.com/dataset'}});
 for(const [prefix,day] of [['other-current','2024-07-20'],['other-prior','2024-07-10']])for(let i=0;i<10;i++)result.push({id:prefix+i,handle:'other'+i,caption:'Skincare discussion',postedAt:day});
 result.push({id:'unrelated',handle:'food',caption:'Cooking demonstration',format:'Cooking',postedAt:'2024-07-20'});
 return result;
}
const question='What skincare formats are gaining share as of 2024-07-21 over 7 days?';
test('library dated momentum preserves topic filtering and deterministic counts with a configured provider',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('No provider should rewrite a dated comparison');};
 try{
  const response=await handleApi(request({question,records:samples()}),{OPENAI_API_KEY:'local-provider',OPENREEL_LOCAL_REQUEST:true});
  assert.equal(response.status,200);const result=await response.json();assert.equal(result.mode,'deterministic');assert.equal(calls,0);
  assert.equal(result.temporal.windows.current.recordCount,16);assert.equal(result.temporal.windows.prior.recordCount,11);assert.equal(result.temporal.groups[0].current.videoCount,6);assert.equal(result.temporal.groups[0].risingWithinSample,true);
  assert.ok(result.sources.every(record=>record.caption.includes('Skincare')));assert.match(result.notice,/CC-BY-NC-4.0/);assert.match(result.notice,/historical|as-of/i);
 }finally{globalThis.fetch=original;}
});
test('corpus dated momentum applies calendar bounds before retrieval and separates corpus totals',async()=>{
 const searched=[];const corpus={search:(query,options)=>{searched.push({query,options});return samples().filter(r=>r.caption.includes('Skincare')&&r.postedAt>=options.postedFrom&&r.postedAt<=options.postedThrough);},stats:()=>({total:154424,byKind:{real:154424}})};
 const response=await handleApi(request({question,records:[],corpus:true,mode:'deep'}),{OPENREEL_CORPUS:corpus});assert.equal(response.status,200);const result=await response.json();
 assert.equal(searched.length,2);assert.deepEqual(searched.map(s=>[s.options.postedFrom,s.options.postedThrough]),[['2024-07-15','2024-07-21'],['2024-07-08','2024-07-14']]);for(const s of searched){assert.equal(s.options.uniqueCreators,false);assert.equal(s.options.limit,500);assert.match(s.query,/skincare/);assert.doesNotMatch(s.query,/gaining share|2024-07-21|over 7 days/);}
 assert.equal(result.corpus.total,154424);assert.equal(result.stats.retrievedRecords,27);assert.equal(result.stats.comparedRecords,27);assert.match(result.notice,/subset|retrieved/i);assert.match(result.notice,/cumulative.*snapshot/i);
});
test('invalid calendar comparison fails before corpus retrieval; ordinary recurring patterns stay ordinary',async()=>{
 let calls=0;const corpus={search:()=>{calls++;return [];},stats:()=>({total:0})};
 for(const question of ['What skincare formats are rising as of 2024-02-30?','What skincare formats are emerging over 91 days?']){
  const response=await handleApi(request({question,records:[],corpus:true}),{OPENREEL_CORPUS:corpus});assert.equal(response.status,400);
 }
 assert.equal(calls,0);const ordinary=await handleApi(request({question:'What skincare formats repeat across creators?',records:samples()}));assert.equal(ordinary.status,200);assert.equal((await ordinary.json()).temporal,undefined);
});
test('default current-date comparison cannot use historical clips as current evidence',async()=>{
 const response=await handleApi(request({question:'What skincare formats are emerging?',records:samples()}));assert.equal(response.status,200);const result=await response.json();
 assert.equal(result.temporal.asOf,new Date().toISOString().slice(0,10));assert.equal(result.stats.comparedRecords,0);assert.deepEqual(result.sources,[]);assert.match(result.summary,/no dated records/i);
});
test('public corpus date filters validate strictly and reach the adapter without weakening profile filters',async()=>{
 let searched;const corpus={search:(query,options)=>{searched={query,options};return [];},stats:()=>({total:0})};
 const response=await handleApi(request({query:'skincare',postedFrom:'2024-07-08',postedThrough:'2024-07-21',school:'UCLA',emailInBio:true},'/api/corpus/search'),{OPENREEL_CORPUS:corpus});assert.equal(response.status,200);assert.equal(searched.options.postedFrom,'2024-07-08');assert.equal(searched.options.postedThrough,'2024-07-21');assert.equal(searched.options.school,'UCLA');assert.equal(searched.options.emailInBio,true);
 for(const bounds of [{postedFrom:'2024-02-30'},{postedThrough:42},{postedFrom:'2024-07-22',postedThrough:'2024-07-21'}])assert.equal((await handleApi(request({query:'',...bounds},'/api/corpus/search'),{OPENREEL_CORPUS:corpus})).status,400);
});

test('a requested format count cannot truncate video denominators or let old rows consume date evidence',async()=>{
 const records=[...Array.from({length:5},(_,i)=>({id:'old'+i,handle:'old'+i,caption:'Skincare',format:'Unboxing',postedAt:'2024-01-01'})),...samples()];
 const response=await handleApi(request({question:'Show 5 rising skincare formats as of 2024-07-21 over 7 days',records}));assert.equal(response.status,200);const result=await response.json();assert.equal(result.stats.comparedRecords,27);assert.equal(result.temporal.windows.current.recordCount,16);assert.equal(result.temporal.windows.prior.recordCount,11);
});
