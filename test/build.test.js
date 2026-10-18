import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

test('generated Worker retains sampled visual citations through D1 search, pattern sampling and dated refresh',async()=>{
 const {DatabaseSync}=await import('node:sqlite'),db=new DatabaseSync(':memory:');db.exec(await readFile(new URL('../drizzle/0000_corpus.sql',import.meta.url),'utf8'));
 const binding={prepare(sql){return {bind(...p){return {all:async()=>({success:true,results:db.prepare(sql).all(...p)}),first:async()=>db.prepare(sql).get(...p)||null};},all:async()=>({success:true,results:db.prepare(sql).all()})};},batch:async statements=>Promise.all(statements.map(s=>s.all()))};
 const oldFetch=globalThis.fetch;
 try{
  // Build explicitly: this test must exercise the generated module, including all new bindings.
  execFileSync(process.execPath,['scripts/build.js'],{cwd:fileURLToPath(new URL('../',import.meta.url)),stdio:'pipe'});
  const {default:worker}=await import(new URL('../dist/server/index.js',import.meta.url)),{openWorkerCorpus}=await import('../lib/corpus-worker.js'),corpus=openWorkerCorpus(binding);
  const rows=[0,1].map(i=>({id:`tiktok-${33001+i}`,handle:`@sampled_${i}`,creatorId:String(34000+i),url:`https://www.tiktok.com/@sampled_${i}/video/${33001+i}`,caption:'Coffee fixture',transcript:'Original transcript',sourceType:'tiktok-public-post',fetchedAt:'2024-10-05T00:00:00.000Z',postedAt:'2024-10-04T00:00:00.000Z',demo:false,visualDescription:'The samples show a step-by-step tutorial with close-up shots of coffee preparation on a dark table.',descriptionSource:'openreel-vision',visualEvidence:{sourceType:'tiktok-public-player-frames',sourceUrl:`https://www.tiktok.com/@sampled_${i}/video/${33001+i}`,creatorId:String(34000+i),observedAt:'2024-10-05T01:00:00.000Z',duration:10,frames:[{timestamp:.04,sha256:'a'.repeat(64)},{timestamp:6,sha256:'b'.repeat(64)}]}}));
  await corpus.upsert(rows,{kind:'real',source:'controlled independent capture',verification:'provider-observed'});
  const request=(path,body)=>worker.fetch(new Request('https://sampled-build.example'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),{DB:binding,OPENREEL_POST_METADATA:'true'});
  const search=await request('/api/corpus/search',{query:'coffee'});assert.equal(search.status,200);assert.deepEqual((await search.json()).records[0].visualEvidence,rows[0].visualEvidence);
  const sample=await request('/api/corpus/patterns',{query:'coffee'});assert.equal(sample.status,200);assert.equal((await sample.json()).records.filter(r=>r.descriptionSource==='openreel-vision').length,2);
  globalThis.fetch=async url=>{assert.equal(url,rows[0].url);return new Response('<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">'+JSON.stringify({__DEFAULT_SCOPE__:{'webapp.video-detail':{statusCode:0,itemInfo:{itemStruct:{id:'33001',privateItem:false,createTime:'1728000000',desc:'Fresh coffee fixture',author:{id:'34000',uniqueId:'sampled_0',privateAccount:false},stats:{playCount:0}}}}}})+'</script>',{headers:{'content-type':'text/html'}});};
  const refreshed=await request('/api/videos/import',{url:rows[0].url});assert.equal(refreshed.status,200);const record=(await refreshed.json()).record;assert.equal(record.views,0);assert.equal(record.descriptionSource,'openreel-vision');assert.deepEqual(record.visualEvidence,rows[0].visualEvidence);assert.equal(record.transcript,'');
  const saved=await corpus.get(rows[0].id);assert.deepEqual(saved.visualEvidence,rows[0].visualEvidence);assert.equal(saved.corpusVerification,'provider-observed');assert.equal((await corpus.stats()).total,2);assert.doesNotMatch(JSON.stringify(saved),/data:image|base64/);
 }finally{globalThis.fetch=oldFetch;db.close();}
});

