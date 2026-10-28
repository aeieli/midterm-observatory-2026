import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildSeatComparison,ratingForSeat,meaningfulPowers,thresholdReference} from '../dist/seat-outlook.js';
import {languagePreference} from '../dist/language-preference.js';
import {senateFixture} from './fixtures/senate.mjs';
const read=name=>JSON.parse(fs.readFileSync(new URL('../dist/data/'+name+'.json',import.meta.url)));
const roster=read('seats'),evidence=read('evidence'),powers=read('powers');
test('Senate comparison preserves independent identities without double-counting the caucus',()=>{
 for(const [expanded,R,T,steps] of [[false,46,8,[42,44,46]],[true,44,10,[42,45,46]]]){
  const fixture=senateFixture(expanded),m=buildSeatComparison(fixture.roster,fixture.evidence,'senate');
  assert.deepEqual(m.current.aligned,{D:47,R:53,I:0,T:0,U:0});
  assert.equal(m.current.independent.D,2);assert.equal(m.outlook.independent.D,2);assert.equal(m.retained,65);
  assert.deepEqual(m.outlook.aligned,{D:46,R,I:0,T,U:0});assert.deepEqual(m.steps.D,steps);
  for(const group of [m.current,m.outlook])assert.equal(group.segments.reduce((n,s)=>n+s.count,0),100);
 }
});
test('House unknown ratings are neither tossups nor incumbent-party predictions',()=>{
 const seats=roster.seats.filter(s=>s.chamber==='house');
 const ratings=['solid-D','likely-D','lean-D','tossup','lean-R','likely-R','solid-R'].map((rating,i)=>({seatId:seats[i].seatId,rating}));
 const m=buildSeatComparison(roster,{ratings},'house');
 assert.equal(m.current.aligned.R,219);assert.equal(m.party.R,218);assert.equal(m.current.independent.R,1);assert.equal(m.occupied,433);
 assert.deepEqual(m.outlook.aligned,{D:3,R:3,I:0,T:1,U:428});assert.equal(m.mapped,7);assert.equal(m.retained,0);
 assert.equal(m.outlook.segments.reduce((n,s)=>n+s.count,0),435);
 const unmapped=buildSeatComparison(roster,{ratings:[]},'house');
 assert.deepEqual(unmapped.outlook.aligned,{D:0,R:0,I:0,T:0,U:435});assert.equal(unmapped.mapped,0);
});
test('ambiguous and unsupported ratings stay unknown',()=>{const s=roster.seats.find(x=>x.chamber==='house');const r={seatId:s.seatId,rating:'solid-D'};assert.equal(ratingForSeat(s,{ratings:[r,r]}),null);assert.equal(ratingForSeat(s,{ratings:[{...r,rating:'90-percent-D'}]}),null);});
test('all meaningful procedures calculate the correct denominator; trivial rules stay out of tabs',()=>{for(const ch of ['house','senate'])for(const p of meaningfulPowers(powers,ch)){assert.equal(thresholdReference(p,ch,ch==='house'?435:100).votes,p.nominalFullChamberValue[ch]);assert.ok(!['quorum','bill_introduction'].includes(p.id));}const p=id=>powers.powers.find(x=>x.id===id);assert.equal(thresholdReference(p('ordinary_passage'),'house',433).votes,217);assert.equal(thresholdReference(p('veto_override'),'house',433).votes,289);assert.equal(thresholdReference(p('legislative_cloture'),'senate',99).votes,60);assert.equal(thresholdReference(p('impeachment_conviction'),'senate',98).votes,66);assert.throws(()=>thresholdReference(p('ordinary_passage'),'house',0));});
test('first visit is English and offers the first supported browser preference',()=>{assert.deepEqual(languagePreference({languages:['de','fr-CA']}),{language:'en',suggestion:'fr',legacy:false});assert.equal(languagePreference({languages:['en-US','zh-CN']}).suggestion,'en');assert.equal(languagePreference({languages:['xx']}).language,'en');});
test('legacy automatic Chinese needs a one-time confirmation, not silent adoption',()=>{const p=languagePreference({saved:'zh',languages:['zh-CN']});assert.equal(p.language,'en');assert.equal(p.suggestion,'zh');assert.equal(p.legacy,true);assert.equal(languagePreference({saved:'zh',promptSeen:true,languages:['zh-CN']}).suggestion,null);});
test('explicit language always wins, and invalid saved preferences cannot break startup',()=>{assert.equal(languagePreference({saved:'ja',explicit:true,languages:['fr']}).language,'ja');assert.equal(languagePreference({saved:'bad',explicit:true,languages:['fr']}).language,'en');assert.equal(languagePreference({saved:'en',explicit:true,languages:['fr']}).suggestion,null);});
