import test from 'node:test';
import assert from 'node:assert/strict';
import {ingestTikTok} from '../lib/social.js';
import {handleApi} from '../lib/api.js';
const social=await import('../lib/social.js');
const url='https://www.tiktok.com/@creator/video/7648984799574510861';
const item=()=>({id:'7648984799574510861',desc:'A real caption; mentions UCLA but not an affiliation.',createTime:'1780918110',privateItem:false,secret:false,forFriend:false,isProhibited:false,takeDown:0,author:{id:'7384517653371683871',uniqueId:'creator',privateAccount:false,signature:'NYU | New York City\ncontact@public.example',avatarThumb:'https://cdn.example/avatar.jpg'},authorStats:{followerCount:3858},stats:{playCount:1100000,diggCount:258700,commentCount:149,shareCount:0},video:{cover:'https://cdn.example/cover.jpg',playAddr:'https://cdn.example/private-video.mp4',subtitleInfos:[{Url:'https://cdn.example/subtitles'}]}});
const html=(entry=item(),statusCode=0)=>'<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">'+JSON.stringify({__DEFAULT_SCOPE__:{'webapp.video-detail':{statusCode,itemInfo:{itemStruct:entry}}}})+'</script>';
const parse=(body=html(),source=url)=>{assert.equal(typeof social.parsePublicPostHtml,'function');return social.parsePublicPostHtml(body,source,'2026-10-18T07:00:00.000Z');};
const response=body=>new Response(body,{headers:{'content-type':'text/html'}});
async function withFetch(fn,run){const old=globalThis.fetch;globalThis.fetch=fn;try{return await run();}finally{globalThis.fetch=old;}}

test('public post metadata binds actual ID, UTC timestamp, counts and public profile evidence without media',()=>{
 const r=parse();assert.equal(r.id,'tiktok-7648984799574510861');assert.equal(r.postedAt,'2026-06-08T11:28:30.000Z');assert.equal(r.sourceType,'tiktok-public-post');assert.equal(r.fetchedAt,'2026-10-18T07:00:00.000Z');assert.equal(r.creatorId,'7384517653371683871');assert.equal(r.views,1100000);assert.equal(r.likes,258700);assert.equal(r.shares,0);assert.deepEqual(r.unavailableMetrics,[]);assert.equal(r.email,'contact@public.example');assert.equal(r.school,'New York University');assert.equal(r.location,'New York City');assert.equal(r.profileEvidence.school.source,'public-bio-self-description');assert.equal(r.transcript,'');assert.equal(r.visualDescription||'','');assert.equal(r.demo,false);assert.doesNotMatch(JSON.stringify(r),/private-video|subtitleInfos|playAddr|<script>/);
});
test('shells, errors, wrong IDs and nonpublic visibility never become records',()=>{
 for(const body of ['<h1>Verify to continue</h1>',html(item(),10204),html({...item(),id:'999'}),html({...item(),privateItem:true}),html({...item(),secret:true}),html({...item(),forFriend:true}),html({...item(),isProhibited:true}),html({...item(),takeDown:1}),html({...item(),author:{...item().author,privateAccount:true}}),html({...item(),privateItem:undefined}),html()+html()])assert.throws(()=>parse(body),e=>e.status===502);
});
test('unknown counts and invalid/future dates remain unknown rather than invented from captions or IDs',()=>{
 for(const createTime of [undefined,null,0,-1,'2026-06-08','not a time',1e30,'9999999999']){
  const r=parse(html({...item(),createTime,stats:{playCount:null,diggCount:-1,shareCount:'a lot'},authorStats:{}}));assert.equal(r.postedAt,'');assert.deepEqual(r.unavailableMetrics,['followers','views','likes','comments','shares']);
 }
 const r=parse(html({...item(),video:{cover:'javascript:bad()'},author:{...item().author,avatarThumb:'http://127.0.0.1/a'}}));assert.equal(r.thumbnail,'');assert.equal(r.avatar,'');
});
test('verified returned author corrects stale URL handles but invalid identities reject',()=>{
 const r=parse(html({...item(),author:{...item().author,uniqueId:'renamed_creator'}}));assert.equal(r.url,url.replace('@creator','@renamed_creator'));assert.equal(r.handle,'@renamed_creator');
 for(const author of [{...item().author,uniqueId:'bad/handle'},{...item().author,id:'not-an-id'},{}])assert.throws(()=>parse(html({...item(),author})));
});
test('opted-in direct import makes exactly one canonical bounded HTML GET with no media, retry or fallback',async()=>{
 let calls=0;await withFetch(async(target,init)=>{calls++;assert.equal(target,url);assert.equal(init.redirect,'error');assert.equal(init.method,'GET');assert.equal(init.headers.accept,'text/html');assert.ok(init.signal instanceof AbortSignal);return response(html());},async()=>{const r=await ingestTikTok(url+'?tracking=1',{OPENREEL_POST_METADATA:'true'});assert.equal(r.sourceType,'tiktok-public-post');assert.ok(r.postedAt);assert.equal(calls,1);});
});
test('invalid URLs, oversized/invalid HTML, access errors and deadlines fail without leaking upstream text',async()=>{
 let calls=0;await withFetch(async()=>{calls++;return response(html());},async()=>{await assert.rejects(ingestTikTok('https://evil.example/post',{OPENREEL_POST_METADATA:'true'}));assert.equal(calls,0);});
 for(const make of [()=>new Response('upstream-secret',{status:403}),()=>new Response('{}',{headers:{'content-type':'application/json'}}),()=>new Response('',{headers:{'content-type':'text/html','content-length':'1048577'}}),()=>response('x'.repeat(1048577)),()=>response('Verify to continue'),()=>{throw new DOMException('upstream-secret','TimeoutError');}]){calls=0;await withFetch(async()=>{calls++;return make();},async()=>{await assert.rejects(ingestTikTok(url,{OPENREEL_POST_METADATA:'true'}),e=>e.status>=500&&!e.message.includes('upstream-secret'));assert.equal(calls,1);});}
});
test('normal app import persists actual post provenance and known dates rather than labeling it oEmbed',async()=>{
 let saved;await withFetch(async()=>response(html()),async()=>{const r=await handleApi(new Request('http://localhost/api/videos/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url})}),{OPENREEL_POST_METADATA:'true',OPENREEL_CORPUS:{upsert:async(records,meta)=>{saved={records,meta};}}});assert.equal(r.status,200);const body=await r.json();assert.equal(body.record.sourceType,'tiktok-public-post');assert.equal(saved.meta.source,'tiktok-public-post');assert.equal(saved.meta.verification,'provider-observed');assert.equal(saved.records[0].postedAt,body.record.postedAt);});
});