test('portable Worker serves the exact client and handles research without Node dependencies',async()=>{
  const root=new URL('../',import.meta.url);
  execFileSync(process.execPath,['scripts/build.js'],{cwd:fileURLToPath(root),stdio:'pipe'});
  const {default:worker}=await import(new URL('../dist/server/index.js',import.meta.url));
  const response=await worker.fetch(new Request('https://example.test/'));
  assert.equal(response.status,200);
  assert.equal(await response.text(),await readFile(new URL('../public/index.html',import.meta.url),'utf8'));
  assert.match(response.headers.get('content-security-policy'),/script-src 'self'/);
  const status=await worker.fetch(new Request('https://example.test/api/status'));
  assert.equal((await status.json()).providerConfigured,false);
  const answer=await worker.fetch(new Request('https://example.test/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:'Find NYU creators',records:[]})}));
  assert.equal(answer.status,200);
  const result=await answer.json();assert.deepEqual(result.creators,[]);assert.match(result.summary,/no creators/i);
  const dated=await worker.fetch(new Request('https://example.test/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:'What skincare formats are rising as of 2024-07-21 over 7 days?',records:[]})}));
  assert.equal(dated.status,200);assert.equal((await dated.json()).temporal.windows.prior.start,'2024-07-08');
  assert.equal((await worker.fetch(new Request('https://example.test/missing'))).status,404);
  assert.equal((await worker.fetch(new Request('https://example.test/',{method:'POST'}))).status,405);
  const original=globalThis.fetch;let postCalls=0;
  try{
    globalThis.fetch=async(url,init)=>{postCalls++;assert.equal(url,'https://www.tiktok.com/@public_fixture/video/123456');assert.equal(init.redirect,'error');return new Response('<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">'+JSON.stringify({__DEFAULT_SCOPE__:{'webapp.video-detail':{statusCode:0,itemInfo:{itemStruct:{id:'123456',privateItem:false,createTime:'1780918110',author:{id:'999',uniqueId:'public_fixture',privateAccount:false},stats:{playCount:0}}}}}})+'</script>',{headers:{'content-type':'text/html'}});};
    const imported=await worker.fetch(new Request('https://example.test/api/videos/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:'https://www.tiktok.com/@public_fixture/video/123456'})}),{OPENREEL_POST_METADATA:'true'});
    assert.equal(imported.status,200);const post=await imported.json();assert.equal(post.record.postedAt,'2026-06-08T11:28:30.000Z');assert.equal(post.record.views,0);assert.equal(post.record.sourceType,'tiktok-public-post');assert.equal(postCalls,1);
  }finally{globalThis.fetch=original;}
});

test('portable Worker binds its hosted corpus through D1 without runtime schema changes',async()=>{
  const {DatabaseSync}=await import('node:sqlite');const db=new DatabaseSync(':memory:');
  db.exec(await readFile(new URL('../drizzle/0000_corpus.sql',import.meta.url),'utf8'));
  let writes=0;
  const binding={prepare(sql){assert.doesNotMatch(sql,/CREATE|ALTER|DROP/i);if(/^\s*(?:INSERT|UPDATE|DELETE)/i.test(sql))writes++;return {bind(...parameters){return {all:async()=>({success:true,results:db.prepare(sql).all(...parameters)}),first:async()=>db.prepare(sql).get(...parameters)||null};},all:async()=>({success:true,results:db.prepare(sql).all()})};},batch:async statements=>Promise.all(statements.map(s=>s.all()))};
  try{
    const {default:worker}=await import(new URL('../dist/server/index.js',import.meta.url));
    const response=await worker.fetch(new Request('https://d1-build.example/api/status'),{DB:binding});assert.equal((await response.json()).corpusAvailable,true);
    const stats=await worker.fetch(new Request('https://d1-build.example/api/corpus/stats'),{DB:binding});assert.equal(stats.status,200);assert.equal((await stats.json()).corpus.total,0);assert.equal(writes,0);
    const {openWorkerCorpus}=await import('../lib/corpus-worker.js');
    await openWorkerCorpus(binding).upsert(Array.from({length:4},(_,i)=>({id:`build-${i}`,handle:`@build_${i}`,creatorId:String(100+i),caption:'Controlled build fixture',format:i<2?'Unboxing':'Day in the life',url:`https://www.tiktok.com/@build_${i}/video/${100+i}`,sourceType:'test-fixture',fetchedAt:'2024-01-01T00:00:00Z',demo:false})),{kind:'real',source:'controlled build test'});
    const beforeBrowse=writes;
    const patterns=await worker.fetch(new Request('https://d1-build.example/api/corpus/patterns',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:''})}),{DB:binding});
    assert.equal(patterns.status,200);const sample=await patterns.json();assert.equal(sample.records.length,4);assert.equal(sample.selection.method,'format-stratified');assert.equal(sample.corpus.byKind.real,4);assert.equal(writes,beforeBrowse);
    const originalFetch=globalThis.fetch;
    try{
      globalThis.fetch=async url=>String(url).endsWith('/responses')?new Response(JSON.stringify({status:'completed',output:[{type:'web_search_call',status:'completed',action:{sources:[{url:'https://creator.example/about'}]}},{type:'message',content:[{type:'output_text',text:JSON.stringify({candidates:[{handle:'freshbuild',sourceUrl:'https://creator.example/about'}]})}]}]}),{headers:{'content-type':'application/json'}}):new Response('<script id="__FRONTITY_CONNECT_STATE__">'+JSON.stringify({source:{data:{'/embed/@freshbuild':{isReady:true,isError:false,userInfo:{id:'9990',uniqueId:'freshbuild',nickname:'Fixture',code:200,privateAccount:false,signature:'Coffee creator',followerCount:2000},videoList:[{id:'9991',desc:'Coffee fixture',privateItem:false,authorUniqueId:'freshbuild',playCount:20}]}}}})+'</script>',{headers:{'content-type':'text/html'}});
      const discovery=await worker.fetch(new Request('https://d1-build.example/api/videos/discover',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer owner-test-token'},body:JSON.stringify({query:'Find coffee creators'})}),{DB:binding,OPENAI_API_KEY:'provider-test-secret',OPENAI_MODEL:'gpt-5.4-mini',OPENREEL_WEB_DISCOVERY:'true',OPENREEL_API_TOKEN:'owner-test-token'});
      assert.equal(discovery.status,200);const found=await discovery.json();assert.equal(found.provider,'web-assisted-public-profile-verification');assert.equal(found.records[0].handle,'@freshbuild');assert.ok(writes>beforeBrowse);
    }finally{globalThis.fetch=originalFetch;}
    await openWorkerCorpus(binding).upsert(['Harvard University','Massachusetts Institute of Technology'].map((school,i)=>({id:`school-build-${i}`,handle:`@school_${i}`,caption:'Coffee brewing fixture',school,url:`https://www.tiktok.com/@school_${i}/video/${8000+i}`,sourceType:'test-fixture',fetchedAt:'2024-01-01T00:00:00Z',demo:false})),{kind:'real',source:'controlled parser regression'});
    for(const [query,expected] of [['Find Coffee creators',3],['Find coffee creators at Harvard University',1],['Find coffee creators at Massachusetts Institute of Technology',1]]){
      const result=await worker.fetch(new Request('https://d1-build.example/api/corpus/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query})}),{DB:binding});
      assert.equal(result.status,200);assert.equal((await result.json()).records.length,expected,query);
    }
    const description='The video shows a split-screen layout with two people beside one another. A date sticker appears at the bottom of both scenes.';
    await openWorkerCorpus(binding).upsert([0,1].map(i=>({id:`visual-build-${i}`,handle:`@visual_${i}`,creatorId:String(5000+i),caption:'Split screen fixture',visualDescription:description,descriptionSource:'user-supplied',url:`https://www.tiktok.com/@visual_${i}/video/${9000+i}`,sourceType:'test-fixture',fetchedAt:'2024-01-01T00:00:00Z',demo:false})),{kind:'real',source:'controlled visual fixture'});
    const initialFetch=globalThis.fetch,beforeDetection=writes;let calls=0;
    try{
      globalThis.fetch=async(url,init)=>{calls++;const review=JSON.parse(init.body).response_format.json_schema.name==='visual_pattern_review';return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({patterns:[{...(review?{patternIndex:0}:{}),title:'Split-screen clips with on-screen date labels',description:'Paired scenes share a split-screen layout and visible date stickers.',components:[{featureId:'split-screen',label:'Split-screen paired layout',evidence:[0,1].map(i=>({recordId:`visual-build-${i}`,quote:'The video shows a split-screen layout with two people beside one another.'}))},{featureId:'date-overlay',label:'A visible date sticker',evidence:[0,1].map(i=>({recordId:`visual-build-${i}`,quote:'A date sticker appears at the bottom of both scenes.'}))}]}]})}}]}),{headers:{'content-type':'application/json'}});};
      const result=await worker.fetch(new Request('https://d1-build.example/api/corpus/visual-patterns',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer owner-test-token'},body:JSON.stringify({query:'split screen'})}),{DB:binding,OPENAI_API_KEY:'provider-test-secret',OPENAI_MODEL:'gpt-5.4-mini',OPENREEL_API_TOKEN:'owner-test-token'});
      assert.equal(result.status,200);const body=await result.json();assert.equal(body.patterns.length,1);assert.equal(body.modelCalls,2);assert.equal(calls,2);assert.equal(writes,beforeDetection);
    }finally{globalThis.fetch=initialFetch;}
    const postFetch=globalThis.fetch;let postChecks=0;
    try{
      globalThis.fetch=async(url)=>{
        if(url==='https://www.tiktok.com/embed/@metabuild')return new Response('<script id="__FRONTITY_CONNECT_STATE__">'+JSON.stringify({source:{data:{'/embed/@metabuild':{isReady:true,isError:false,userInfo:{id:'11000',uniqueId:'metabuild',code:200,privateAccount:false,signature:'Tea creator',followerCount:1200},videoList:Array.from({length:8},(_,i)=>({id:String(11001+i),desc:'Tea fixture',privateItem:false,authorUniqueId:'metabuild',playCount:20}))}}}})+'</script>',{headers:{'content-type':'text/html'}});
        assert.match(url,/^https:\/\/www\.tiktok\.com\/@metabuild\/video\/1100[3-8]$/);postChecks++;const id=url.split('/').at(-1);
        return new Response('<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">'+JSON.stringify({__DEFAULT_SCOPE__:{'webapp.video-detail':{statusCode:0,itemInfo:{itemStruct:{id,privateItem:false,createTime:'1728000000',desc:'Tea fixture',author:{id:'11000',uniqueId:'metabuild',privateAccount:false,signature:'Tea creator'},authorStats:{followerCount:999},stats:{playCount:0}}}}}})+'</script>',{headers:{'content-type':'text/html'}});
      };
      const result=await worker.fetch(new Request('https://d1-build.example/api/videos/creator',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({handle:'metabuild'})}),{DB:binding,OPENREEL_POST_METADATA:'true'});
      assert.equal(result.status,200);const body=await result.json();assert.equal(body.records.length,8);assert.equal(body.postMetadata.dated,6);assert.equal(postChecks,6);assert.ok(body.records.every(r=>r.followers===999));
      for(const record of body.records){const saved=JSON.parse(db.prepare('SELECT record_json FROM corpus_videos WHERE id=?').get(record.id).record_json);assert.equal(saved.postedAt,record.postedAt);assert.equal(saved.sourceType,record.sourceType);assert.equal(saved.followers,999);}
      assert.equal(body.records.filter(r=>r.sourceType==='tiktok-public-profile-and-post'&&!r.postedAt).length,2);
    }finally{globalThis.fetch=postFetch;}
  }finally{db.close();}
});

test('generated Worker grows dated coverage across creator-deduplicated searches without leaking internal rows',async()=>{
 const {DatabaseSync}=await import('node:sqlite'),db=new DatabaseSync(':memory:');db.exec(await readFile(new URL('../drizzle/0000_corpus.sql',import.meta.url),'utf8'));
 let queries=0;
 const binding={prepare(sql){queries++;return {bind(...p){return {all:async()=>({success:true,results:db.prepare(sql).all(...p)}),first:async()=>db.prepare(sql).get(...p)||null};}};},batch:async statements=>Promise.all(statements.map(s=>s.all()))};
 const original=globalThis.fetch,checked=[];
 try{
  const {openWorkerCorpus}=await import('../lib/corpus-worker.js');await openWorkerCorpus(binding).upsert([{id:'tiktok-22001',creatorId:'22000',handle:'@incrementbuild',url:'https://www.tiktok.com/@incrementbuild/video/22001',caption:'Coffee creator fixture',sourceType:'tiktok-creator-embed',fetchedAt:'2024-01-01T00:00:00.000Z',demo:false}],{kind:'real',source:'controlled seed',verification:'provider-observed'});
  globalThis.fetch=async url=>{
   if(url.endsWith('/embed/@incrementbuild'))return new Response('<script id="__FRONTITY_CONNECT_STATE__">'+JSON.stringify({source:{data:{'/embed/@incrementbuild':{isReady:true,isError:false,userInfo:{id:'22000',uniqueId:'incrementbuild',code:200,privateAccount:false,signature:'Coffee creator',followerCount:1500},videoList:Array.from({length:8},(_,i)=>({id:String(22001+i),desc:'Coffee fixture',privateItem:false,authorUniqueId:'incrementbuild',playCount:100}))}}}})+'</script>',{headers:{'content-type':'text/html'}});
   assert.match(url,/^https:\/\/www\.tiktok\.com\/@incrementbuild\/video\/2200[1-8]$/);const id=url.split('/').at(-1);checked.push(id);
   return new Response('<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">'+JSON.stringify({__DEFAULT_SCOPE__:{'webapp.video-detail':{statusCode:0,itemInfo:{itemStruct:{id,privateItem:false,createTime:'1728000000',desc:'Coffee fixture',author:{id:'22000',uniqueId:'incrementbuild',privateAccount:false,signature:'Coffee creator'},authorStats:{followerCount:1500},stats:{playCount:120}}}}}})+'</script>',{headers:{'content-type':'text/html'}});
  };
  const {default:worker}=await import(new URL('../dist/server/index.js',import.meta.url));
  for(const [round,dated] of [[0,6],[1,8]]){
   queries=0;const response=await worker.fetch(new Request('https://increment-build.example/api/videos/discover',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'Find coffee creators'})}),{DB:binding,OPENREEL_POST_METADATA:'true'});
   assert.equal(response.status,200);const body=await response.json();assert.equal(body.records.length,1);assert.equal(body.observedRecords,undefined);assert.equal(body.indexing.additionalInspected,5);assert.ok(queries<=50);assert.equal(body.postMetadata.selectedUndated,round?2:6);
   assert.equal(db.prepare("SELECT count(*) AS n FROM corpus_videos WHERE json_extract(record_json,'$.postedAt')<>''").get().n,dated);
  }
  assert.deepEqual(checked.slice(6,8),['22002','22001']);assert.equal(checked.length,12);
 }finally{globalThis.fetch=original;db.close();}
});
