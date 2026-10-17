#!/usr/bin/env node
/** Original code MIT. Imported research data keeps its own license/provenance. */
import {openSync,readSync,closeSync,fstatSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {performance} from 'node:perf_hooks';
import {openCorpus} from '../lib/corpus.js';

export const DEFAULT_SOURCE='lingbow/tiktok-video-engagement-200k@ef0da889e05dea58754bc0ce2d0e2ed6b697fdf2; CC-BY-NC-4.0; archival upstream dataset';

/** Split on LF only: JSON strings can contain U+2028, and UTF8 can cross reads. */
export function* readJsonLines(path,{chunkSize=256*1024,maxLineCharacters=1024*1024}={}){
 if(!Number.isSafeInteger(chunkSize)||chunkSize<1||chunkSize>4*1024*1024)throw new Error('Invalid JSONL chunk size.');
 if(!Number.isSafeInteger(maxLineCharacters)||maxLineCharacters<1)throw new Error('Invalid JSONL line limit.');
 const file=openSync(path,'r'),decoder=new TextDecoder('utf-8',{fatal:true}),chunk=Buffer.alloc(chunkSize);
 let pending='',line=0;
 const parse=text=>{
  line++;if(line===1)text=text.replace(/^\uFEFF/,'');text=text.replace(/\r$/,'');
  if(text.length>maxLineCharacters)throw new Error(`JSONL line ${line} exceeds the character limit.`);
  if(!text.trim())return undefined;
  let record;try{record=JSON.parse(text);}catch{throw new Error(`Invalid JSON on line ${line}.`);}
  if(!record||typeof record!=='object'||Array.isArray(record))throw new Error(`JSONL line ${line} must contain a record object.`);
  return record;
 };
 try{
  if(!fstatSync(file).isFile())throw new Error('JSONL input must be a regular file.');
  while(true){
   const length=readSync(file,chunk,0,chunk.length,null);
   try{pending+=decoder.decode(length?chunk.subarray(0,length):undefined,{stream:Boolean(length)});}catch{throw new Error(`Invalid UTF-8 near JSONL line ${line+1}.`);}
   let end;
   while((end=pending.indexOf('\n'))!==-1){const record=parse(pending.slice(0,end));pending=pending.slice(end+1);if(record!==undefined)yield record;}
   if(pending.length>maxLineCharacters)throw new Error(`JSONL line ${line+1} exceeds the character limit.`);
   if(!length){if(pending){const record=parse(pending);if(record!==undefined)yield record;}break;}
  }
 }finally{closeSync(file);}
}

export function main(args=process.argv.slice(2)){
 const {values,positionals}=parseArgs({args,allowPositionals:true,options:{input:{type:'string'},db:{type:'string'},source:{type:'string'},help:{type:'boolean',short:'h'}}});
 if(values.help){console.log('node scripts/import-research.mjs --input records.jsonl --db data/research.sqlite [--source attribution]\nThe explicit database receives user-supplied real archival records; dataset licenses remain in force.');return;}
 if(positionals.length||!values.input||!values.db)throw new Error('Provide explicit --input records.jsonl and --db database.sqlite paths.');
 if(values.db===':memory:'||resolve(values.input)===resolve(values.db))throw new Error('--db must be a separate persistent database path.');
 const corpus=openCorpus(values.db),started=performance.now();
 try{const result=corpus.upsert(readJsonLines(values.input),{kind:'real',verification:'user-supplied',source:values.source??DEFAULT_SOURCE});console.log(JSON.stringify({...result,importMilliseconds:performance.now()-started,stats:corpus.stats()},null,2));}
 finally{corpus.close();}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{main();}catch(error){console.error(error instanceof Error?error.message:'Research import failed.');process.exitCode=1;}
}
