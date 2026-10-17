import test from 'node:test';
import assert from 'node:assert/strict';
import {getTrends,normalizeRecords,research} from '../public/engine.js';

const row=(id,creator,extra={})=>({id,creatorId:creator,handle:'',caption:'Skincare evidence',transcript:'Original supplied words',visualDescription:'',descriptionSource:'',format:'',...extra});
const normalized=rows=>normalizeRecords(rows);
const described=(id,creator,text,extra={})=>row(id,creator,{visualDescription:text,descriptionSource:'upstream-model',...extra});

test('explicit formats retain their original evidence and require distinct actual creator identities',()=>{
 const rows=normalized([row('one','901',{format:'Story'}),row('two','901',{handle:'@known',format:'story'}),row('three','902',{format:'Story'})]);
 const before=JSON.stringify(rows),groups=getTrends([...rows,rows[0]]);
 assert.equal(groups.length,1);assert.equal(groups[0].format,'Story');assert.equal(groups[0].count,3);assert.equal(groups[0].creators.length,2);
 assert.deepEqual(groups[0].evidence.map(e=>e.recordId),['one','two','three']);
 assert.ok(groups[0].evidence.every(e=>e.field==='format'&&rows.find(r=>r.id===e.recordId).format===e.excerpt));
 assert.equal(JSON.stringify(rows),before);assert.deepEqual(getTrends(rows.slice(0,2)),[]);
});

test('clear upstream descriptions form cited unboxing and before/after groups without rewriting records',()=>{
 const rows=normalized([
  described('one','901','The video features an unboxing of a skincare parcel.'),
  described('two','902','The creator is unboxing a skincare package on camera.'),
  described('three','903','The video shows before and after results of a skincare routine.'),
  described('four','904','This clip presents a before/after comparison of the finished look.')
 ]),before=JSON.stringify(rows),groups=getTrends(rows);
 assert.deepEqual(groups.map(g=>g.format).sort(),['Before / after','Unboxing']);
 for(const group of groups){
  assert.equal(group.creators.length,2);assert.equal(group.evidence.length,2);
  assert.ok(group.evidence.every(e=>e.field==='visualDescription'&&e.descriptionSource==='upstream-model'&&rows.find(r=>r.id===e.recordId).visualDescription.includes(e.excerpt)));
  assert.deepEqual(group.sourceGroups,[{field:'visualDescription',descriptionSource:'upstream-model',count:2,sourceIds:group.records.map(r=>r.id)}]);
 }
 assert.equal(JSON.stringify(rows),before);assert.ok(rows.every(r=>r.format===''&&r.transcript==='Original supplied words'));
});

test('a supplied generic tutorial label is not strengthened into step-by-step evidence',()=>{
 const group=getTrends(normalized([row('one','901',{format:'Tutorial'}),row('two','902',{format:'Tutorial'})]))[0];
 assert.equal(group.format,'Tutorial');assert.ok(group.evidence.every(e=>e.field==='format'&&e.excerpt==='Tutorial'));
});

test('bare tutorial mentions, promotional text, negation and suggested formats do not become observed patterns',()=>{
 const counterexamples=[
  'The creator says "tutorial is up" over a still image.',
  'Text on the video announces a step-by-step tutorial coming tomorrow.',
  'The caption mentions an unboxing video linked in the bio.',
  'This video does not show an unboxing; the creator only talks to the camera.',
  'The creator promises a product review next week.',
  'A get ready with me video is suggested as something viewers could make.',
  'The video mentions a day in the life format without showing it.',
  'The video is titled "GRWM SkinCare Routine," indicating a focus on skincare.',
  'The creator discusses whether before and after photos can be trusted.',
  'The creator describes what happened before lunch and after school.'
 ];
 for(const text of counterexamples)assert.deepEqual(getTrends(normalized([described('one','901',text),described('two','902',text)])),[],text);
 const oneActual=described('one','901','The video presents a step-by-step tutorial demonstrating the application order.');
 assert.deepEqual(getTrends(normalized([oneActual,described('two','902','The creator says "tutorial is up" over a still image.')])),[]);
});

