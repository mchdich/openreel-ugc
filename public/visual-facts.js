/** Composable, explicit visual predicates. Descriptions retain their upstream provenance. */
export const visualFeatures=[
 {id:'split-screen',label:'Split-screen layout',clause:'a split-screen video layout',rules:[/\bsplit[- ]screen\s+(?:format|layout|duet|presentation)\b/i,/\b(?:video|visuals?|footage|clip)\b.{0,70}\bsplit[- ]screen\b/i]},
 {id:'date-overlay',label:'On-screen date labels',clause:'visible date text',text:true,rules:[/\b(?:on[- ]screen\s+date|date\s+(?:sticker|label|caption))\b/i,/\b(?:text(?:\s+sticker)?|caption|labeled)\b.{0,100}\b(?:on this day|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}|\d{1,2}\/\d{1,2}\/\d{2,4})\b/i]},
 {id:'mirror',label:'Mirror framing',clause:'mirror-based framing',rules:[/\b(?:in front of|facing)\s+(?:a|the)\s+mirror\b/i,/\bmirror\s+(?:selfies?|pictures?|images?)\b/i]},
 {id:'held-phone',label:'Phone held on screen',clause:'a phone explicitly held in the described scene',rules:[/\b(?:holding|holds?|held|grips?)\s+(?:(?:a|the|their|his|her|black|white|mobile)\s+){0,4}(?:smartphone|phone)\b/i]},
 {id:'angles',label:'Multiple viewing angles',clause:'different viewing angles',rules:[/\b(?:different|multiple|various|several)\s+(?:camera|viewing)\s+angles\b/i,/\b(?:captures?|capturing|shows?|showcasing|displays?|displaying|presents?|presenting)\b.{0,50}\b(?:different|multiple|various|several)\s+angles\b/i]},
 {id:'overhead',label:'Overhead camera view',clause:'an overhead camera view',rules:[/\b(?:overhead|top[- ]down)\s+(?:camera|shot|view|angle|perspective|footage)\b/i,/\bcamera\b.{0,35}\b(?:straight down|from above)\b/i]},
 {id:'close-up',label:'Close-up framing',clause:'close-up views',rules:[/\bclose[- ]ups?\s+(?:shots?|views?|looks?|footage|images?|framing|of)\b/i,/\b(?:shows?|features?|includes?|provides?)\b.{0,40}\bclose[- ]up\b/i]},
 {id:'hands',label:'Visible hands',clause:'hands explicitly described in the scene',rules:[/\bhands?\s+(?:are\s+)?(?:visible|seen|shown|arrange|arranging|open|opening|hold|holding|manipulate|manipulating|place|placing|move|moving)\b/i,/\b(?:shows?|features?)\b.{0,60}\bhands?\b/i]},
 {id:'two-phones',label:'Two-phone arrangement',clause:'two phones shown together',rules:[/\b(?:two|2|pair of)\s+(?:smartphones?|phones?)\b.{0,45}\b(?:side by side|next to each other|together|beside each other)\b/i]},
 {id:'candle',label:'Lit candle',clause:'a candle explicitly lit or glowing',rules:[/\b(?:lit|glowing|burning)\s+(?:[a-z]+\s+){0,2}candles?\b(?![-\s]*(?:shaped|like)\b)/i,/\bcandles?\s+(?:glows?|glowing|burns?|burning)\b/i]},
 {id:'dark-surface',label:'Dark surface',clause:'a dark table or surface',rules:[/\b(?:dark|black)\s+(?:table|desk|surface|counter(?:top)?)\b/i]},
 {id:'tabletop',label:'Tabletop setting',clause:'a table or counter setting',rules:[/\b(?:on|across|onto)\s+(?:a|the)\s+(?:(?:marble|wooden|white|dark|black)\s+)?(?:table|desk|counter(?:top)?)\b/i]},
 {id:'unboxing',label:'Package opening',clause:'a depicted unboxing or package opening',rules:[/\b(?:is|are|person|individual|creator|man|woman)\s+unboxing\s+(?:a|an|the|their|his|her)\b/i,/\b(?:opens?|opening|unboxes)\s+(?:a|the)\s+(?:box|package)\b/i]},
 {id:'reveal',label:'Visible item reveal',clause:'an item revealed on screen',rules:[/\b(?:reveals?|revealing|unveils?|unveiling)\b.{0,60}\b(?:product|figure|item|toy|bottle|clothing|shirt)\b/i]},
 {id:'try-on',label:'Outfit try-on',clause:'an outfit try-on',rules:[/\b(?:tries?|trying|try)[- ]on\s+(?:(?:a|an|the|new|his|her|their|different|several|various|black|white|red|blue|pink|green|yellow|silk|cotton|denim)\s+){0,4}(?:outfits?|dresses|dress|clothes|clothing|shirts?|pants|jeans|jackets?|skirts?|shoes|tops?|sweaters?|suits?|shorts)\b/i]},
 {id:'screen-recording',label:'Screen-recorded demonstration',clause:'a screen recording',rules:[/\bscreen[- ]record(?:ing|ed)\b/i]},
 {id:'camera-address',label:'Direct camera address',clause:'a person explicitly addressing the camera',rules:[/\b(?:speaks?|talks?|addresses?|speaking|talking)\s+(?:directly\s+)?(?:to|at)\s+(?:the\s+)?camera\b/i]},
 {id:'camera-facing',label:'Person facing the camera',clause:'a person explicitly facing the camera',rules:[/\b(?:person|man|woman|individual|creator|they|he|she)\s+(?:(?:is|are|stands?|sits?)\s+)?(?:directly\s+)?(?:faces?|facing)\s+(?:(?:at|toward(?:s)?)\s+)?(?:the\s+)?camera\b/i]},
 {id:'two-people',label:'Two-person composition',clause:'two people explicitly shown',rules:[/\b(?:shows?|features?|depicts?|captures?)\s+(?:two|2)\s+(?:people|individuals|persons|participants|creators)\b/i,/\b(?:two|2)\s+(?:people|individuals|persons|participants|creators)\s+(?:are\s+)?(?:visible|shown|seen|standing|sitting)\b/i]}
];
const origins=new Set(['upstream-model','user-supplied','provider-observed']);
// Conservatively discard the whole candidate sentence, including text consumed by
// a rule. Checking only the prefix lets a broader fallback swallow a negation.
const qualified=/\b(?:not|no|never|without|isn['’]t|aren['’]t|doesn['’]t|don['’]t|didn['’]t|wasn['’]t|weren['’]t|rather than|instead of|likely|probably|possibly|perhaps|might|may(?!\s+\d{1,2}\b)|could|would|plans?|planned|upcoming|future|suggests?|recommends?|encourages?|invites?|coming soon|tomorrow|next week|will be)\b/i;
export function visualFeatureEvidence(record,featureId){
 const feature=visualFeatures.find(f=>f.id===featureId);
 if(!feature||!record||record.demo!==false||!origins.has(record.descriptionSource)||typeof record.visualDescription!=='string')return null;
 for(const sentence of record.visualDescription.split(/(?<=[.!?])\s+|[;\n]+/)){
  if(qualified.test(sentence))continue;
  if(feature.id==='split-screen'&&/\b(?:mode|switch|function|capabilit)/i.test(sentence))continue;
  if(feature.id==='two-phones'&&/\b(?:separately|alternating|different scenes?)\b/i.test(sentence))continue;
  for(const rule of feature.rules){
  const match=sentence.match(rule);if(!match)continue;
  const context=sentence.slice(0,match.index+match[0].length);
  if(!feature.text&&/\b(?:caption|text(?: sticker)?|subtitle|voice|audio|song|lyrics|says?|saying|said|mentions?|discuss(?:es|ing)|talks? about|explains? how)\b/i.test(context))continue;
  if(feature.text&&/\b(?:voice|audio|narrator|speaks?|says?|saying|said|discuss(?:es|ing)|talks? about)\b/i.test(context))continue;
  let start=Math.max(0,match.index-80),end=Math.min(sentence.length,match.index+match[0].length+160);
  if(start){const boundary=sentence.indexOf(' ',start);if(boundary>=0&&boundary<match.index)start=boundary+1;}
  if(end<sentence.length){const boundary=sentence.lastIndexOf(' ',end);if(boundary>match.index+match[0].length)end=boundary;}
  const excerpt=sentence.slice(start,end).trim();if(excerpt.length<20||excerpt.length>350)continue;
  return {featureId,label:feature.label,excerpt,field:'visualDescription',descriptionSource:record.descriptionSource};
  }
 }
 return null;
}
export const availableVisualFacts=record=>visualFeatures.map(feature=>visualFeatureEvidence(record,feature.id)).filter(Boolean);
