#!/usr/bin/env node
/** Optional local browser collector. The application itself has no browser dependency. */
import {readFileSync,writeFileSync,mkdirSync,existsSync,renameSync,statSync} from 'node:fs';
import {resolve,isAbsolute} from 'node:path';
import {parseArgs} from 'node:util';
import {createRequire} from 'node:module';
import {validatePlayerPostIds,detectPlayerBarrier,parsePlayerMetadataSnapshot,collectPlayerMetadataSequential} from '../lib/player-metadata-dom.js';

const usage=`Optional public-player metadata collector (Node 24+)
  node scripts/collect-player-metadata.js --ids post-ids.json --out output-directory
    --playwright-module ABSOLUTE_MODULE_PATH --browser-path ABSOLUTE_BROWSER_PATH
    [--limit 5] [--navigation-timeout-ms 15000] [--settle-timeout-ms 10000]
    [--batch-timeout-ms 120000]

Input is a JSON array of unique known numeric post ID strings, within --limit (1–40).
One ordinary public-player navigation per ID, sequentially, with autoplay=0.
Stops on an access barrier or navigation failure; never retries or requests playback.
Writes observations.json, deltas.json and summary.json. Review deltas before applying.
Playwright/browser installation is optional and manual; this command never installs them.
No database, media files, arbitrary source URLs, or manual private API requests.`;
const number=(value,fallback,label,min,max)=>{
 const parsed=value===undefined?fallback:Number(value);
 if(!Number.isSafeInteger(parsed)||parsed<min||parsed>max)throw new Error(`${label} must be an integer from ${min} to ${max}.`);
 return parsed;
};
function writeJson(path,value){const temporary=path+'.tmp';writeFileSync(temporary,JSON.stringify(value,null,2)+'\n');renameSync(temporary,path);}

