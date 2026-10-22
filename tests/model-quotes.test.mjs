import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {modelQuoteForSeat,quotedCandidateProbability,modelQuoteHTML,candidateQuoteHTML} from '../dist/model-quotes.js';
import {verifiedProbability,electionVisual} from '../dist/election-visual.js';
import {explorerModel,floorLead} from '../dist/election-explorer.js';
import {profileHTML} from '../dist/profile-cards.js';
const read=path=>JSON.parse(readFileSync(new URL('../dist/'+path,import.meta.url)));
const data=read('data/seats.json'),evidence=read('data/evidence.json'),profiles=read('data/senate_profiles.json').profiles;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const target=id=>[data.seats.find(s=>s.seatId===id),profiles.find(p=>p.seatId===id)];

test('only six verified races quote the twelve supplied model probabilities',()=>{
  const expected={
    'S-MI-2':[['Abdul El-Sayed','D',.75],['Mike Rogers','R',.25]],
    'S-OH-3':[['Sherrod Brown','D',.66],['Jon Husted','R',.34]],
    'S-ME-2':[['Troy Jackson','D',.63],['Susan Collins','R',.37]],
    'S-AK-2':[['Mary Peltola','D',.67],['Dan Sullivan','R',.33]],
    'S-TX-2':[['James Talarico','D',.72],['Ken Paxton','R',.28]],
    'S-IA-2':[['Josh Turek','D',.5],['Ashley Hinson','R',.5]],
  };
  assert.equal(evidence.modelProbabilityQuotes.length,6);
  for(const [id,values] of Object.entries(expected)){
    const [seat,profile]=target(id),q=modelQuoteForSeat(seat,profile,evidence);
    assert.ok(q,id);assert.deepEqual(q.candidates.map(c=>[c.name,c.party,c.value]),values);
    assert.equal(q.modelUpdatedAt,null);assert.equal(q.observedAt,'2026-10-22T14:21:13Z');
    assert.equal(q.source,'https://www.theargumentmag.com/p/split-ticket-2026-midterms-model');
    assert.equal(q.tableSource,'https://datawrapper.dwcdn.net/Hus3x/14/');
  }
  assert.equal(modelQuoteForSeat(...target('S-NC-2'),evidence),null);
});

test('exact identity and contest checks reject namesakes, wrong parties, duplicates and wrong seats',()=>{
  const [s,p]=target('S-AK-2'),q=modelQuoteForSeat(s,p,evidence);
  assert.equal(quotedCandidateProbability(q,{name:'Daniel J. Sullivan Jr.',party:'R'}),null);
  assert.equal(quotedCandidateProbability(q,{name:'Dan Sullivan',party:'I'}),null);
  assert.equal(quotedCandidateProbability(q,{name:'Dan S. Sullivan',party:'R'}),null);
  for(const mutate of [x=>x.candidates[1].name='Dan S. Sullivan',x=>x.candidates[1].party='I',x=>x.candidates.push(x.candidates[1]),x=>x.electionType='special',x=>x.candidates[0].value=75,x=>x.metric='voteShare',x=>x.observedAt=null]){
    const e=structuredClone(evidence);mutate(e.modelProbabilityQuotes.find(x=>x.seatId===s.seatId));assert.equal(modelQuoteForSeat(s,p,e),null);
  }
  assert.equal(modelQuoteForSeat(s,{...p,seatId:'S-MI-2'},evidence),null);
});

test('unquoted candidates stay unknown and model quotes never become complete hologram probabilities',()=>{
  for(const quote of evidence.modelProbabilityQuotes){
    const [seat,profile]=target(quote.seatId),q=modelQuoteForSeat(seat,profile,evidence);
    for(const c of profile.candidates){
      const value=quotedCandidateProbability(q,c);
      if(!quote.candidates.some(x=>x.name===c.name&&x.party===c.party)){
        assert.equal(value,null);assert.equal(candidateQuoteHTML(q,c,esc),'');
      }
    }
    assert.equal(verifiedProbability(seat),null);
    assert.equal(electionVisual(seat,{rating:'tossup'}).hologram,true);
    assert.equal(electionVisual(seat,{rating:'tossup'}).kind,'tossup');
  }
  const withoutQuotes=structuredClone(evidence);delete withoutQuotes.modelProbabilityQuotes;
  assert.deepEqual(explorerModel(data,evidence,'senate'),explorerModel(data,withoutQuotes,'senate'));
  assert.deepEqual(floorLead(explorerModel(data,evidence,'senate')),floorLead(explorerModel(data,withoutQuotes,'senate')));
});

test('candidate cards separate model probabilities from polling and disclose absent model timing in details',()=>{
  const [seat,profile]=target('S-AK-2'),q=modelQuoteForSeat(seat,profile,evidence);
  const html=profileHTML(seat,profile,esc,s=>s.seatId,evidence);
  assert.equal((html.match(/candidate-model-probability/g)||[]).length,2);
  assert.match(html,/67%/);assert.match(html,/33%/);assert.match(html,/Daniel J\. Sullivan Jr\./);
  assert.doesNotMatch(html,/没有可核验的逐席胜选概率模型/);
  const summary=modelQuoteHTML(q,esc);
  assert.match(summary,/<dt>模型更新时间<\/dt><dd>来源未提供/);
  assert.match(summary,/其他候选人概率未知/);
  assert.match(summary,/datetime="2026-10-22T14:21:13Z"/);
  assert.doesNotMatch(summary,/width:0%/);
});
