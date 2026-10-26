import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {explorerModel,floorSegments,floorLead,projectPoint,projectedPolygons,isKeySeat,historicalComposition} from '../dist/election-explorer.js';
import {geographyAssets} from '../dist/geography-assets.js';
const read=path=>JSON.parse(fs.readFileSync(new URL('../dist/'+path,import.meta.url)));
const roster=read('data/seats.json'),evidence=read('data/evidence.json');
test('key scope is only sourced lean/toss-up seats and never changes whole chamber denominators',()=>{
 for(const [chamber,capacity,majority] of [['senate',100,51],['house',435,218]]){
  const seats=Array.from({length:capacity},(_,i)=>({seatId:`fixture-${chamber}-${i}`,chamber,state:'XX',district:i+1,contested2026:true,currentParty:'R',caucus:'R'}));
  const ratings=['solid-D','likely-D','lean-D','tossup','lean-R','likely-R','solid-R'].map((rating,i)=>({seatId:seats[i].seatId,rating}));
  // An unsupported rating and conflicting records must not become key seats.
  ratings.push({seatId:seats[8].seatId,rating:'90-percent-D'},{seatId:seats[9].seatId,rating:'lean-D'},{seatId:seats[9].seatId,rating:'lean-R'});
  if(chamber==='senate'){seats[7].contested2026=false;ratings.push({seatId:seats[7].seatId,rating:'lean-D'});}
  const m=explorerModel({seats},{ratings},chamber);
  assert.deepEqual(m.keySeats.map(s=>s.seatId),[seats[2].seatId,seats[3].seatId,seats[4].seatId]);
  assert.deepEqual(m.key.outlook.aligned,{D:1,R:1,I:0,T:1,U:0});
  assert.equal(m.key.capacity,3);assert.equal(m.majority,majority);assert.equal(m.capacity,capacity);
  assert.equal(m.outlook.aligned.U,capacity-7-(chamber==='senate'?1:0));
  assert.equal(m.keySeats.filter(s=>!s.contested2026).length,0);
 }
});
test('floor arcs total every full-chamber seat and preserve independents and unknowns',()=>{for(const c of ['senate','house']){const m=explorerModel(roster,evidence,c),arcs=floorSegments(m);assert.equal(arcs[0].start,0);assert.equal(arcs.at(-1).end,1);for(let i=1;i<arcs.length;i++)assert.equal(arcs[i-1].end,arcs[i].start);assert.equal(arcs.reduce((n,x)=>n+x.count,0),m.capacity);assert.ok(arcs.every(x=>Math.abs(x.end-x.start-x.count/m.capacity)<1e-12));}const s=explorerModel(roster,evidence,'senate');assert.equal(s.outlook.aligned.D,s.outlook.aligned.R);assert.equal(s.outlook.segments.filter(x=>x.independent).reduce((n,x)=>n+x.count,0),2);});
test('state geometry is pinned by hash and sums exactly to both chamber rosters',()=>{const item=geographyAssets.states20m,raw=fs.readFileSync(new URL('../dist/'+item.path,import.meta.url));assert.equal(raw.length,item.bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),item.sha256);const states=JSON.parse(raw);assert.equal(states.features.length,50);assert.equal(new Set(states.features.map(f=>f.properties.state_fips)).size,50);assert.ok(states.features.every(f=>/^\d{2}$/.test(f.properties.state_fips)));for(const c of ['senate','house'])assert.equal(states.features.reduce((n,f)=>n+explorerModel(roster,evidence,c,f.properties.postal).capacity,0),c==='senate'?100:435);});
test('Alaska crossing the dateline stays contiguous within its inset; polygons preserve all holes',()=>{assert.deepEqual(projectPoint(179,52,'AK'),projectPoint(-181,52,'AK'));const states=read(geographyAssets.states20m.path);for(const f of states.features){const original=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates,p=projectedPolygons(f);assert.equal(p.length,original.length);for(let i=0;i<p.length;i++){assert.equal(p[i].length,original[i].length);for(const ring of p[i])assert.ok(ring.every(([x,z])=>Number.isFinite(x)&&Number.isFinite(z)&&Math.abs(x)<40&&Math.abs(z)<25));}}});
test('district layer contains only seven verified 2026 features; CA22 remains a changed boundary',()=>{const item=geographyAssets.districts7,raw=fs.readFileSync(new URL('../dist/'+item.path,import.meta.url));assert.equal(createHash('sha256').update(raw).digest('hex'),item.sha256);const data=JSON.parse(raw);assert.equal(data.features.length,7);assert.deepEqual(data.features.map(f=>f.properties.district_id).sort(),['AZ06','CA22','CO08','MI07','NJ07','NY17','PA07']);assert.equal(data.features.find(f=>f.properties.district_id==='CA22').properties.boundary_changed_since_2024,true);assert.ok(data.features.every(f=>f.properties.election_year===2026&&f.properties.boundary_congress===120));});
test('the needle stays at 50%; the outer arc is a full-chamber seat difference without allocating toss-ups',()=>{
 // Fixed examples cover a tie, a rating change, and a Republican lead without
 // treating the current research snapshot as a permanent forecast fixture.
 for(const [capacity,D,R,T,U,side,seats] of [[100,46,46,8,0,null,0],[435,34,31,22,348,'D',3],[435,35,31,21,348,'D',4],[435,31,35,21,348,'R',4]]){
  assert.equal(D+R+T+U,capacity);
  const lead=floorLead({capacity,outlook:{aligned:{D,R,I:0,T,U}}});
  assert.equal(lead.side,side);assert.equal(lead.seats,seats);
  assert.equal(lead.arcRadians,Math.PI*seats/capacity);assert.equal(lead.midpoint,.5);
 }
});
test('historical winners are distinct from current party and vacancies, with independent caucuses left unknown',()=>{assert.deepEqual(historicalComposition(evidence,'house').aligned,{D:215,R:220,I:0,U:0});assert.deepEqual(historicalComposition(evidence,'senate').aligned,{D:45,R:53,I:2,U:0});const baseline=evidence.historicalBaselines;assert.deepEqual(baseline.senatePost2024.cycleCounts,{2020:31,2022:35,2024:34});assert.equal(baseline.house2024.seats.find(s=>s.seatId==='H-CA-03').winnerParty,'R');assert.equal(roster.seats.find(s=>s.seatId==='H-CA-03').currentParty,'I');for(const id of ['H-FL-20','H-TX-23']){assert.ok(baseline.house2024.seats.find(s=>s.seatId===id).winnerParty);assert.equal(roster.seats.find(s=>s.seatId===id).vacant,true);}assert.ok(baseline.senatePost2024.seats.filter(s=>s.historicalParty==='I').every(s=>s.caucus===null));});
