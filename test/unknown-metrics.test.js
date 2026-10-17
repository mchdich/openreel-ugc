import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRecords,searchRecords,getTrends,research} from '../public/engine.js';
test('metadata-only metrics stay unavailable and cannot satisfy follower constraints',()=>{
  const records=normalizeRecords([{handle:'metadata',caption:'A public video',sourceType:'tiktok-oembed',followers:0,unavailableMetrics:['followers','views','likes','comments','shares'],bio:'Public profile bio',authorUrl:'https://www.tiktok.com/@metadata',fetchedAt:'2026-10-17T12:00:00Z'}]);
  assert.deepEqual(records[0].unavailableMetrics,['followers','views','likes','comments','shares']);
  assert.equal(records[0].sourceType,'tiktok-oembed');assert.equal(records[0].bio,'Public profile bio');
  assert.deepEqual(searchRecords(records,'Find creators under 1000 followers'),[]);
  assert.match(research(records,'public').sections[0].text,/unavailable/i);
  assert.equal(research(records,'public').stats.totalViews,null);
  assert.equal(research(records,'public').stats.avgEngagementRate,null);
});
test('unknown metrics are excluded from trend averages instead of counted as zero',()=>{
  const records=normalizeRecords([{handle:'known',format:'Shared',views:1000,likes:100},{handle:'unknown',format:'Shared',unavailableMetrics:['followers','views','likes','comments','shares']}]);
  const t=getTrends(records)[0];assert.equal(t.avgViews,1000);assert.equal(t.measuredVideos,1);
  const allUnknown=getTrends(normalizeRecords([{handle:'one',format:'Shared',unavailableMetrics:['views']},{handle:'two',format:'Shared',unavailableMetrics:['views']}]))[0];assert.equal(allUnknown.avgViews,null);
});