async function main(){
 const {values}=parseArgs({options:{ids:{type:'string'},out:{type:'string'},'playwright-module':{type:'string'},'browser-path':{type:'string'},limit:{type:'string'},'navigation-timeout-ms':{type:'string'},'settle-timeout-ms':{type:'string'},'batch-timeout-ms':{type:'string'},help:{type:'boolean',short:'h'}}});
 if(values.help){console.log(usage);return;}
 for(const key of ['ids','out','playwright-module','browser-path'])if(!values[key]?.trim())throw new Error(`Missing --${key}. Use --help for optional collector setup.`);
 const limit=number(values.limit,5,'Collection limit',1,40);
 const navigationTimeout=number(values['navigation-timeout-ms'],15000,'Navigation timeout',1000,30000);
 const settleTimeout=number(values['settle-timeout-ms'],10000,'Metadata wait',0,20000);
 const batchTimeout=number(values['batch-timeout-ms'],120000,'Batch timeout',1000,600000);
 if(!isAbsolute(values['playwright-module'])||!isAbsolute(values['browser-path']))throw new Error('Optional Playwright module and browser paths must be absolute.');
 if(statSync(resolve(values.ids)).size>65536)throw new Error('Post ID input exceeds 64 KiB.');
 const ids=validatePlayerPostIds(JSON.parse(readFileSync(resolve(values.ids),'utf8').replace(/^\uFEFF/,'')),{limit});
 let chromium;
 try{({chromium}=createRequire(import.meta.url)(values['playwright-module']));if(typeof chromium?.launch!=='function')throw new Error();}
 catch{throw new Error('Optional Playwright runtime unavailable. Supply an installed module with --playwright-module; no installation was attempted.');}
 if(!existsSync(values['browser-path']))throw new Error('Optional browser unavailable. Supply an installed executable with --browser-path.');
 const output=resolve(values.out);
 if(['observations.json','deltas.json','summary.json'].some(name=>existsSync(resolve(output,name))))throw new Error('Choose an output directory without an existing collector report.');
 mkdirSync(output,{recursive:true});
 let navigationCount=0,browser,context,activeSnapshot,watchdog;
 let latest={schema:'openreel-public-player-metadata-delta-v1',requested:ids.length,startedAt:new Date().toISOString(),observations:[],deltas:[],stopped:null,notAttempted:[...ids]};
 const save=result=>{
  latest=result;
  writeJson(resolve(output,'observations.json'),{...result,deltas:undefined,navigationCount,noMediaFilesSaved:true,manualApiCalls:0});
  writeJson(resolve(output,'deltas.json'),{schema:result.schema,deltas:result.deltas,stopped:result.stopped,notice:'Field deltas only. Preserve archival fields and license; never import these as whole records.'});
  writeJson(resolve(output,'summary.json'),{requested:ids.length,navigationCount,observations:result.observations.length,resolvedIdentity:result.deltas.length,withCovers:result.deltas.filter(x=>x.patch.thumbnail).length,withVerifiedAvatars:result.deltas.filter(x=>x.patch.avatar).length,stopped:result.stopped,notAttempted:ids.slice(result.observations.length),startedAt:result.startedAt,finishedAt:result.finishedAt,noDatabaseWrites:true,noMediaFilesSaved:true,manualApiCalls:0,networkLimit:'Media resource/URL checks do not establish zero media network bytes.'});
 };
 save(latest);
 // This deadline runs independently of awaited Playwright calls, including launch/newPage/evaluate/close.
 // Persist the in-flight attempt before bounded cleanup, then exit this collector process only.
 watchdog=setTimeout(()=>{
  const pending=activeSnapshot&&!latest.observations.includes(activeSnapshot)?{...activeSnapshot,observedAt:new Date().toISOString(),error:'Batch deadline exceeded.',errorCode:'BATCH_TIMEOUT'}:null;
  const timed={...latest,observations:[...latest.observations,...(pending?[pending]:[])],stopped:{code:'BATCH_TIMEOUT',...(activeSnapshot?{videoId:activeSnapshot.videoId}:{})},finishedAt:new Date().toISOString()};
  try{save(timed);}catch{console.error('Batch deadline exceeded; partial report could not be written.');}
  console.error('Batch deadline exceeded. Collection stopped; review the partial report.');
  const exit=setTimeout(()=>process.exit(2),500);
  Promise.resolve().then(()=>browser?.close()).catch(()=>{}).finally(()=>{clearTimeout(exit);process.exit(2);});
 },batchTimeout);
 try{
  browser=await chromium.launch({executablePath:values['browser-path'],headless:true,timeout:Math.min(navigationTimeout,batchTimeout)});
  context=await browser.newContext({viewport:{width:500,height:850},acceptDownloads:false,serviceWorkers:'block'});
  const result=await collectPlayerMetadataSequential(ids,async(videoId,{remainingMs,signal})=>{
   const deadline=Date.now()+remainingMs;
   const sourceUrl=`https://www.tiktok.com/player/v1/${videoId}?description=1&music_info=1&autoplay=0`;
   const snapshot=activeSnapshot={videoId,sourceUrl,navigationAttempts:0,mediaRequestsBlocked:0,downloadEventsCancelled:0,playRequested:false,phase:'creating-page'};
   const page=await context.newPage();
   signal.addEventListener('abort',()=>{page.close().catch(()=>{});},{once:true});
   page.on('download',download=>{snapshot.downloadEventsCancelled++;download.cancel().catch(()=>{});});
   page.on('response',response=>{if(response.request().resourceType()==='document'&&[401,403,429].includes(response.status()))snapshot.documentBarrierStatus=response.status();});
   await page.route('**/*',route=>{
    const request=route.request(),url=new URL(request.url());
    const media=request.resourceType()==='media'||/\.(?:mp4|mp3|m3u8|m4a|aac|webm)$/i.test(url.pathname)||/\/video\/tos\//i.test(url.pathname)||/^(?:video|audio)/i.test(url.searchParams.get('mime_type')||'');
    return media?(snapshot.mediaRequestsBlocked++,route.abort()):route.continue();
   });
   const read=()=>page.evaluate(()=>{
    const text=(document.body?.innerText||'').slice(0,100000);
    const match=text.match(/captcha|verify (?:that )?you are human|access denied|unusual traffic|security verification|log in to (?:tiktok|continue)|sign in to (?:tiktok|continue)/i);
    const visible=element=>Boolean(element&&element.getBoundingClientRect().width&&element.getBoundingClientRect().height&&getComputedStyle(element).visibility!=='hidden'&&getComputedStyle(element).display!=='none');
    return {barrierText:match?.[0]||'',visibleChallenge:[...document.querySelectorAll('iframe[src*="captcha"],[id*="captcha"],[class*="captcha"]')].some(visible),hasPasswordInput:[...document.querySelectorAll('input[type="password"]')].some(visible),links:[...document.querySelectorAll('a[href]')].filter(el=>el.href.length<=2000).slice(0,200).map(el=>({href:el.href})),images:[...document.querySelectorAll('img')].filter(el=>(/^https:/.test(el.src)||/^https:/.test(el.currentSrc))&&el.src.length<=2000&&el.currentSrc.length<=2000).slice(0,100).map(el=>({alt:el.alt,src:el.src,currentSrc:el.currentSrc,srcset:el.srcset.slice(0,4000),width:el.naturalWidth,height:el.naturalHeight,ancestorHref:el.closest('a[href]')?.href||''})),unavailable:/video currently unavailable|this video is unavailable|couldn't load video/i.test(text)};
   });
   try{
    snapshot.navigationNumber=++navigationCount;snapshot.navigationAttempts=1;snapshot.phase='navigating';
    const response=await page.goto(sourceUrl,{waitUntil:'domcontentloaded',timeout:Math.max(1,Math.min(navigationTimeout,deadline-Date.now()))});
    snapshot.documentStatus=response?.status();snapshot.finalUrl=page.url();snapshot.observedAt=new Date().toISOString();
    if(!detectPlayerBarrier(snapshot)){
     snapshot.phase='reading-metadata';
     const settleDeadline=Math.min(deadline,Date.now()+settleTimeout);
     do{
      snapshot.dom=await read();snapshot.finalUrl=page.url();snapshot.observedAt=new Date().toISOString();
      if(detectPlayerBarrier(snapshot)||parsePlayerMetadataSnapshot(snapshot)?.patch.thumbnail||snapshot.dom.unavailable||Date.now()>=settleDeadline)break;
      await page.waitForTimeout(Math.min(500,Math.max(1,settleDeadline-Date.now())));
     }while(Date.now()<settleDeadline);
    }
   }catch(error){snapshot.error=String(error.message||error).slice(0,500);snapshot.observedAt=new Date().toISOString();}
   finally{snapshot.phase='closing-page';await page.close();}
   snapshot.phase='finished';activeSnapshot=null;
   console.log(JSON.stringify({postId:videoId,status:snapshot.documentStatus,observedAt:snapshot.observedAt,barrier:detectPlayerBarrier(snapshot),failed:Boolean(snapshot.error),verifiedFields:Object.keys(parsePlayerMetadataSnapshot(snapshot)?.patch||{})}));
   return snapshot;
  },{limit,maxElapsedMs:batchTimeout,afterEach:save});
  save(result);if(result.stopped)process.exitCode=2;
 }catch(error){
  latest.stopped={code:browser?'COLLECTION_FAILED':'BROWSER_RUNTIME_FAILED'};latest.finishedAt=new Date().toISOString();save(latest);
  throw new Error(browser?'Collection stopped. Review the partial output report.':'Optional browser could not launch. Review the output report and supplied runtime paths.');
 }finally{try{await context?.close();await browser?.close();}finally{clearTimeout(watchdog);}}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Player metadata collection failed.');process.exitCode=1;});
