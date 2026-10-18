import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRecords} from '../public/engine.js';
const module=await import('../public/visual-patterns.js').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const ground=(...args)=>{assert.equal(typeof module.groundVisualPatterns,'function');return module.groundVisualPatterns(...args);};
const sentence='The video shows a split-screen layout with two people beside one another. A date sticker appears at the bottom of both scenes.';
const rows=()=>normalizeRecords([1,2,3].map((i)=>({id:'source-'+i,creatorId:String(100+i),handle:'',caption:'Actual source caption',visualDescription:sentence,descriptionSource:'upstream-model',postedAt:'2024-10-0'+i,views:i===3?null:100*i,demo:false})));
const proposal=(ids=['source-1','source-2'])=>({title:'Split-screen clips with on-screen date labels',description:'Paired scenes share a split-screen layout and visible date stickers.',components:[{featureId:'split-screen',label:'Split-screen paired layout',evidence:ids.map(recordId=>({recordId,quote:'The video shows a split-screen layout with two people beside one another.'}))},{featureId:'date-overlay',label:'A visible date sticker',evidence:ids.map(recordId=>({recordId,quote:'A date sticker appears at the bottom of both scenes.'}))}]});

test('specific visual patterns retain exact component quotes and derive metrics/dates from actual members',()=>{
 const input=rows(),before=JSON.stringify(input);const result=ground(input,[proposal()]);
 assert.equal(result.patterns.length,1);const pattern=result.patterns[0];assert.equal(pattern.format,proposal().title);assert.equal(pattern.count,2);assert.equal(pattern.creators.length,2);assert.equal(pattern.avgViews,150);assert.equal(pattern.sourceGroups[0].count,2);assert.equal(pattern.dateWindow.start,'2024-10-01');assert.equal(pattern.dateWindow.end,'2024-10-02');assert.ok(pattern.evidence.every(e=>e.field==='visualDescription'&&e.descriptionSource==='upstream-model'&&sentence.includes(e.excerpt)));assert.equal(JSON.stringify(input),before);assert.ok(input.every(r=>r.format===''));
});

test('each retained member must support every component, with at least two independent creator identities',()=>{
 const p=proposal();p.components[1].evidence=[{recordId:'source-2',quote:proposal().components[1].evidence[0].quote},{recordId:'source-3',quote:proposal().components[1].evidence[0].quote}];
 assert.equal(ground(rows(),[p]).patterns.length,0);
 const duplicate=rows();duplicate[1].creatorId=duplicate[0].creatorId;duplicate[1].handle='@renamed';assert.equal(ground(duplicate,[proposal()]).patterns.length,0);
});

test('fabricated sources, paraphrased quotes and unsupported provenance cannot become pattern evidence',()=>{
 const cases=[];const invented=proposal();invented.components[0].evidence[0].recordId='invented';cases.push(invented);const paraphrase=proposal();paraphrase.components[0].evidence[0].quote='The video features two people in a split-screen layout.';cases.push(paraphrase);
 for(const p of cases){const result=ground(rows(),[p]);assert.equal(result.patterns.length,0);assert.equal(result.rejected,1);}
 const unknown=rows();unknown[0].descriptionSource='';assert.equal(ground(unknown,[proposal()]).patterns.length,0);
 const fictional=rows();fictional[0].demo=true;assert.equal(ground(fictional,[proposal()]).patterns.length,0);
});

test('duplicate source sets do not inflate distinct pattern coverage and unknown views stay unknown',()=>{
 const input=rows();input[0].unavailableMetrics=['views'];input[1].unavailableMetrics=['views'];const result=ground(input,[proposal(),{...proposal(),title:'A renamed duplicate'}]);assert.equal(result.patterns.length,1);assert.equal(result.patterns[0].avgViews,null);assert.equal(result.rejected,1);
});

test('malformed or oversized proposals and unsupported current-performance claims are rejected',()=>{
 for(const p of [null,{},Array.from({length:4},()=>proposal())])assert.throws(()=>ground(rows(),p));
 for(const mutate of [p=>{p.title='Viral split-screen trend this week';},p=>{p.description='Visit https://invented.example for more';},p=>{p.components[0].evidence[0].quote='too short';},p=>{p.components[1].featureId=p.components[0].featureId;},p=>{p.components[0].evidence.push({...p.components[0].evidence[0]});}]){const p=proposal();mutate(p);assert.equal(ground(rows(),[p]).patterns.length,0);}
});

test('mirror selfies alone cannot establish a held smartphone for a pattern member',()=>{
 const descriptions=[
  'The video features a person holding a smartphone while taking selfies in front of a mirror. The person captures different angles of their outfit.',
  'The video features a person taking selfies in front of a mirror. The person captures different angles of their outfit.',
  'The video features a person holding a smartphone while taking selfies in front of a mirror. The person captures different angles of their outfit.'
 ];
 const input=normalizeRecords(descriptions.map((visualDescription,i)=>({id:'mirror-'+i,creatorId:String(200+i),visualDescription,descriptionSource:'upstream-model',demo:false})));
 const p={title:'Mirror selfies with a smartphone',description:'People taking mirror selfies while holding a smartphone.',components:[{featureId:'mirror',label:'Mirror selfie framing',evidence:input.map(r=>({recordId:r.id,quote:r.visualDescription}))},{featureId:'held-phone',label:'Held smartphone',evidence:input.map(r=>({recordId:r.id,quote:r.visualDescription}))}]};
 const result=ground(input,[p]);assert.equal(result.patterns.length,1);assert.deepEqual(result.patterns[0].records.map(r=>r.id),['mirror-0','mirror-2']);
});


test('model wording cannot add details beyond accepted component predicates',()=>{
 const p=proposal();p.title='People facing the camera with a beautiful smartphone';p.description='These people are holding a smartphone while facing the camera.';
 const result=ground(rows(),[p]);assert.equal(result.patterns.length,1);assert.doesNotMatch(result.patterns[0].format+' '+result.patterns[0].description,/facing|smartphone|beautiful/i);
});
