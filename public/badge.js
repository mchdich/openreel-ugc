import {creatorKey} from './engine.js';

const coverUrl=value=>{try{const parsed=new URL(value);return ['https:','http:'].includes(parsed.protocol)?parsed.href:'';}catch{return '';}};

/** Use evidence already available for this source, never another chat or dataset. */
export function badgeRecords({source,library=[],chat,progress,video}={}){
  if(source==='video'){
    const frame=video?.attachment?.frames?.find(frame=>typeof frame?.dataUrl==='string'&&frame.dataUrl.length<=220000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(frame.dataUrl));
    return frame?[{id:'attached-frame',thumbnail:frame.dataUrl}]:[];
  }
  let records=[];
  if(source==='library')records=library;
  else if(source==='corpus'||source==='live'){
    if(progress){if(progress.source!==source)return [];records=progress.records||[];}
    else{
      const last=chat?.messages?.at(-1),result=last?.result;
      const origin=last?.researchSource||(Number.isSafeInteger(result?.corpus?.byKind?.real)&&result.corpus.byKind.real>=0?'corpus':result?.videoAnalysis?'video':null);
      if(last?.role!=='assistant'||last.error||origin!==source)return [];
      records=[...(result?.sources||[]),...(result?.creators||[])];
    }
  }
  const candidates=[],urls=new Set();
  for(const record of records){
    const thumbnail=coverUrl(record?.thumbnail);
    if(!record||record.demo!==false||!thumbnail||urls.has(thumbnail))continue;
    urls.add(thumbnail);candidates.push({...record,thumbnail});
  }
  const chosen=[],creators=new Set();
  for(const record of candidates){const key=creatorKey(record)||record.id;if(creators.has(key))continue;creators.add(key);chosen.push(record);if(chosen.length===3)return chosen;}
  for(const record of candidates){if(!chosen.includes(record))chosen.push(record);if(chosen.length===3)break;}
  return chosen;
}
