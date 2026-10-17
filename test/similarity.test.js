import test from 'node:test';
import assert from 'node:assert/strict';
import {research,normalizeRecords} from '../public/engine.js';
const row=(id,extra={})=>({id,handle:'@'+id,caption:'',school:'University of California, Los Angeles',email:id+'@creator.example',bio:'UCLA\n'+id+'@creator.example',followers:1200,...extra});
const reference=row('reference',{niche:'skincare',format:'Demonstration',caption:'Gentle skincare routine with a moisturizer.'});
const query='Find 2 creators like her with email in bio and at least 1,000 followers at UCLA';
const records=()=>normalizeRecords([reference,row('weak',{caption:'A moisturizer review'}),row('best',{niche:'skincare',format:'Demonstration',caption:'Gentle skincare routine moisturizer'}),row('duplicate',{handle:'@best',niche:'skincare',format:'Demonstration'}),row('noemail',{email:'',niche:'skincare',format:'Demonstration'}),row('unknown',{followers:null,niche:'skincare',format:'Demonstration'}),row('wrongschool',{school:'New York University',niche:'skincare',format:'Demonstration'}),row('unrelated',{caption:'A concert in the evening'})]);
test('a bare similarity pronoun asks for a reference and makes no unrelated match',()=>{
 const result=research(records(),query);assert.equal(result.creators.length,0);assert.match(result.summary,/select|reference/i);assert.doesNotMatch(result.summary,/No creators.*filters/i);
});
test('similar creators apply every identity/contact/count filter before ranking and exclude the reference',()=>{
 const rows=records();const result=research(rows,query,[],{reference:rows[0]});
 assert.deepEqual(result.creators.map(r=>r.handle),['@best','@weak']);assert.equal(result.stats.uniqueCreators,2);assert.ok(result.sections.some(s=>s.text.includes('moisturizer')));assert.ok(result.sections.some(s=>s.sourceIds?.includes('best')));assert.match(result.summary,/text|content|format/i);
});
test('similarity with no shared content evidence never invents an appearance or demographic match',()=>{
 const rows=normalizeRecords([reference,row('unrelated',{caption:'A concert in the evening'})]);const result=research(rows,query,[],{reference:rows[0]});assert.equal(result.creators.length,0);assert.match(result.summary,/share|similar/i);
});
test('requested count is applied after unique creator ranking',()=>{
 const rows=records();const result=research(rows,query.replace('Find 2','Find 1'),[],{reference:rows[0]});assert.deepEqual(result.creators.map(r=>r.handle),['@best']);
});

test('chat resolves explicit reference from the corpus before filtered retrieval',async()=>{
 const {handleApi}=await import('../lib/api.js');const rows=records();let searched;
 const corpus={get:async id=>rows.find(r=>r.id===id),search:async query=>{searched=query;return rows.slice(1);},stats:async()=>({total:10000})};
 const response=await handleApi(new Request('https://reference-index.example/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:query,records:[],corpus:true,referenceId:'reference'})}),{OPENREEL_CORPUS:corpus});
 assert.equal(response.status,200);const value=await response.json();assert.deepEqual(value.creators.map(r=>r.handle),['@best','@weak']);assert.doesNotMatch(searched,/like her/i);assert.equal(value.corpus.total,10000);assert.match(value.summary,/similar|content|format/i);
});
test('a separate explicit browser reference supports fresh-only Live input without joining it to matches',async()=>{
 const {handleApi}=await import('../lib/api.js');const rows=records();
 const response=await handleApi(new Request('https://reference-browser.example/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:query,records:rows.slice(1),referenceId:'reference',referenceRecord:rows[0]})}));
 const value=await response.json();assert.equal(response.status,200);assert.deepEqual(value.creators.map(r=>r.handle),['@best','@weak']);assert.ok(!value.sources.some(r=>r.id==='reference'));
});
test('unknown or mismatched explicit reference IDs are rejected instead of silently guessing',async()=>{
 const {handleApi}=await import('../lib/api.js');const rows=records();
 for(const extra of [{referenceId:'missing'},{referenceId:'different',referenceRecord:rows[0]}]){
  const response=await handleApi(new Request('https://reference-invalid.example/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:query,records:rows,...extra})}));assert.equal(response.status,400);
 }
});
