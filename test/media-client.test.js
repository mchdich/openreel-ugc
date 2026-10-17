import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleTimes} from '../public/media.js';
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
