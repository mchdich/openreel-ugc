import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleTimes,selectFrameTimes} from '../public/media.js';
test('video samples cover the hook and later footage without exceeding duration',()=>{
  const times=sampleTimes(30);
  assert.equal(times.length,8);assert.ok(times[0]<.2);assert.ok(times.filter(t=>t<=3).length>=4);
  assert.ok(times.some(t=>t>=20));assert.ok(times.every(t=>t>=0&&t<30));
  assert.deepEqual([...new Set(times)],times);assert.deepEqual([...times].sort((a,b)=>a-b),times);
});
test('short clips have bounded unique valid frame times',()=>{
  for(const d of [.03,.5,1,2]){const t=sampleTimes(d);assert.ok(t.length>=1&&t.length<=8);assert.ok(t.every(x=>x>=0&&x<d));assert.equal(new Set(t).size,t.length);}
});
test('invalid or overlong media is rejected before decoding',()=>{
  for(const d of [0,-1,NaN,Infinity,601])assert.throws(()=>sampleTimes(d));
});

test('a brief distinct reveal is added alongside the eight baseline frames',()=>{
 const samples=Array.from({length:25},(_,i)=>({timestamp:i*.5,descriptor:i===8||i===9?[0,1,0]:[0,0,1]}));
 const selected=selectFrameTimes(12.1,samples);
 assert.ok(selected.some(t=>t>=4&&t<5));
 assert.equal(selected.length,9);assert.equal(new Set(selected).size,9);
 assert.ok(selected.filter(t=>t<=3).length>=4);assert.ok(selected.at(-1)>12);
 assert.deepEqual(selected,[...selected].sort((a,b)=>a-b));
});
test('repeated visual states do not consume every later sample slot',()=>{
 const samples=Array.from({length:61},(_,i)=>({timestamp:i*.5,descriptor:i>=8&&i<=12?[1,0,0]:[0,0,1]}));
 const selected=selectFrameTimes(30.1,samples);
 assert.equal(selected.filter(t=>t>=4&&t<=6).length,1);
 assert.ok(selected.some(t=>t>=20));assert.ok(selected.some(t=>t>=10&&t<=20));
});
test('static and tiny clips retain valid bounded opening and closing coverage',()=>{
 for(const duration of [.03,.5,2,30,600]){
  const end=Math.max(0,duration-.04);
  const samples=Array.from({length:end?10:1},(_,i)=>({timestamp:end?end*i/9:0,descriptor:[.2,.2,.2]}));
  const selected=selectFrameTimes(duration,samples);
  assert.ok(selected.length>=1&&selected.length<=8);assert.ok(selected.every(t=>t>=0&&t<duration));
  assert.equal(selected[0],sampleTimes(duration)[0]);assert.equal(selected.at(-1),sampleTimes(duration).at(-1));
 }
});
test('invalid visual descriptors and unbounded analysis inputs fail before selection',()=>{
 for(const samples of [null,{},Array.from({length:129},(_,timestamp)=>({timestamp,descriptor:[0,0,0]})),[{timestamp:-1,descriptor:[0,0,0]}],[{timestamp:0,descriptor:[NaN,0,0]}],[{timestamp:0,descriptor:[2,0,0]}],[{timestamp:0,descriptor:[0,0,0]},{timestamp:0,descriptor:[1,1,1]}],[{timestamp:0,descriptor:[0,0,0]},{timestamp:1,descriptor:[1,1,1,1]}]])assert.throws(()=>selectFrameTimes(30,samples));
});


test('novel-state selection preserves every baseline frame and adds a separated intermediate reveal',()=>{
 const samples=Array.from({length:25},(_,i)=>({timestamp:i*.5,descriptor:i===8||i===9?[0,1,0]:[0,0,1]}));
 const selected=selectFrameTimes(12.1,samples);
 for(const t of sampleTimes(12.1))assert.ok(selected.includes(t),'Lost baseline '+t);
 assert.ok(selected.some(t=>t>=4&&t<5));assert.equal(selected.length,9);
 const many=Array.from({length:121},(_,i)=>({timestamp:i*.25,descriptor:[i%5/4,i%7/6,i%9/8]})),more=selectFrameTimes(30.1,many);
 assert.ok(more.length<=12);for(const t of sampleTimes(30.1))assert.ok(more.includes(t));
 const extras=more.filter(t=>!sampleTimes(30.1).includes(t));
 for(const t of extras)assert.ok(more.filter(other=>other!==t).every(other=>Math.abs(other-t)>=.7525));
});

test('deduplicated baseline times still add at most four measured states',()=>{
 const samples=Array.from({length:25},(_,i)=>({timestamp:11.96*i/24,descriptor:[i%5/4,i%7/6,i%9/8]}));
 const baseline=sampleTimes(12),selected=selectFrameTimes(12,samples);assert.equal(baseline.length,7);assert.ok(selected.filter(t=>!baseline.includes(t)).length<=4);for(const t of baseline)assert.ok(selected.includes(t));
});
