import {normalizeRecords,creatorKey} from './engine.js';

/** Prefer supplied HTTPS covers, keeping one original record per preview creator. */
export function patternPreviewRecords(records){
  const pictured=[],remaining=[],seen=new Set();
  for(const record of records){
    let hasCover=false;
    try{const cover=new URL(record.thumbnail);hasCover=cover.protocol==='https:'&&!cover.username&&!cover.password;}catch{}
    (hasCover?pictured:remaining).push(record);
  }
  return [...pictured,...remaining].filter(record=>{const key=creatorKey(record)||record.id;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,3);
}

/** A retrieved sample is separate from the browser library and global corpus totals. */
export async function fetchPatternSample(request,query='',signal){
  if(typeof query!=='string'||query.length>1000)throw new Error('Corpus search supports up to 1,000 characters.');
  const value=await request('/api/corpus/patterns',{query:query.trim()},signal);
  const records=value?.records,corpus=value?.corpus,real=corpus?.byKind?.real;
  if(!corpus||!Number.isSafeInteger(corpus.total)||corpus.total<0||!Number.isSafeInteger(real)||real<0||real>corpus.total)throw new Error('The corpus returned invalid record counts.');
  for(const count of Object.values(corpus.byKind))if(!Number.isSafeInteger(count)||count<0||count>corpus.total)throw new Error('The corpus returned invalid record counts.');
  if(Object.values(corpus.byKind).reduce((sum,count)=>sum+count,0)!==corpus.total)throw new Error('The corpus returned inconsistent record counts.');
  if(!Array.isArray(records)||records.length>100||records.length>real)throw new Error('The corpus returned an invalid pattern sample.');
  if(records.some(r=>!r||typeof r.id!=='string'||!r.id.trim()||r.demo!==false||r.synthetic===true||(r.corpusKind!==undefined&&r.corpusKind!=='real')))throw new Error('The corpus pattern sample must contain only real video records.');
  let selection=null;
  if(value.selection!==undefined){
    const item=value.selection;
    if(!item||!['query','format-stratified'].includes(item.method)||!Number.isSafeInteger(item.queryCount)||item.queryCount<1||item.queryCount>8||!Number.isSafeInteger(item.candidateRecords)||item.candidateRecords<records.length||item.candidateRecords>310)throw new Error('The corpus returned invalid sample selection details.');
    selection={method:item.method,queryCount:item.queryCount,candidateRecords:item.candidateRecords};
  }
  return {records:records.length?normalizeRecords(records):[],corpus:{...corpus,byKind:{...corpus.byKind}},selection};
}

/** Own request lifetimes so a delayed result can never replace a newer query/source. */
export function createPatternController({request,onChange=()=>{},debounceMs=300,requestTimeoutMs=25000,source}={}){
  let state={source:source==='corpus'?'corpus':'library',explicit:source==='corpus'||source==='library',available:false,query:'',status:'idle',records:[],corpus:null,selection:null,error:''};
  let active=false,timer,requestDeadline,controller,version=0;
  const snapshot=()=>({...state,records:[...state.records]});
  const notify=()=>onChange(snapshot());
  function cancel(){clearTimeout(timer);clearTimeout(requestDeadline);timer=undefined;controller?.abort();controller=undefined;version++;}
  function reset(){state={...state,status:'idle',records:[],corpus:null,selection:null,error:''};}
  function load(delay=0){
    cancel();state={...state,status:'loading',records:[],corpus:null,selection:null,error:''};notify();
    const current=version;
    const start=async()=>{
      timer=undefined;const task=new AbortController();controller=task;
      let deadline;
      try{
        const timeout=new Promise((resolve,reject)=>{deadline=setTimeout(()=>{reject(new Error('Corpus search timed out. Retry the search.'));task.abort();},requestTimeoutMs);requestDeadline=deadline;});
        const sample=await Promise.race([fetchPatternSample(request,state.query,task.signal),timeout]);
        if(current!==version||!active||state.source!=='corpus')return;
        state={...state,...sample,status:'ready',error:''};
      }catch(error){
        if(current!==version||!active||state.source!=='corpus')return;
        state={...state,status:'error',records:[],corpus:null,error:error?.message||'Corpus search failed.'};
      }finally{clearTimeout(deadline);}
      if(current===version){controller=undefined;notify();}
    };
    if(delay)timer=setTimeout(start,delay);else void start();
  }
  function refresh(){if(active&&state.source==='corpus'&&state.available)load();else notify();}
  return {
    snapshot,
    configure(available){
      const wasAvailable=state.available;
      state={...state,available:available===true};
      const next=state.explicit?state.source:state.available?'corpus':'library';
      if(next!==state.source){cancel();reset();state.source=next;refresh();}
      else if(!wasAvailable&&state.available&&state.source==='corpus'&&state.status==='idle')refresh();
      else notify();
    },
    enter(query=''){
      active=true;
      if(query!==state.query){cancel();reset();state.query=query;}
      if(state.source==='corpus'&&state.available&&state.status==='idle')load();else notify();
    },
    leave(){active=false;cancel();if(state.status==='loading')reset();},
    chooseSource(next){
      if(!['corpus','library'].includes(next))return;
      const changed=next!==state.source;state={...state,source:next,explicit:true};
      if(changed){cancel();reset();refresh();}else notify();
    },
    search(query){
      if(query===state.query)return;
      cancel();reset();state.query=query;
      if(active&&state.source==='corpus'&&state.available)load(debounceMs);else notify();
    },
    retry(){if(active&&state.source==='corpus'&&state.available)load();}
  };
}
