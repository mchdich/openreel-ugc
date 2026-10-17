#!/usr/bin/env node
/** Node 24+ SQLite corpus CLI. No server, browser bundle, or provider SDK required. */
import {readFileSync} from 'node:fs';
import {parseArgs} from 'node:util';
import {performance} from 'node:perf_hooks';
import {openCorpus,DEFAULT_CORPUS_PATH,collectCreatorHandles} from '../lib/corpus.js';

const usage=`OpenReel local corpus (Node 24+)
  node scripts/corpus.js init [--db data/corpus.sqlite]
  node scripts/corpus.js import records.json [--kind real|example|synthetic|unverified] [--source label] [--db path]
  node scripts/corpus.js search "query" [--kind real|example|synthetic|unverified|all] [--limit 20] [--offset 0] [--db path]
  node scripts/corpus.js stats [--db path]
  node scripts/corpus.js collect-profiles handles.txt [--db path]
  node scripts/corpus.js benchmark --db data/synthetic-benchmark.sqlite [--count 150000]
Search filters: --school text --location text --min-followers N --max-followers N --email-only
Default DB: ${DEFAULT_CORPUS_PATH}
Real imports require non-fictional canonical TikTok URLs, sourceType, and fetchedAt.
A synthetic benchmark is capacity evidence only; it never establishes a real corpus.`;

function* benchmarkRows(count){
 for(let i=0;i<count;i++)yield {id:`synthetic-benchmark-${String(i).padStart(8,'0')}`,handle:`synthetic_${i%5000}`,caption:`Synthetic benchmark campus cooking clip ${i}`,transcript:'Synthetic generated opening, product reveal, and short example. Not an actual video.',hook:'Synthetic example opening',format:'Synthetic list',niche:'synthetic',followers:1000+i%90000,views:i,likes:0,comments:0,shares:0,demo:true};
}
try{
 const {values,positionals}=parseArgs({allowPositionals:true,options:{db:{type:'string'},kind:{type:'string'},source:{type:'string'},limit:{type:'string'},offset:{type:'string'},count:{type:'string'},school:{type:'string'},location:{type:'string'},'min-followers':{type:'string'},'max-followers':{type:'string'},'email-only':{type:'boolean'},help:{type:'boolean',short:'h'}}});
 if(values.help){console.log(usage);}else{
  const [command,...args]=positionals;
  if(!['init','import','search','stats','collect-profiles','benchmark'].includes(command))throw new Error(`Choose a corpus command.\n${usage}`);
  if(['import','collect-profiles'].includes(command)&&args.length!==1)throw new Error(`${command} requires one input file.`);
  if(['init','stats','benchmark'].includes(command)&&args.length)throw new Error(`${command} takes no positional file.`);
  if(command==='benchmark'&&!values.db)throw new Error('Synthetic benchmark requires an explicit --db path, separate from your real corpus.');
  const count=Number(values.count??150000);
  if(command==='benchmark'&&(!Number.isSafeInteger(count)||count<1||count>10000000))throw new Error('Benchmark count must be a positive integer up to 10000000.');
  let input;
  if(command==='import'){
   const parsed=JSON.parse(readFileSync(args[0],'utf8').replace(/^\uFEFF/,''));
   input=Array.isArray(parsed)?{records:parsed}:parsed;
   if(!input||!Array.isArray(input.records))throw new Error('Import JSON must be an array or an object with a records array.');
  }
  if(command==='collect-profiles'){
   const text=readFileSync(args[0],'utf8').replace(/^\uFEFF/,'').trim();
   input=text.startsWith('[')?JSON.parse(text):text.split(/[\s,]+/).filter(Boolean);
   if(!Array.isArray(input))throw new Error('Handle file must contain a JSON array or one handle per line.');
  }
  const db=openCorpus(values.db??DEFAULT_CORPUS_PATH);
  try{
   let result;
   if(command==='init')result={database:db.path,...db.stats()};
   if(command==='stats')result=db.stats();
   if(command==='import')result=db.upsert(input.records,{kind:values.kind??input.kind,source:values.source??input.source??args[0]});
   if(command==='search')result={query:args.join(' '),records:db.search(args.join(' '),{kind:values.kind??'real',limit:Number(values.limit??20),offset:Number(values.offset??0),...(values.school?{school:values.school}:{}),...(values.location?{location:values.location}:{}),...(values['min-followers']!==undefined?{minFollowers:Number(values['min-followers'])}:{}),...(values['max-followers']!==undefined?{maxFollowers:Number(values['max-followers'])}:{}),emailOnly:values['email-only']??false}),stats:db.stats()};
   if(command==='collect-profiles')result={...await collectCreatorHandles(db,input),stats:db.stats()};
   if(command==='benchmark'){
    if(db.stats().total!==0)throw new Error('Use an empty separate database for a synthetic benchmark.');
    const started=performance.now();const imported=db.upsert(benchmarkRows(count),{kind:'synthetic',source:'generated-capacity-benchmark'});const importMilliseconds=performance.now()-started;
    const searched=performance.now();const rows=db.search('cooking',{kind:'synthetic',limit:20});
    result={synthetic:true,notice:'Generated synthetic records only. This is not a real video corpus or parity evidence.',...imported,importMilliseconds,searchMilliseconds:performance.now()-searched,returned:rows.length,stats:db.stats()};
   }
   console.log(JSON.stringify(result,null,2));
  }finally{db.close();}
 }
}catch(error){console.error(error instanceof Error?error.message:'Corpus command failed.');process.exitCode=1;}
