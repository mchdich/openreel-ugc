/** Cloudflare D1 corpus. Apply drizzle migrations before binding this adapter. */
import {normalizeRecords,searchPlan,creatorKey} from '../public/engine.js';
import {canonicalTikTokUrl} from './social.js';

export const MAX_WORKER_CORPUS_BATCH=40;
const KINDS=['real','example','synthetic','unverified'];
const METRICS=['followers','views','likes','comments','shares'];
const TEXT=['handle','caption','transcript','hook','format','niche','bio','school','location'];
const COLUMNS=['id','kind','verification','source','imported_at','record_json',...TEXT,'school_key','location_key','email',...METRICS];
const UPSERT=`INSERT INTO corpus_videos(${COLUMNS.join(',')}) VALUES(${COLUMNS.map(()=>'?').join(',')}) ON CONFLICT(id) DO UPDATE SET ${COLUMNS.filter(f=>f!=='id').map(f=>`${f}=excluded.${f}`).join(',')} WHERE corpus_videos.record_json<>excluded.record_json OR corpus_videos.kind<>excluded.kind OR corpus_videos.verification<>excluded.verification OR corpus_videos.source<>excluded.source RETURNING id`;
const GROUPS='SELECT kind,COUNT(*) AS count FROM corpus_videos GROUP BY kind';
const SUMMARY="SELECT COUNT(*) AS total,COUNT(DISTINCT lower(handle)) AS uniqueCreators,COUNT(views) AS knownViewRecords,SUM(CASE WHEN kind='real' AND verification='provider-observed' THEN 1 ELSE 0 END) AS providerObservedReal,MAX(imported_at) AS lastImportedAt FROM corpus_videos";
const plain=value=>String(value??'').toLowerCase().replace(/[^a-z0-9@.\s]/g,' ').replace(/\s+/g,' ').trim();
const fieldKey=(value,field)=>{const text=plain(value);const aliases=field==='school'?{'new york university':'nyu','university of california los angeles':'ucla'}:{'new york city':'nyc','new york':'nyc','los angeles':'la'};return aliases[text]||text;};
const kindValue=(kind,all=false)=>{if(!KINDS.includes(kind)&&!(all&&kind==='all'))throw new Error('Corpus kind must be real, example, synthetic, or unverified.');return kind;};
const integer=(value,name,min=0,max=Number.MAX_SAFE_INTEGER)=>{if(!Number.isSafeInteger(value)||value<min||value>max)throw new Error(`${name} must be an integer between ${min} and ${max}.`);return value;};
const bound=(value,name)=>{const number=Number(value);if(!Number.isFinite(number)||number<0||number>Number.MAX_SAFE_INTEGER)throw new Error(`${name} must be a finite nonnegative number.`);return number;};
const readRow=row=>row?{...JSON.parse(row.record_json),corpusKind:row.kind,corpusVerification:row.verification,corpusSource:row.source,corpusImportedAt:row.imported_at}:null;
const bind=(database,sql,parameters=[])=>parameters.length?database.prepare(sql).bind(...parameters):database.prepare(sql);
function results(result){if(result?.success===false||!Array.isArray(result?.results))throw new Error('The hosted corpus returned an invalid database result.');return result.results;}
function statistics(groups,summary){const byKind={real:0,example:0,synthetic:0,unverified:0};for(const row of groups)byKind[row.kind]=row.count;return {...summary,providerObservedReal:summary.providerObservedReal??0,byKind};}
function playerSource(value){
 if(typeof value!=='string'||value.length>2000||/[?#]/.test(value)||/[\u0000-\u0020\u007f\\]/.test(value.trim()))return null;
 let url;try{url=new URL(value.trim());}catch{return null;}
 const match=url.pathname.match(/^\/player\/v1\/(\d{1,30})$/);
 if(url.protocol!=='https:'||url.hostname!=='www.tiktok.com'||url.port||url.username||url.password||url.search||url.hash||!match)return null;
 return {url:url.href,id:match[1]};
}
// Search projection only: source transcripts and model descriptions remain separate in JSON.
const indexedTranscript=record=>[record.transcript,record.visualDescription,record.handle].filter(Boolean).join('\n');
async function stableId(row){
 if(row.id!==undefined&&row.id!==null&&String(row.id).trim())return row.id;
 let identity;
 if(typeof row.url==='string'&&row.url.trim()){
  const player=playerSource(row.url);if(player)return `tiktok-${player.id}`;
  try{return `tiktok-${canonicalTikTokUrl(row.url).match(/\/video\/(\d+)$/)[1]}`;}catch{identity=row.url.trim();}
 }else identity=JSON.stringify([row.creatorId?`creator:${row.creatorId}`:String(row.handle??'').toLowerCase(),row.caption??'',row.transcript??'',row.postedAt??'']);
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identity));
 return `corpus-${Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')}`;
}
async function normalize(row,kind){
 if(!row||typeof row!=='object'||Array.isArray(row))throw new Error('Every corpus record must be an object.');
 if(kind==='real'&&(row.demo===true||row.demo==='true'||['example','synthetic'].includes(row.corpusKind)||row.synthetic===true))throw new Error('Fictional example or synthetic records cannot enter the real corpus.');
 const record=normalizeRecords([{...row,id:await stableId(row),...(['example','synthetic'].includes(kind)?{demo:true}:{})}])[0];
 if(kind==='real'){
  let source;const player=playerSource(record.url);
  if(player){
   if(!/^\d{1,30}$/.test(record.creatorId)||record.id!==`tiktok-${player.id}`)throw new Error('Real player sources require a numeric creator ID and a matching tiktok-<postid> record ID.');
   source=player.url;
  }else{
   try{source=canonicalTikTokUrl(record.url);}catch{throw new Error('Real corpus records require a canonical TikTok video or official player source URL and retrieval provenance.');}
   if(!record.handle||source.match(/\/@([^/]+)\//)[1].toLowerCase()!==record.handle.slice(1).toLowerCase())throw new Error('Real record handle must match its canonical source URL.');
  }
  if(!record.sourceType||!record.fetchedAt||!Number.isFinite(Date.parse(record.fetchedAt)))throw new Error('Real corpus records require sourceType and a valid fetchedAt retrieval timestamp.');
  record.url=source;
 }
 return record;
}

/** Uses the same searchPlan, aliases and SQL constraints as the local SQLite corpus. */
export function workerCorpusSearch(query='',options={}){
 if(typeof query!=='string'||query.length>6000)throw new Error('Corpus query must be text of at most 6000 characters.');
 if(!options||typeof options!=='object'||Array.isArray(options))throw new Error('Search options must be an object.');
 const kind=kindValue(options.kind??'real',true),plan=searchPlan(query,{},[]);
 let limit=integer(options.limit??20,'Search limit',1,1000);
 if(plan.filters.limit!==undefined)limit=Math.min(limit,integer(Number(plan.filters.limit),'Requested count',1,1000));
 const offset=integer(options.offset??0,'Search offset');
 const terms=plan.terms.flatMap(term=>term.match(/[\p{L}\p{N}_]+/gu)||[]),conditions=[],parameters=[];
 if(kind!=='all'){conditions.push('v.kind=?');parameters.push(kind);}
 if(terms.length){conditions.push('corpus_fts MATCH ?');parameters.push(terms.map(term=>`"${term.replaceAll('"','""')}"`).join(' AND '));}
 for(const filters of [plan.filters,options]){
  for(const [key,operator]of [['minFollowers','>='],['maxFollowers','<=']])if(filters[key]!==undefined){conditions.push(`v.followers ${operator} ?`);parameters.push(bound(filters[key],key));}
  for(const field of ['school','location'])if(filters[field]){conditions.push(`v.${field}_key=?`);parameters.push(fieldKey(filters[field],field));}
  if(filters.emailOnly||filters.hasEmail||filters.emailInBio)conditions.push("v.email<>''");
  if(filters.emailInBio)conditions.push('instr(lower(v.bio),lower(v.email))>0');
  if(filters.niche){conditions.push('instr(lower(v.niche),lower(?))>0');parameters.push(String(filters.niche));}
  if(filters.format){conditions.push('lower(v.format)=lower(?)');parameters.push(String(filters.format));}
  if(filters.handle){conditions.push("lower(json_extract(v.record_json,'$.handle'))=lower(?)");parameters.push(String(filters.handle).startsWith('@')?String(filters.handle):`@${filters.handle}`);}
 }
 const unique=options.uniqueCreators??/\bcreators?|influencers?\b/i.test(query);
 const matched=`SELECT v.record_json,v.kind,v.verification,v.source,v.imported_at,v.handle,v.id,${terms.length?'bm25(corpus_fts)':'0'} AS score FROM corpus_videos v ${terms.length?'JOIN corpus_fts ON corpus_fts.rowid=v.rowid':''} ${conditions.length?`WHERE ${conditions.join(' AND ')}`:''}`;
 const sql=unique?`WITH matches AS MATERIALIZED (${matched}),picked AS (SELECT *,row_number() OVER(PARTITION BY lower(handle) ORDER BY score,id) AS creator_row FROM matches) SELECT * FROM picked WHERE creator_row=1 ORDER BY score,id LIMIT ? OFFSET ?`:`${matched} ORDER BY score,v.id LIMIT ? OFFSET ?`;
 return {sql,parameters:[...parameters,limit,offset]};
}

export class WorkerCorpus{
 constructor(database){if(!database||typeof database.prepare!=='function'||typeof database.batch!=='function')throw new Error('A migrated D1 database binding is required.');this.database=database;}
 async upsert(records,{kind,source='local-import',verification='user-supplied'}={}){
  if(kind!==undefined)kindValue(kind);
  if(typeof source!=='string'||!source.trim()||source.length>2000)throw new Error('Corpus source must contain 1–2000 characters.');
  if(!['user-supplied','provider-observed'].includes(verification))throw new Error('Invalid corpus verification label.');
  if(!records||typeof records==='string'||typeof records[Symbol.iterator]!=='function')throw new Error('Corpus import must be an iterable of records.');
  const validated=[],importedAt=new Date().toISOString();
  for(const row of records){
   if(validated.length>=MAX_WORKER_CORPUS_BATCH)throw new Error('Hosted acquisition batches are limited to 40 records; split larger imports into explicit separate requests.');
   const rowKind=kind??((row?.demo===true||row?.demo==='true')?'example':row?.corpusKind==='synthetic'?'synthetic':'unverified');
   const record=await normalize(row,rowKind);
   const values={...record,kind:rowKind,verification:rowKind==='real'?verification:rowKind==='synthetic'?'synthetic':rowKind==='example'?'fixture':'user-supplied',source:source.trim(),imported_at:importedAt,record_json:JSON.stringify(record),handle:creatorKey(record),transcript:indexedTranscript(record),school_key:fieldKey(record.school,'school'),location_key:fieldKey(record.location,'location')};
   for(const metric of METRICS)if(record.unavailableMetrics.includes(metric))values[metric]=null;
   validated.push(COLUMNS.map(field=>values[field]));
  }
  if(!validated.length)return {processed:0,changed:0};
  let batch;
  try{batch=await this.database.batch(validated.map(values=>bind(this.database,UPSERT,values)));}
  catch(error){if(/Cannot promote an existing synthetic\/example/i.test(error?.message||''))throw new Error('Cannot promote an existing synthetic/example record ID into the real corpus.');throw new Error('The hosted corpus write failed. No records were changed.');}
  if(!Array.isArray(batch)||batch.length!==validated.length)throw new Error('The hosted corpus returned an invalid batch result.');
  const changed=batch.reduce((count,value)=>count+results(value).length,0);
  return {processed:validated.length,changed};
 }
 async search(query='',options={}){const plan=workerCorpusSearch(query,options);return results(await bind(this.database,plan.sql,plan.parameters).all()).map(readRow);}
 async get(id){if(typeof id!=='string')throw new Error('Corpus record ID must be text.');return readRow(await bind(this.database,'SELECT record_json,kind,verification,source,imported_at FROM corpus_videos WHERE id=?',[id]).first());}
 async stats(){const batch=await this.database.batch([bind(this.database,GROUPS),bind(this.database,SUMMARY)]);return statistics(results(batch[0]),results(batch[1])[0]);}
 close(){/* A Worker request does not own or close the platform database binding. */}
}
export function openWorkerCorpus(database){return new WorkerCorpus(database);}
