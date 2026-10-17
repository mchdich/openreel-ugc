import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRecords,creatorKey} from '../public/engine.js';
import {analyzeMomentum as analyze} from '../public/temporal.js';
const row=(id,creator,postedAt,extra={})=>({id,handle:'',creatorId:String(creator),postedAt,caption:'Supplied skincare evidence',format:'',...extra});
const rows=input=>normalizeRecords(input);
const options={asOf:'2024-10-17',windowDays:7};
function sample({current=5,currentCreators=3,prior=1,currentTotal=10,priorTotal=10,format='Story',extra={}}={}){
 const result=[];
 for(let i=0;i<current;i++)result.push(row('c-'+i,900+i%currentCreators,'2024-10-16',{format,...extra}));
 for(let i=0;i<prior;i++)result.push(row('p-'+i,950+i,'2024-10-09',{format,...extra}));
 for(let i=current;i<currentTotal;i++)result.push(row('other-c-'+i,1000+i,'2024-10-15'));
 for(let i=prior;i<priorTotal;i++)result.push(row('other-p-'+i,1100+i,'2024-10-08'));
 return rows(result);
}

test('strict as-of calendar and window bounds reject rollover and ambiguous input',()=>{
 for(const asOf of [undefined,null,'2023-02-29','2024-02-30','2024-13-01','2024-2-01','2024-10-17T00:00:00Z',' 2024-10-17','2024-10-17 '])assert.throws(()=>analyze([],{asOf}),/asOf|calendar/i);
 for(const windowDays of [0,91,1.5,'7',null,NaN,Infinity])assert.throws(()=>analyze([],{asOf:'2024-10-17',windowDays}),/windowDays/i);
 assert.equal(analyze([],{asOf:'2024-02-29'}).temporal.windowDays,7);
 assert.throws(()=>analyze({},options),/records.*array/i);
});

test('inclusive adjacent windows handle leap day without UTC-shifting supplied calendar dates',()=>{
 const input=rows([
  row('old',1,'2024-02-26',{format:'Story'}),row('prior-a',2,'2024-02-27 23:59:00',{format:'Story'}),row('prior-b',3,'2024-02-28T12:00:00Z',{format:'Story'}),
  row('current-a',4,'2024-02-29T00:30:00+14:00',{format:'Story'}),row('current-b',5,'2024-03-01T23:30:00-11:00',{format:'Story'}),row('future',6,'2024-03-02',{format:'Story'})
 ]),result=analyze(input,{asOf:'2024-03-01',windowDays:2});
 assert.deepEqual(result.temporal.windows,{current:{start:'2024-02-29',end:'2024-03-01',recordCount:2},prior:{start:'2024-02-27',end:'2024-02-28',recordCount:2}});
 const group=result.temporal.groups[0];assert.equal(group.current.videoCount,2);assert.equal(group.prior.videoCount,2);assert.equal(group.current.sharePercent,100);assert.equal(group.changePercentagePoints,0);
 assert.equal(result.temporal.coverage.beforeWindows,1);assert.equal(result.temporal.coverage.afterAsOf,1);assert.equal(result.temporal.coverage.unknownTimezoneRecords,3);assert.equal(result.temporal.coverage.comparedUnknownTimezoneRecords,1);
});

test('positive momentum needs five clips, three numeric creator identities, prior evidence and rising sample share',()=>{
 const input=sample(),before=JSON.stringify(input),result=analyze(input,options),group=result.temporal.groups[0];
 assert.equal(result.kind,'trends');assert.equal(result.mode,'deterministic');assert.deepEqual(result.creators,[]);
 assert.equal(group.current.videoCount,5);assert.equal(group.current.creatorCount,3);assert.equal(group.prior.videoCount,1);assert.equal(group.current.sharePercent,50);assert.equal(group.prior.sharePercent,10);assert.equal(group.changePercentagePoints,40);assert.equal(group.risingWithinSample,true);assert.equal(group.signal,'rising-within-sample');
 assert.match(result.summary,/rising within (?:the supplied )?sample/i);assert.match(result.title,/2024-10-17/);assert.match(result.notice,/not.*(?:today|platform|current)/i);
 assert.equal(result.stats.retrievedRecords,20);assert.equal(result.stats.comparedRecords,20);assert.equal(result.stats.citedRecords,result.sources.length);assert.equal(result.stats.totalViews,null);assert.equal(result.stats.avgViews,null);
 assert.equal(JSON.stringify(input),before);
});

