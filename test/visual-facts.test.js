import test from 'node:test';
import assert from 'node:assert/strict';
const module=await import('../public/visual-facts.js').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const fact=(id,text)=>{assert.equal(typeof module.visualFeatureEvidence,'function');return module.visualFeatureEvidence({demo:false,descriptionSource:'upstream-model',visualDescription:text},id);};
test('observable camera and arrangement predicates retain exact source spans',()=>{
 for(const [id,text] of [['overhead','The camera points straight down onto a marble counter. Two hands arrange jars.'],['split-screen','The video features a split-screen format showing a person and a landscape.'],['date-overlay','The text sticker "On this day Oct 8, 2020" is displayed at the bottom of the screen.'],['mirror','A person poses in front of a mirror while showing an outfit.'],['held-phone','The video shows a person holding a smartphone in one hand.'],['angles','The individual captures different angles of the outfit in a mirror.'],['two-phones','The video shows two phones side by side on a dark table.'],['candle','A warm glowing candle sits behind the phones on the table.']]){
  const evidence=fact(id,text);assert.ok(evidence,id);assert.ok(text.includes(evidence.excerpt),id);assert.ok(evidence.excerpt.length>=20&&evidence.excerpt.length<=350,id);
 }
});
test('mirror selfies, overhead exercise and screen software do not imply other concrete facts',()=>{
 assert.equal(fact('held-phone','The video shows a person taking mirror selfies in a pink outfit.'),null);
 assert.equal(fact('overhead','The creator demonstrates an overhead press using a Smith machine.'),null);
 assert.equal(fact('split-screen','The creator explains how to switch the car display between full screen and split screen modes.'),null);
});
test('negation, plans, spoken words, invitations and uncertain claims do not become depicted facts',()=>{
 for(const text of ['The person is not holding a smartphone in this clip.','The person plans to hold a smartphone tomorrow.','The text sticker says "holding a smartphone" but the shot shows a wall.','A voice says the person is holding a smartphone.','The creator suggests holding a smartphone for the next clip.','The individual is likely holding a smartphone outside the frame.','The person holding a smartphone is not shown.'])assert.equal(fact('held-phone',text),null,text);
 assert.equal(fact('date-overlay','The narrator discusses the date October 8, 2020 without showing it.'),null);
});

test('qualifiers inside a matched span cannot bypass the clause guard or a fallback rule',()=>{
 for(const [id,text] of [
  ['split-screen','The video does not use a split-screen layout.'],
  ['split-screen','The video might include a split-screen layout in a future version.'],
  ['split-screen','The video discusses a split-screen video format without showing the layout on screen.'],
  ['hands','The video shows no hands.'],
  ['date-overlay','The caption does not include a date.'],
  ['date-overlay','The on-screen date label is not visible in this version.'],
  ['overhead','The camera is never pointed straight down in this clip.'],
  ['close-up','The video includes a planned close-up shot for the next version.'],
  ['held-phone','The video shows a caption saying a person is holding a smartphone.']
 ])assert.equal(fact(id,text),null,text);
});

test('predicates require the relationships and objects stated by their rendered clauses',()=>{
 for(const [id,text] of [
  ['two-phones','The video shows two phones separately, each appearing alone in a different scene.'],
  ['two-phones','The video compares two phones using different clips.'],
  ['camera-facing','The person looks at the camera over their shoulder, with their back facing the lens.'],
  ['candle','An unlit candle appears beside a burning candle-shaped lamp.'],
  ['candle','A glowing candle like lamp sits on the table.'],
  ['date-overlay','The caption says "date night" above the couple.']
 ])assert.equal(fact(id,text),null,text);
 for(const [id,text] of [
  ['two-phones','Two smartphones are placed together on the dark surface.'],
  ['two-phones','The video shows a pair of phones next to each other on the table.'],
  ['camera-facing','The person is facing the camera while standing by a wall.'],
  ['candle','A lit candle burns on the wooden counter beside the phones.'],
  ['date-overlay','The caption "Oct 8, 2020" appears above the two scenes.'],
  ['date-overlay','The caption "May 8, 2020" appears above the two scenes.']
 ])assert.ok(fact(id,text),text);
});

test('topic nouns and non-clothing try-ons cannot become depicted actions or people',()=>{
 for(const [id,text] of [
  ['try-on','The person tries on a series of virtual face filters while wearing the same shirt throughout.'],
  ['unboxing','The video shows an unboxing knife lying untouched on a wooden table.'],
  ['two-people','The video has one creator describing the friendship of two people named in a book.']
 ])assert.equal(fact(id,text),null,text);
 for(const [id,text] of [
  ['try-on','The person tries on a pink dress in front of a mirror.'],
  ['unboxing','The individual is unboxing a new toy on the kitchen counter.'],
  ['unboxing','The person opens a package on the wooden table.'],
  ['two-people','The video shows two people standing in front of the camera.'],
  ['two-people','Two individuals are visible in a split-screen layout.']
 ])assert.ok(fact(id,text),text);
});
