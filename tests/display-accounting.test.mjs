import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {comparisonHTML} from '../dist/seat-comparison.js';import {portraitStatus} from '../dist/profile-evidence.js';import {profileHTML} from '../dist/profile-cards.js';
import {senateFixture} from './fixtures/senate.mjs';
const read=n=>JSON.parse(readFileSync(new URL('../dist/data/'+n+'.json',import.meta.url))),roster=read('seats'),evidence=read('evidence'),power=read('powers').powers.find(p=>p.id==='ordinary_passage'),esc=x=>String(x??'');
test('Senate visible legend accounts for all ten segments, including narrow segments',()=>{
 for(const [expanded,expected,R,T] of [[false,[32,2,8,2,2,8,3,1,11,31],46,8],[true,[32,2,8,3,1,10,1,1,11,31],44,10]]){
  const fixture=senateFixture(expanded),html=comparisonHTML(fixture.roster,fixture.evidence,'senate',power,esc);
  const cards=[...html.matchAll(/<article class="comparison-card">([\s\S]*?)<\/article>/g)],outlook=cards[1][1];
  const counts=[...outlook.matchAll(/<li>[\s\S]*?<b>(\d+)<\/b><\/li>/g)].map(m=>Number(m[1]));
  assert.deepEqual(counts,expected);assert.equal(counts.reduce((a,b)=>a+b),100);
  assert.match(outlook,/D 46/);assert.ok(outlook.includes('R '+R));assert.ok(outlook.includes(`竞争 ${T} · 未知 0 · 合计 100`));
  assert.doesNotMatch(outlook,/表决门槛|所需赞成票|class="(?:procedure-reference|vote-ruler|vote-frame)"/);
  assert.match(html,/<h4>表决门槛 <strong>51<\/strong> 票/);assert.ok(!html.includes('51 / 100'));
 }
});
test('House legend retains unknown 348 and totals 435; threshold is separate',()=>{
 const html=comparisonHTML(roster,evidence,'house',power,esc),outlook=[...html.matchAll(/<article class="comparison-card">([\s\S]*?)<\/article>/g)][1][1],counts=[...outlook.matchAll(/<li>[\s\S]*?<b>(\d+)<\/b><\/li>/g)].map(m=>Number(m[1]));
 assert.equal(counts.reduce((a,b)=>a+b),435);assert.match(outlook,/未知 348 · 合计 435/);
 // A CSS percentage (or a legitimate future seat total) may contain 218.
 // The procedure label and ruler must be outside both comparison cards.
 assert.doesNotMatch(outlook,/表决门槛|所需赞成票|class="(?:procedure-reference|vote-ruler|vote-frame)"/);
 const reference=html.match(/<div class="procedure-reference">([\s\S]*?)<details class="power-rule">/);
 assert.ok(reference);assert.ok(reference.index>html.lastIndexOf('</article>'));
 assert.match(reference[1],/<h4>表决门槛 <strong>218<\/strong> 票<\/h4>/);
 assert.match(reference[1],/class="vote-ruler"/);
 assert.equal((html.match(/<h4>表决门槛 /g)||[]).length,1);
});
test('Photo status distinguishes not researched, identity, rights, load check and a failed source',()=>{assert.equal(portraitStatus({}),'照片尚未收录');const photo={url:'https://example.org/a.jpg'};assert.equal(portraitStatus({photo}),'图片身份待核验');Object.assign(photo,{verified:true,visualIdentityVerified:true});assert.equal(portraitStatus({photo}),'图片使用依据待核验');Object.assign(photo,{usageAllowed:true,rightsSource:'https://example.org/rights'});assert.equal(portraitStatus({photo}),'图片加载待检查');photo.loadStatus='failed';assert.equal(portraitStatus({photo}),'源图加载失败');});
test('Attribution remains available in collapsed source details, not a repeated inline warning',()=>{const html=profileHTML(roster.seats[0],{incumbent:{name:'Test',policyPositions:[{text:'Policy text',attribution:'Office statement',source:'https://example.org/record'}]}},esc,s=>s.seatId);assert.match(html,/<li>Policy text <a/);assert.match(html,/<details class="source-details"><summary>来源与归因<\/summary><ul><li>Office statement/);assert.ok(!html.includes('身份或图片使用依据待核验。'));});

test('all 100 official portraits match content hashes and exact incumbent identities; only 22 candidates reuse',()=>{const manifest=JSON.parse(readFileSync(new URL('../dist/portraits/senate/manifest.json',import.meta.url))),profiles=read('senate_profiles').profiles;assert.equal(manifest.portraits.length,100);assert.equal(new Set(manifest.portraits.map(p=>p.bioguideId)).size,100);let reused=0;for(const p of manifest.portraits){const profile=profiles.find(x=>x.seatId===p.seatId);assert.equal(profile.incumbent.name,p.incumbentName);assert.equal(profile.incumbent.portrait.url,p.portrait.url);assert.equal(p.portrait.visualIdentityVerified,true);assert.equal(createHash('sha256').update(readFileSync(new URL('../dist'+p.portrait.url,import.meta.url))).digest('hex'),p.portrait.assetSha256);for(const name of p.candidateReuse){const c=profile.candidates.find(x=>x.name===name);assert.equal(c.portrait.url,p.portrait.url);reused++;}}assert.equal(reused,22);const ak=profiles.find(p=>p.seatId==='S-AK-2');assert.ok(!ak.candidates.find(c=>c.name==='Daniel J. Sullivan Jr.').portrait?.assetReady);const murphy=manifest.portraits.find(p=>p.bioguideId==='M001169');assert.match(murphy.portrait.source,/112_murphy_ct05/);});
import {createHash} from 'node:crypto';