test('numeric identities and duplicate video IDs cannot inflate creator or denominator counts',()=>{
 const input=sample({currentCreators:2});input[1]={...input[1],handle:'@observedname'};
 const result=analyze([...input,input[0]],options),group=result.temporal.groups[0];
 assert.equal(group.current.creatorCount,2);assert.equal(group.current.videoCount,5);assert.equal(group.risingWithinSample,false);assert.equal(result.temporal.coverage.duplicateRecords,1);assert.equal(result.temporal.coverage.uniqueRecords,20);assert.equal(result.stats.retrievedRecords,21);assert.equal(result.stats.comparedRecords,20);
});

test('all dated window records form denominators even when their formats are unknown',()=>{
 const result=analyze(sample({current:6,currentCreators:3,prior:5,currentTotal:20,priorTotal:10}),options),group=result.temporal.groups[0];
 assert.equal(group.current.sharePercent,30);assert.equal(group.prior.sharePercent,50);assert.equal(group.changePercentagePoints,-20);assert.equal(group.risingWithinSample,false);assert.equal(result.temporal.windows.current.recordCount,20);
});

test('small positive share changes retain their sign instead of being displayed as zero',()=>{
 const current=rows(Array.from({length:1999},(_,i)=>row('c-'+i,1000+i%3,'2024-10-16',{format:i<6?'Story':''})));
 const prior=rows(Array.from({length:1666},(_,i)=>row('p-'+i,2000+i,'2024-10-09',{format:i<5?'Story':''})));
 const result=analyze([...current,...prior],options),group=result.temporal.groups[0];
 assert.ok(group.changePercentagePoints>0&&group.changePercentagePoints<0.0001);
 assert.equal(group.risingWithinSample,true);
 assert.match(result.sections[0].text,/increased by less than 0\.0001 percentage points/);
 assert.doesNotMatch(result.sections[0].text,/changed by 0 percentage points/);
});

test('insufficient current clips, absent prior format, equal share and absent prior window give no positive claim',()=>{
 for(const input of [sample({current:4,currentCreators:4}),sample({prior:0}),sample({current:5,currentTotal:10,prior:1,priorTotal:2}),sample({prior:0,priorTotal:0})]){
  const result=analyze(input,options);assert.ok(result.temporal.groups.every(g=>!g.risingWithinSample));assert.match(result.summary,/no format meets|no.*rising/i);
 }
 const noPrior=analyze(sample({prior:0,priorTotal:0}),options).temporal.groups[0];assert.equal(noPrior.prior.sharePercent,null);assert.equal(noPrior.changePercentagePoints,null);
});

test('missing, invalid clock/calendar dates and records outside windows stay excluded and counted',()=>{
 const input=rows([row('one',1,'2024-10-16',{format:'Story'}),row('two',2,'2024-10-09',{format:'Story'}),row('missing',3,''),row('bad-calendar',4,'2024-02-30'),row('bad-clock',5,'2024-10-16')]);
 input[4].postedAt='2024-10-16T25:00:00Z';input.push({...input[4],id:'garbage',postedAt:'not-a-date'});
 const result=analyze(input,options),coverage=result.temporal.coverage;
 assert.equal(coverage.missingDates,1);assert.equal(coverage.invalidDates,3);assert.equal(coverage.comparedRecords,2);assert.equal(coverage.datedRecords,2);assert.equal(result.stats.comparedRecords,2);assert.match(result.sections.at(-1).text,/missing|invalid/i);
});

test('invalid timezone offsets cannot supply dated evidence',()=>{
 const input=sample();
 input[0].postedAt='2024-10-16T12:00:00+25:00';
 input[1].postedAt='2024-10-16T12:00:00+01:60';
 input[2].postedAt='2024-10-16T12:00:00-9960';
 const result=analyze(input,options);
 assert.equal(result.temporal.coverage.invalidDates,3);
 assert.equal(result.temporal.groups[0].current.videoCount,2);
 assert.equal(result.temporal.groups[0].risingWithinSample,false);
});

