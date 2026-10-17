import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {readJsonLines} from '../scripts/import-research.mjs';
import {openCorpus} from '../lib/corpus.js';
const root=resolve(import.meta.dirname,'..');
function temp(t){const directory=mkdtempSync(join(tmpdir(),'openreel-research-test-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));return directory;}
const fixture={id:'import-test',handle:'@fixture',caption:'Explicitly synthetic unit-test fixture',transcript:'A newline\nA cat 🐈\u2028U+2028 remains text',url:'https://www.tiktok.com/@fixture/video/1234567890123456789',sourceType:'unit-test-fixture',fetchedAt:'2026-10-17T21:06:24.583Z'};

test('UTF8 streaming survives chunk boundaries, BOM, CRLF, U+2028 and final line without newline',t=>{
 const file=join(temp(t),'input.jsonl');writeFileSync(file,'\ufeff'+JSON.stringify(fixture)+'\r\n\n'+JSON.stringify({...fixture,id:'second'}));
 const records=[...readJsonLines(file,{chunkSize:3})];assert.equal(records.length,2);assert.equal(records[0].transcript,fixture.transcript);assert.equal(records[1].id,'second');
});

test('invalid UTF8, malformed JSON and excessive line length fail without echoing contents',t=>{
 const directory=temp(t),file=join(directory,'input.jsonl');
 for(const data of [Buffer.from([0xff,0x0a]),'{"secret": invalid}',JSON.stringify(['not a record'])]){
  writeFileSync(file,data);assert.throws(()=>[...readJsonLines(file)],/UTF-8|JSON|object/);
 }
 writeFileSync(file,JSON.stringify({text:'x'.repeat(100)}));assert.throws(()=>[...readJsonLines(file,{maxLineCharacters:20})],/limit/);
});

test('streaming import rolls back prior inserts after a later malformed line',t=>{
 const directory=temp(t),input=join(directory,'input.jsonl'),database=join(directory,'corpus.sqlite');
 let corpus=openCorpus(database);corpus.upsert([{...fixture,id:'existing',caption:'Original'}],{kind:'real'});corpus.close();
 writeFileSync(input,JSON.stringify({...fixture,id:'existing',caption:'Changed'})+'\n'+JSON.stringify(fixture)+'\n{broken json}\n');
 const result=spawnSync(process.execPath,['scripts/import-research.mjs','--input',input,'--db',database],{cwd:root,encoding:'utf8'});assert.equal(result.status,1,result.stdout);assert.match(result.stderr,/JSON/);
 corpus=openCorpus(database);try{assert.equal(corpus.stats().total,1);assert.equal(corpus.get('existing').caption,'Original');assert.equal(corpus.get('import-test'),null);}finally{corpus.close();}
});

test('CLI requires explicit input and database paths',t=>{
 const input=join(temp(t),'input.jsonl');writeFileSync(input,JSON.stringify(fixture));
 const result=spawnSync(process.execPath,['scripts/import-research.mjs','--input',input],{cwd:root,encoding:'utf8'});assert.equal(result.status,1);assert.match(result.stderr,/--db/);
});


test('successful streaming import retains numeric creator identity and archive provenance',t=>{
 const directory=temp(t),input=join(directory,'input.jsonl'),database=join(directory,'corpus.sqlite');
 const numeric={...fixture,id:'tiktok-1234567890123456789',handle:'',creatorId:'42',url:'https://www.tiktok.com/player/v1/1234567890123456789',visualDescription:'Explicitly synthetic upstream-description fixture',descriptionSource:'upstream-model',archiveProvenance:{license:'CC-BY-NC-4.0',creatorId:'42',engagementObservedOn:'2024-07-31',postedAtTimezone:null}};
 writeFileSync(input,JSON.stringify(numeric)+'\n');
 const result=spawnSync(process.execPath,['scripts/import-research.mjs','--input',input,'--db',database],{cwd:root,encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).processed,1);
 const corpus=openCorpus(database);try{const row=corpus.get(numeric.id);assert.equal(row.handle,'');assert.equal(row.creatorId,'42');assert.equal(row.visualDescription,numeric.visualDescription);assert.equal(row.descriptionSource,'upstream-model');assert.deepEqual(row.archiveProvenance,numeric.archiveProvenance);assert.equal(row.corpusVerification,'user-supplied');assert.match(row.corpusSource,/CC-BY-NC-4.0/);}finally{corpus.close();}
});
