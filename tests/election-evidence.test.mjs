import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {verifiedProbability,electionVisual} from '../dist/election-visual.js';
import {eligiblePortrait,candidateEvidence,coverageAudit,rosterEvidence} from '../dist/profile-evidence.js';
import {newsEntries,newsHTML,interpretationHTML} from '../dist/news-impact.js';
const read=p=>JSON.parse(readFileSync(new URL('../dist/data/'+p,import.meta.url)));const seats=read('seats.json').seats;
const identity={seatId:'S-XX-2',verifiedCandidateIds:['xx-d','xx-r'],candidateRosterSource:'https://example.com/official-roster'};
const forecast={seatId:'S-XX-2',outcomeCoverage:'all-eligible-candidates',unit:'probability-0-1',metric:'winProbability',verified:true,electionYear:2026,model:'Verified model',asOf:'2026-10-22T01:00:00Z',source:'https://example.com/model',probabilities:[{candidateId:'xx-d',personName:'Example D',party:'D',value:.6},{candidateId:'xx-r',personName:'Example R',party:'R',value:.4}]};
test('probability requires an explicit sourced model; vote share and ratings never turn into probabilities',()=>{const s={...identity,contested2026:true,forecast};assert.equal(verifiedProbability(s).values.D,.6);for(const f of [{...forecast,unit:'percentage'},{...forecast,seatId:'S-YY-2'},{...forecast,outcomeCoverage:'major-parties-only'},{...forecast,metric:'voteShare'},{...forecast,verified:false},{...forecast,source:null},{...forecast,model:''},{...forecast,asOf:'unknown'},{...forecast,probabilities:[{party:'D',value:NaN},{party:'R',value:.4}]},{...forecast,probabilities:[{party:'D',value:.5},{party:'R',value:.4}]}])assert.equal(verifiedProbability({...s,forecast:f}),null);assert.equal(verifiedProbability({...s,contested2026:false}),null);});
test('35 Senate and all 435 House mandates are holograms; 65 Senate mandates remain solid',()=>{for(const [chamber,holo,solid] of [['senate',35,65],['house',435,0]]){const visual=seats.filter(s=>s.chamber===chamber).map(s=>electionVisual(s,null,'forecast'));assert.equal(visual.filter(v=>v.hologram).length,holo);assert.equal(visual.filter(v=>!v.hologram).length,solid);}assert.equal(seats.filter(s=>verifiedProbability(s)).length,0);});
test('unknown rating stays neutral while independent identity survives categorical color',()=>{const s={contested2026:true,currentParty:'I'};assert.equal(electionVisual(s,null,'forecast').side,'U');assert.equal(electionVisual(s,{rating:'lean-D'},'forecast').independent,true);});
test('portrait fails closed without verified identity, reuse rights or ready asset',()=>{const portrait={assetReady:true,visualIdentityVerified:true,verified:true,usageAllowed:true,url:'https://example.com/image.jpg',source:'https://example.com/source',rightsSource:'https://example.com/rights'};assert.ok(eligiblePortrait({portrait}));for(const x of [{usageAllowed:false},{verified:false},{rightsSource:null},{assetReady:false},{assetReady:undefined},{visualIdentityVerified:null}])assert.equal(eligiblePortrait({portrait:{...portrait,...x}}),null);});
test('candidate evidence keeps incomplete rosters and unsupported biographies explicit',()=>{assert.equal(candidateEvidence({background:'Officeholder'}).biography,false);const r=rosterEvidence({candidateRoster:{status:'official-list-checked',source:'https://state.gov/list'}});assert.equal(r.verified,true);assert.equal(r.completeIncludingWriteIns,false);const audit=coverageAudit(seats,read('house_profiles.json').profiles,'house');assert.equal(audit.contestedSeats,435);assert.ok(audit.seatsWithCandidates<435);assert.ok(audit.portraits<audit.candidateRecords);});
test('news attention filters do not change facts or fabricate control judgments',()=>{
 const item=(id,date,priority,scope,quality,extra={})=>({id,date,title:id,summary:`fact-${id}`,interpretation:`analysis-${id}`,source:'https://example.com/public-record',annotation:{priority,impactScope:[scope],controlJudgment:'unchanged',evidenceQuality:{level:quality,note:`evidence-${id}`},...extra}});
 const fixture={news:[
  item('poll','2020-01-04','low','race','primary-verified',{controlJudgment:null}),
  item('reported-order','2020-01-01','high','admin','reported-primary-order-missing',{signedOrderVerified:false}),
  item('party-motion','2020-01-03','medium','admin','primary-filing-verified',{motionGrantedVerified:false}),
  item('signed-order','2020-01-02','high','admin','primary-verified',{signedOrderVerified:true,effectiveStatus:'not-verified',evidenceQuality:{level:'primary-verified',note:'Signed order verified; current effectiveness unknown.'}})
 ]};
 const original=structuredClone(fixture),ids=rows=>rows.map(n=>n.id),esc=x=>String(x??'');
 assert.deepEqual(ids(newsEntries(fixture,{})),['signed-order','reported-order','party-motion','poll']);
 assert.deepEqual(ids(newsEntries(fixture,{priority:'high'})),['signed-order','reported-order']);
 assert.deepEqual(ids(newsEntries(fixture,{scope:'admin'})),['signed-order','reported-order','party-motion']);
 assert.deepEqual(newsEntries(fixture,{priority:'high',scope:'race'}),[]);
 const html=newsHTML(fixture,{priority:'high'},esc);
 assert.match(html,/法院命令待核验/);assert.match(html,/Signed order verified; current effectiveness unknown\./);
 assert.doesNotMatch(html,/fact-party-motion|fact-poll/);
 assert.match(newsHTML(fixture,{priority:'low'},esc),/<span class="impact-control">待核验<\/span>/);
 assert.deepEqual(fixture,original); // Rendering must not promote a filing/order to effective relief.
 const e=read('evidence.json'),before=structuredClone(e);
 assert.equal(new Set(e.news.map(n=>n.id)).size,e.news.length);
 assert.equal((newsHTML(e,{},esc).match(/class="impact-news"/g)||[]).length,e.news.length);
 assert.equal((interpretationHTML(e,esc).match(/class="interpretation-card"/g)||[]).length,e.interpretationCards.length);
 assert.deepEqual(e,before);
});
test('frozen candidate identities preserve redrawn seats, same-party races, and distinct Sullivans',()=>{const h=read('house_profiles.json').profiles,s=read('senate_profiles.json').profiles;const ca40=h.find(p=>p.seatId==='H-CA-40');assert.deepEqual(ca40.candidates.map(c=>[c.name,c.party]),[['Ken Calvert','R'],['Young Kim','R']]);const ca3=h.find(p=>p.seatId==='H-CA-03');assert.equal(ca3.incumbent.name,'Kevin Kiley');assert.equal(ca3.candidates[0].name,'Ami Bera');assert.equal(eligiblePortrait(ca3.candidates[0]),null);const ak=s.find(p=>p.seatId==='S-AK-2');assert.ok(ak.candidates.some(c=>c.name==='Dan Sullivan'));assert.ok(ak.candidates.some(c=>c.name==='Daniel J. Sullivan Jr.'));const marvin=s.flatMap(p=>p.candidates).find(c=>c.name==='Mike Marvin');assert.equal(marvin.campaignStatus,'suspended-but-remains-on-ballot');});
test('printed, write-in and unopposed statuses remain explicit without losing candidates',()=>{const h=read('house_profiles.json').profiles,cs=h.flatMap(p=>p.candidates);assert.equal(cs.length,1187);assert.equal(new Set(cs.map(c=>c.id)).size,1187);assert.equal(cs.filter(c=>c.printedOnBallot===true).length,1139);assert.equal(cs.filter(c=>c.isWriteIn===true).length,47);const frost=h.find(p=>p.seatId==='H-FL-10').candidates[0];assert.equal(frost.generalContestStatus,'unopposed-no-printed-contest');assert.equal(frost.isWriteIn,false);const valimont=h.find(p=>p.seatId==='H-FL-01').candidates.find(c=>c.name==='Gay Valimont');assert.equal(valimont.generalContestStatus,'contested');assert.equal(valimont.printedOnBallot,true);assert.equal(seats.filter(s=>s.chamber==='house'&&s.vacant).length,2);});
test('verified same-party model outcomes aggregate without inventing another party',()=>{const f={...forecast,probabilities:forecast.probabilities.map(p=>({...p,party:'R'}))};assert.deepEqual(verifiedProbability({...identity,contested2026:true,forecast:f}).values,{D:0,R:1,I:0,other:0});});