test('historical records cannot become evidence for a later current window',()=>{
 const result=analyze(sample(),{asOf:'2026-10-17',windowDays:7});
 assert.equal(result.temporal.groups.length,0);assert.equal(result.sources.length,0);assert.equal(result.stats.comparedRecords,0);assert.equal(result.temporal.coverage.beforeWindows,20);assert.match(result.summary,/no dated|no.*window/i);assert.match(result.summary,/2026-10-17/);assert.match(result.notice,/historical|calendar/i);
});

test('representative citations cover both windows and preserve upstream-model evidence as distinct text',()=>{
 const input=sample({format:'',extra:{visualDescription:'The video features an unboxing of skincare products.',descriptionSource:'upstream-model',transcript:'Original supplied ASR words'}}),result=analyze(input,options),group=result.temporal.groups[0];
 assert.equal(group.format,'Unboxing');assert.equal(group.current.sourceIds.length,3);assert.equal(group.prior.sourceIds.length,1);assert.equal(new Set(group.current.sourceIds.map(id=>creatorKey(input.find(r=>r.id===id)))).size,3);
 for(const evidence of group.evidence){const record=input.find(r=>r.id===evidence.recordId);assert.equal(evidence.descriptionSource,'upstream-model');assert.ok(record.visualDescription.includes(evidence.excerpt));assert.equal(record.format,'');assert.equal(record.transcript,'Original supplied ASR words');}
 assert.match(result.sections[0].text,/upstream AI-derived/i);assert.ok(result.sections[0].sourceIds.includes('p-0'));assert.ok(result.sources.every(r=>result.sections.some(s=>s.sourceIds?.includes(r.id))));
 for(const source of result.sources)assert.equal(source,input.find(record=>record.id===source.id));
});

test('overlapping described patterns keep one denominator and one cited copy of each actual clip',()=>{
 const input=sample({format:'',extra:{visualDescription:'The video shows an unboxing and a before/after comparison.',descriptionSource:'upstream-model'}});
 const result=analyze(input,options);
 assert.equal(result.temporal.groups.length,2);
 for(const group of result.temporal.groups){assert.equal(group.current.videoCount,5);assert.equal(group.current.sharePercent,50);assert.equal(group.prior.videoCount,1);assert.equal(group.prior.sharePercent,10);}
 assert.equal(result.stats.comparedRecords,20);
 assert.equal(result.sources.length,4);
 assert.equal(new Set(result.sources.map(source=>source.id)).size,4);
});

test('results cap six groups, at most ten sections and bounded actual citations without view-based ranking',()=>{
 const input=[];
 for(let g=0;g<8;g++){
  for(let i=0;i<5;i++)input.push(row(`g${g}-c${i}`,g*100+i,'2024-10-16',{format:'Pattern '+g,views:g===7?999999999:1}));
  for(let i=0;i<3;i++)input.push(row(`g${g}-p${i}`,g*100+20+i,'2024-10-09',{format:'Pattern '+g,views:g===7?999999999:1}));
 }
 const normalized=rows(input),result=analyze(normalized,options),reversed=analyze([...normalized].reverse(),options);
 assert.equal(result.temporal.groups.length,6);assert.equal(result.temporal.coverage.detectedGroups,8);assert.ok(result.sections.length<=10);assert.ok(result.sources.length<=40);assert.equal(result.sources.length,36);
 assert.deepEqual(result.temporal.groups.map(g=>g.format),['Pattern 0','Pattern 1','Pattern 2','Pattern 3','Pattern 4','Pattern 5']);assert.deepEqual(result.temporal.groups.map(g=>g.format),reversed.temporal.groups.map(g=>g.format));assert.deepEqual(result.sources.map(r=>r.id),reversed.sources.map(r=>r.id));
 for(const group of result.temporal.groups){assert.equal(group.current.sourceIds.length,3);assert.equal(group.prior.sourceIds.length,3);}
 assert.ok(result.sections.every(s=>!s.sourceIds||s.sourceIds.every(id=>result.sources.some(r=>r.id===id))));
});

test('fictional examples never establish dated momentum and remain visible in coverage limits',()=>{
 const input=sample().map(r=>({...r,demo:true})),result=analyze(input,options);
 assert.equal(result.temporal.coverage.exampleRecordsExcluded,20);assert.equal(result.stats.comparedRecords,0);assert.equal(result.temporal.groups.length,0);assert.equal(result.sources.length,0);assert.match(result.sections.at(-1).text,/fictional|example/i);
});
