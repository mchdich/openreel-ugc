import {creatorKey,summarizePatternGroup} from './engine.js';
import {visualFeatures,visualFeatureEvidence} from './visual-facts.js';
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const shape=(value,keys)=>object(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const origins=new Set(['upstream-model','user-supplied','provider-observed']);
const unsupported=/https?:\/\/|\b[^\s@]+@[^\s@]+\.[a-z]+|@[a-z0-9_]|\b(?:viral|trending|emerging|retention|engagement|this week|today|right now|fast[- ]growing|high[- ]performing)\b|\b\d[\d,.]*\s*(?:views|followers|likes|shares)\b/i;
const plain=(value,min,max)=>typeof value==='string'&&value.trim().length>=min&&value.length<=max&&!unsupported.test(value);

/** Exact quotes establish source binding; pattern semantics remain AI proposals. */
export function groundVisualPatterns(records,proposals){
 if(!Array.isArray(records)||records.length>100||!Array.isArray(proposals)||proposals.length>3)throw new Error('Invalid visual-pattern proposals.');
 const sources=new Map(records.filter(r=>r&&typeof r.id==='string'&&r.demo===false&&!r.synthetic&&origins.has(r.descriptionSource)&&typeof r.visualDescription==='string'&&creatorKey(r)).map(r=>[r.id,r]));
 const patterns=[],accepted=[],seen=new Set();let rejected=0;
 for(const proposal of proposals){
  try{
   if(!shape(proposal,['title','description','components'])||!plain(proposal.title,8,120)||!plain(proposal.description,20,600)||!Array.isArray(proposal.components)||proposal.components.length<2||proposal.components.length>3)throw new Error();
   const labels=new Set(),components=[];
   for(const component of proposal.components){
    if(!shape(component,['featureId','label','evidence'])||!visualFeatures.some(f=>f.id===component.featureId)||!plain(component.label,3,100)||!Array.isArray(component.evidence)||component.evidence.length<2||component.evidence.length>4||labels.has(component.featureId))throw new Error();
    labels.add(component.featureId);const ids=new Set(),evidence=[];
    for(const item of component.evidence){
     if(!shape(item,['recordId','quote'])||typeof item.recordId!=='string'||typeof item.quote!=='string'||item.quote.trim().length<20||item.quote.length>350||ids.has(item.recordId))throw new Error();
     const record=sources.get(item.recordId);if(!record||!record.visualDescription.includes(item.quote))throw new Error();
     ids.add(item.recordId);const fact=visualFeatureEvidence(record,component.featureId);if(fact)evidence.push({recordId:item.recordId,quote:fact.excerpt});
    }
    components.push({featureId:component.featureId,label:visualFeatures.find(f=>f.id===component.featureId).label,evidence});
   }
   const ids=components[0].evidence.map(e=>e.recordId).filter(id=>components.every(c=>c.evidence.some(e=>e.recordId===id)));
   const rows=ids.map(id=>sources.get(id));if(new Set(rows.map(creatorKey)).size<2)throw new Error();
   const key=[...ids].sort().join('\n');if(seen.has(key))throw new Error();seen.add(key);
   const retained=components.map(c=>({...c,evidence:c.evidence.filter(e=>ids.includes(e.recordId))}));
   const evidence=retained.flatMap(c=>c.evidence.map(e=>({recordId:e.recordId,creatorKey:creatorKey(sources.get(e.recordId)),field:'visualDescription',descriptionSource:sources.get(e.recordId).descriptionSource,component:c.label,excerpt:e.quote})));
   const features=retained.map(c=>visualFeatures.find(f=>f.id===c.featureId));
   const title=features.length===2&&labels.has('split-screen')&&labels.has('date-overlay')?'Split-screen clips with on-screen date labels':features.map(f=>f.label).join(' · ');
   const description='The source descriptions explicitly share '+features.map(f=>f.clause).join('; ')+'.';
   patterns.push({...summarizePatternGroup({format:title,records:rows,evidence}),description,components:retained,proposed:true});
   accepted.push({title,description,components:retained});
  }catch{rejected++;}
 }
 return {patterns,proposals:accepted,rejected};
}