test('captions and transcripts alone cannot invent a visual pattern or its evidence source',()=>{
 const rows=normalized([row('one','901',{caption:'An unboxing video',transcript:'A step-by-step tutorial'}),row('two','902',{caption:'An unboxing video',transcript:'A step-by-step tutorial'})]);
 assert.deepEqual(getTrends(rows),[]);
 assert.deepEqual(getTrends(rows.map(r=>({...r,visualDescription:'This video features an unboxing of skincare products.',descriptionSource:''}))),[]);
});

test('clear tutorial, product demonstration, product review, GRWM and day-in-life phrases are supported',()=>{
 for(const [format,text] of [
  ['Step-by-step tutorial','The video presents a step-by-step tutorial showing each application stage.'],
  ['Product demonstration','The creator demonstrates the application of these skincare products.'],
  ['Product review','The video features a product review with the creator discussing its texture.'],
  ['Get ready with me','The video follows a get ready with me routine before an event.'],
  ['Day in the life','This video presents a day in the life of a skincare creator.']
 ])assert.ok(getTrends(normalized([described('one','901',text),described('two','902',text)])).some(g=>g.format===format),format);
});

test('mixed evidence origins stay separate and unknown metrics cannot inflate pattern averages',()=>{
 const rows=normalized([
  row('one','901',{format:'Unboxing',views:100,likes:10,comments:2,shares:3}),
  described('two','902','The video features an unboxing of a skincare parcel.',{views:999999,unavailableMetrics:['views']})
 ]),group=getTrends(rows)[0];
 assert.equal(group.avgViews,100);assert.equal(group.measuredVideos,1);assert.equal(group.avgEngagementRate,15);
 assert.deepEqual(group.sourceGroups,[{field:'format',count:1,sourceIds:['one']},{field:'visualDescription',descriptionSource:'upstream-model',count:1,sourceIds:['two']}]);
 const unknown=getTrends(normalized(rows.map(r=>({...r,unavailableMetrics:['followers','views','likes','comments','shares']}))))[0];assert.equal(unknown.avgViews,null);assert.equal(unknown.avgEngagementRate,null);
});

test('posting windows use supplied calendar dates and disclose missing dates and unknown timezones',()=>{
 const rows=normalized([
  row('one','901',{format:'Story',postedAt:'2024-06-24 12:00:00'}),
  row('two','902',{format:'Story',postedAt:'2024-11-01T08:00:00Z'}),
  row('three','903',{format:'Story'}),
  row('four','904',{format:'Story',postedAt:'2024-02-30'})
 ]),window=getTrends(rows)[0].dateWindow;
 assert.equal(window.start,'2024-06-24');assert.equal(window.end,'2024-11-01');assert.equal(window.knownRecords,2);assert.equal(window.unknownRecords,2);assert.equal(window.unknownTimezoneRecords,1);
 assert.match(window.limit,/supplied|calendar/i);assert.match(window.limit,/emergence|growth/i);
 const missing=getTrends(normalized(rows.map(r=>({...r,postedAt:''}))))[0].dateWindow;assert.equal(missing.start,null);assert.equal(missing.end,null);assert.equal(missing.unknownRecords,4);
});

test('research cites pattern evidence, labels upstream AI and does not count overlapping groups twice',()=>{
 const text='The video features an unboxing of skincare products and a product review of their texture.';
 const rows=normalized([described('one','901',text,{postedAt:'2024-06-24'}),described('two','902',text,{postedAt:'2024-07-24'})]);
 const result=research(rows,'What skincare patterns are working across multiple creators?');
 assert.equal(result.kind,'trends');assert.equal(result.trends.length,2);assert.equal(result.sources.length,2);assert.equal(result.stats.matchedRecords,2);
 assert.match(result.summary,/not.*(?:current|live)|does not establish/i);
 for(const section of result.sections){assert.deepEqual(section.sourceIds,['one','two']);assert.match(section.text,/upstream AI-derived/i);assert.match(section.text,/2024-06-24/);assert.match(section.text,/2024-07-24/);assert.match(section.text,/emergence|growth/i);}
 assert.ok(result.sources.every(r=>r.format===''&&r.transcript==='Original supplied words'));
});
