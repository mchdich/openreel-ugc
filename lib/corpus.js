/** Node-only persistent corpus. Keep this module out of browser/Worker bundles. */
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {normalizeRecords,searchPlan,creatorKey} from '../public/engine.js';
import {canonicalTikTokUrl} from './social.js';

export const DEFAULT_CORPUS_PATH=fileURLToPath(new URL('../data/corpus.sqlite',import.meta.url));
const KINDS=['real','example','synthetic','unverified'];
const METRICS=['followers','views','likes','comments','shares'];
const FTS_FIELDS=['handle','caption','transcript','hook','format','niche','bio','school','location'];
const plain=value=>String(value??'').toLowerCase().replace(/[^a-z0-9@.\s]/g,' ').replace(/\s+/g,' ').trim();
const fieldKey=(value,field)=>{
 const text=plain(value);
 const aliases=field==='school'?{'new york university':'nyu','university of california los angeles':'ucla'}:{'new york city':'nyc','new york':'nyc','los angeles':'la'};
 return aliases[text]||text;
};
const integer=(value,name,min=0,max=Number.MAX_SAFE_INTEGER)=>{
 if(!Number.isSafeInteger(value)||value<min||value>max)throw new Error(`${name} must be an integer between ${min} and ${max}.`);
 return value;
};
const bound=(value,name)=>{const number=Number(value);if(!Number.isFinite(number)||number<0||number>Number.MAX_SAFE_INTEGER)throw new Error(`${name} must be a finite nonnegative number.`);return number;};
const checkKind=(kind,all=false)=>{if(!KINDS.includes(kind)&&!(all&&kind==='all'))throw new Error('Corpus kind must be real, example, synthetic, or unverified.');return kind;};
const digest=value=>createHash('sha256').update(value).digest('hex');
function playerSource(value){
 if(typeof value!=='string'||value.length>2000||/[?#]/.test(value)||/[\u0000-\u0020\u007f\\]/.test(value.trim()))return null;
 let url;try{url=new URL(value.trim());}catch{return null;}
 const match=url.pathname.match(/^\/player\/v1\/(\d{1,30})$/);
 if(url.protocol!=='https:'||url.hostname!=='www.tiktok.com'||url.port||url.username||url.password||url.search||url.hash||!match)return null;
 return {url:url.href,id:match[1]};
}
// This SQL projection is never returned as a transcript or written into record_json.
const indexedTranscript=record=>[record.transcript,record.visualDescription,record.handle].filter(Boolean).join('\n');
function stableId(row){
 if(row.id!==undefined&&row.id!==null&&String(row.id).trim())return row.id;
 let identity;
 if(typeof row.url==='string'&&row.url.trim()){
  const player=playerSource(row.url);if(player)return `tiktok-${player.id}`;
  try{return `tiktok-${canonicalTikTokUrl(row.url).match(/\/video\/(\d+)$/)[1]}`;}catch{identity=row.url.trim();}
 }else identity=JSON.stringify([row.creatorId?`creator:${row.creatorId}`:String(row.handle??'').toLowerCase(),row.caption??'',row.transcript??'',row.postedAt??'']);
 return `corpus-${digest(identity)}`;
}
function normalized(row,kind){
 if(!row||typeof row!=='object'||Array.isArray(row))throw new Error('Every corpus record must be an object.');
 if(kind==='real'&&(row.demo===true||row.demo==='true'||['example','synthetic'].includes(row.corpusKind)||row.synthetic===true))throw new Error('Fictional example or synthetic records cannot enter the real corpus.');
 const record=normalizeRecords([{...row,id:stableId(row),...(['example','synthetic'].includes(kind)?{demo:true}:{})}])[0];
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
const readRow=row=>row?{...JSON.parse(row.record_json),corpusKind:row.kind,corpusVerification:row.verification,corpusSource:row.source,corpusImportedAt:row.imported_at}:null;

export class Corpus{
 constructor(path=DEFAULT_CORPUS_PATH,{readOnly=false}={}){
  if(typeof path!=='string'||!path.trim())throw new Error('An explicit nonempty corpus database path is required.');
  this.path=path===':memory:'?path:resolve(path);
  if(!readOnly&&this.path!==':memory:')mkdirSync(dirname(this.path),{recursive:true});
  this.database=new DatabaseSync(this.path,{readOnly,timeout:5000});
  try{
   const version=this.database.prepare('PRAGMA user_version').get().user_version;
   if(version>1)throw new Error('This corpus uses a newer unsupported schema version.');
   if(readOnly){if(version!==1)throw new Error('Initialize this corpus before opening it read-only.');}
   else this.initialize();
  }catch(error){this.database.close();throw error;}
 }
 initialize(){
  const db=this.database;
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;
   CREATE TABLE IF NOT EXISTS corpus_videos(
    id TEXT NOT NULL UNIQUE, kind TEXT NOT NULL CHECK(kind IN ('real','example','synthetic','unverified')),
    verification TEXT NOT NULL, source TEXT NOT NULL, imported_at TEXT NOT NULL,
    record_json TEXT NOT NULL, handle TEXT NOT NULL, caption TEXT NOT NULL, transcript TEXT NOT NULL,
    hook TEXT NOT NULL, format TEXT NOT NULL, niche TEXT NOT NULL, bio TEXT NOT NULL,
    school TEXT NOT NULL, location TEXT NOT NULL, school_key TEXT NOT NULL, location_key TEXT NOT NULL,
    email TEXT NOT NULL, followers INTEGER, views INTEGER, likes INTEGER, comments INTEGER, shares INTEGER
   ) STRICT;
   CREATE INDEX IF NOT EXISTS corpus_kind ON corpus_videos(kind);
   CREATE INDEX IF NOT EXISTS corpus_handle ON corpus_videos(handle);
   CREATE INDEX IF NOT EXISTS corpus_followers ON corpus_videos(kind,followers);
   CREATE INDEX IF NOT EXISTS corpus_school ON corpus_videos(school_key);
   CREATE INDEX IF NOT EXISTS corpus_location ON corpus_videos(location_key);
   CREATE INDEX IF NOT EXISTS corpus_statistics ON corpus_videos(kind,handle,views,verification,imported_at);
   CREATE VIRTUAL TABLE IF NOT EXISTS corpus_fts USING fts5(${FTS_FIELDS.join(',')},content='corpus_videos',content_rowid='rowid',tokenize='porter unicode61');
   CREATE TRIGGER IF NOT EXISTS corpus_insert AFTER INSERT ON corpus_videos BEGIN
    INSERT INTO corpus_fts(rowid,${FTS_FIELDS.join(',')}) VALUES(new.rowid,${FTS_FIELDS.map(f=>`new.${f}`).join(',')});
   END;
   CREATE TRIGGER IF NOT EXISTS corpus_delete AFTER DELETE ON corpus_videos BEGIN
    INSERT INTO corpus_fts(corpus_fts,rowid,${FTS_FIELDS.join(',')}) VALUES('delete',old.rowid,${FTS_FIELDS.map(f=>`old.${f}`).join(',')});
   END;
   CREATE TRIGGER IF NOT EXISTS corpus_update AFTER UPDATE ON corpus_videos BEGIN
    INSERT INTO corpus_fts(corpus_fts,rowid,${FTS_FIELDS.join(',')}) VALUES('delete',old.rowid,${FTS_FIELDS.map(f=>`old.${f}`).join(',')});
    INSERT INTO corpus_fts(rowid,${FTS_FIELDS.join(',')}) VALUES(new.rowid,${FTS_FIELDS.map(f=>`new.${f}`).join(',')});
   END;
   PRAGMA user_version=1;`);
 }
 /** Atomic iterable import; no browser batch/count limit. Same records produce no update. */
 upsert(records,{kind,source='local-import',verification='user-supplied'}={}){
  if(kind!==undefined)checkKind(kind);
  if(typeof source!=='string'||!source.trim()||source.length>2000)throw new Error('Corpus source must contain 1–2000 characters.');
  if(!['user-supplied','provider-observed'].includes(verification))throw new Error('Invalid corpus verification label.');
  if(!records||typeof records==='string'||typeof records[Symbol.iterator]!=='function')throw new Error('Corpus import must be an iterable of records.');
  const columns=['id','kind','verification','source','imported_at','record_json',...FTS_FIELDS,'school_key','location_key','email',...METRICS];
  const write=this.database.prepare(`INSERT INTO corpus_videos(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')}) ON CONFLICT(id) DO UPDATE SET ${columns.filter(f=>f!=='id').map(f=>`${f}=excluded.${f}`).join(',')} WHERE corpus_videos.record_json<>excluded.record_json OR corpus_videos.kind<>excluded.kind OR corpus_videos.verification<>excluded.verification OR corpus_videos.source<>excluded.source`);
  const existing=this.database.prepare('SELECT kind FROM corpus_videos WHERE id=?');
  const importedAt=new Date().toISOString();let processed=0,changed=0;
  this.database.exec('BEGIN IMMEDIATE');
  try{
   for(const row of records){
    const rowKind=kind??((row?.demo===true||row?.demo==='true')?'example':row?.corpusKind==='synthetic'?'synthetic':'unverified');
    const record=normalized(row,rowKind);
    if(rowKind==='real'&&['synthetic','example'].includes(existing.get(record.id)?.kind))throw new Error('Cannot promote an existing synthetic/example record ID into the real corpus.');
    const values={...record,id:record.id,kind:rowKind,verification:rowKind==='real'?verification:rowKind==='synthetic'?'synthetic':rowKind==='example'?'fixture':'user-supplied',source:source.trim(),imported_at:importedAt,record_json:JSON.stringify(record),handle:creatorKey(record),transcript:indexedTranscript(record),school_key:fieldKey(record.school,'school'),location_key:fieldKey(record.location,'location')};
    for(const metric of METRICS)if(record.unavailableMetrics.includes(metric))values[metric]=null;
    changed+=Number(write.run(...columns.map(field=>values[field])).changes);processed++;
   }
   this.database.exec('COMMIT');
  }catch(error){this.database.exec('ROLLBACK');throw error;}
  return {processed,changed,total:this.stats().total};
 }
 /** Safely tokenize text, apply SQL bounds, and return only a bounded result page. */
 search(query='',options={}){
  if(typeof query!=='string'||query.length>6000)throw new Error('Corpus query must be text of at most 6000 characters.');
  if(!options||typeof options!=='object'||Array.isArray(options))throw new Error('Search options must be an object.');
  const kind=checkKind(options.kind??'real',true);
  const plan=searchPlan(query,{},[]);
  let limit=integer(options.limit??20,'Search limit',1,1000);
  if(plan.filters.limit!==undefined)limit=Math.min(limit,integer(Number(plan.filters.limit),'Requested count',1,1000));
  const offset=integer(options.offset??0,'Search offset');
  const terms=plan.terms.flatMap(term=>term.match(/[\p{L}\p{N}_]+/gu)||[]);
  const conditions=[],parameters=[];
  if(kind!=='all'){conditions.push('v.kind=?');parameters.push(kind);}
  if(terms.length){conditions.push('corpus_fts MATCH ?');parameters.push(terms.map(term=>`"${term.replaceAll('"','""')}"`).join(' AND '));}
  for(const filters of [plan.filters,options]){
   for(const [key,operator]of [['minFollowers','>='],['maxFollowers','<=']])if(filters[key]!==undefined){conditions.push(`v.followers ${operator} ?`);parameters.push(bound(filters[key],key));}
   for(const field of ['school','location'])if(filters[field]){conditions.push(`v.${field}_key=?`);parameters.push(fieldKey(filters[field],field));}
   if(filters.emailOnly||filters.hasEmail||filters.emailInBio)conditions.push("v.email<>''");
   if(filters.emailInBio)conditions.push('instr(lower(v.bio),lower(v.email))>0');
   if(filters.niche){conditions.push("instr(lower(v.niche),lower(?))>0");parameters.push(String(filters.niche));}
   if(filters.format){conditions.push('lower(v.format)=lower(?)');parameters.push(String(filters.format));}
   if(filters.handle){conditions.push("lower(json_extract(v.record_json,'$.handle'))=lower(?)");parameters.push(String(filters.handle).startsWith('@')?String(filters.handle):`@${filters.handle}`);}
  }
  const unique=options.uniqueCreators??/\bcreators?|influencers?\b/i.test(query);
  const matched=`SELECT v.record_json,v.kind,v.verification,v.source,v.imported_at,v.handle,v.id,${terms.length?'bm25(corpus_fts)':'0'} AS score FROM corpus_videos v ${terms.length?'JOIN corpus_fts ON corpus_fts.rowid=v.rowid':''} ${conditions.length?`WHERE ${conditions.join(' AND ')}`:''}`;
  const sql=unique?`WITH matches AS MATERIALIZED (${matched}),picked AS (SELECT *,row_number() OVER(PARTITION BY lower(handle) ORDER BY score,id) AS creator_row FROM matches) SELECT * FROM picked WHERE creator_row=1 ORDER BY score,id LIMIT ? OFFSET ?`:`${matched} ORDER BY score,v.id LIMIT ? OFFSET ?`;
  return this.database.prepare(sql).all(...parameters,limit,offset).map(readRow);
 }
 get(id){if(typeof id!=='string')throw new Error('Corpus record ID must be text.');return readRow(this.database.prepare('SELECT record_json,kind,verification,source,imported_at FROM corpus_videos WHERE id=?').get(id));}
 stats(){
  const byKind={real:0,example:0,synthetic:0,unverified:0};
  for(const row of this.database.prepare('SELECT kind,COUNT(*) AS count FROM corpus_videos GROUP BY kind').all())byKind[row.kind]=row.count;
  const summary=this.database.prepare(`SELECT COUNT(*) AS total,COUNT(DISTINCT lower(handle)) AS uniqueCreators,COUNT(views) AS knownViewRecords,SUM(CASE WHEN kind='real' AND verification='provider-observed' THEN 1 ELSE 0 END) AS providerObservedReal,MAX(imported_at) AS lastImportedAt FROM corpus_videos`).get();
  return {...summary,providerObservedReal:summary.providerObservedReal??0,byKind};
 }
 close(){this.database.close();}
}
export function openCorpus(path=DEFAULT_CORPUS_PATH,options){return new Corpus(path,options);}

/** One awaited provider call per normalized unique handle. No automatic retry. */
export async function collectCreatorHandles(corpus,handles,{env=process.env,discoverCreator}={}){
 if(!Array.isArray(handles))throw new Error('Creator handles must be an array.');
 const normalizedHandles=[...new Set(handles.map(value=>{
  if(typeof value!=='string')throw new Error('Every creator handle must be text.');
  const handle=value.trim().replace(/^@/,'').toLowerCase();
  if(!/^[a-z0-9_][a-z0-9_.]{0,79}$/.test(handle))throw new Error('Use creator handles, not profile URLs or arbitrary text.');
  return `@${handle}`;
 }))];
 const discover=discoverCreator??(await import('./social.js')).discoverCreator;
 if(typeof discover!=='function')throw new Error('The creator-profile adapter is unavailable in this version.');
 const summary={profilesRequested:0,profilesImported:0,recordsChanged:0,failures:[]};
 for(const handle of normalizedHandles){
  summary.profilesRequested++;
  try{
   const result=await discover(handle,env);
   if(!Array.isArray(result?.records)||!result.records.length){summary.failures.push({handle,code:'NO_PUBLIC_RECORDS',notice:'No public profile videos were returned.'});continue;}
   if(result.provider!=='tiktok-creator-embed'||result.records.some(record=>record.handle?.toLowerCase()!==handle||record.sourceType!=='tiktok-creator-embed'))throw new Error('Invalid provider identity.');
   const imported=corpus.upsert(result.records,{kind:'real',source:`tiktok-creator-embed:${handle}`,verification:'provider-observed'});
   summary.recordsChanged+=imported.changed;summary.profilesImported++;
  }catch{summary.failures.push({handle,code:'PROFILE_REQUEST_FAILED',notice:'Profile collection failed. No automatic retry was attempted.'});}
 }
 return summary;
}
