import {normalizeRecords,getTrends,creatorKey} from '../public/engine.js';

const FORMAT_QUERIES=['unboxing','before after','tutorial','product demonstration','product review','get ready with me','day life'];
const failure=(message,status=502)=>Object.assign(new Error(message),{status,code:'corpus-patterns-unavailable'});

/** Read-only, purposeful format coverage. Neither a random sample nor a current trend ranking. */
export async function sampleCorpusPatterns(corpus,query=''){
 if(typeof query!=='string'||query.length>1000)throw failure('Corpus query must be at most 1,000 characters.',400);
 if(!corpus||typeof corpus.search!=='function')throw failure('No server corpus is configured.',503);
 async function read(text,limit,uniqueCreators){
  let rows;
  try{rows=await corpus.search(text,{kind:'real',limit,...(uniqueCreators?{uniqueCreators:true}:{})});}
  catch{throw failure('The corpus pattern query could not be completed. Retry the search.',503);}
  if(!Array.isArray(rows)||rows.length>limit||rows.some(r=>!r||r.demo!==false||r.synthetic===true||r.corpusKind!==undefined&&r.corpusKind!=='real'))throw failure('The corpus returned an invalid real-record pattern sample.');
  try{return rows.length?normalizeRecords(rows):[];}catch{throw failure('The corpus returned invalid pattern records.');}
 }
 const text=query.trim();
 if(text){
  const records=await read(text,100,false);
  return {records,selection:{method:'query',queryCount:1,candidateRecords:records.length}};
 }
 const candidates=new Map();
 for(const record of await read('',100,false))candidates.set(record.id,record);
 for(const format of FORMAT_QUERIES)for(const record of await read(format,30,true))if(!candidates.has(record.id))candidates.set(record.id,record);
 const covered=record=>typeof record.thumbnail==='string'&&record.thumbnail.startsWith('https://');
 const queues=getTrends([...candidates.values()]).slice(0,50).map(group=>{
  const rows=[...group.records].sort((a,b)=>Number(covered(b))-Number(covered(a)));
  const other=rows.findIndex(record=>creatorKey(record)!==creatorKey(rows[0]));
  // Reserve two distinct identities before filling any group's remaining slots.
  return [rows[0],rows[other],...rows.filter((_,i)=>i!==0&&i!==other)];
 });
 const chosen=new Map();
 for(const queue of queues)for(let i=0;i<2;i++){const record=queue.shift();chosen.set(record.id,record);}
 while(chosen.size<100&&queues.some(queue=>queue.length)){
  for(const queue of queues){
   const record=queue.shift();if(record)chosen.set(record.id,record);
   if(chosen.size===100)break;
  }
 }
 return {records:[...chosen.values()],selection:{method:'format-stratified',queryCount:8,candidateRecords:candidates.size}};
}
