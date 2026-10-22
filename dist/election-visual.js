// A probability is accepted only as an explicitly verified, sourced model output.
// Poll shares, category labels, and incumbent party never become probabilities.
const sides=['D','R','I','other'];
export function verifiedProbability(seat) {
 const f=seat.forecast;
 if(!seat.contested2026||!f||f.metric!=='winProbability'||f.unit!=='probability-0-1'||f.verified!==true||f.electionYear!==2026||
    typeof f.model!=='string'||!f.model.trim()||!/^https:\/\//.test(f.source||'')||!Number.isFinite(Date.parse(f.asOf)))return null;
 if(!seat.seatId||f.seatId!==seat.seatId||f.outcomeCoverage!=='all-eligible-candidates'||
    !Array.isArray(seat.verifiedCandidateIds)||!seat.verifiedCandidateIds.length||!/^https:\/\//.test(seat.candidateRosterSource||''))return null;
 if(!Array.isArray(f.probabilities)||!f.probabilities.length)return null;
 const identities=new Set(seat.verifiedCandidateIds),outcomes=new Set();
 if(identities.size!==seat.verifiedCandidateIds.length||f.probabilities.length!==identities.size)return null;
 const values=Object.fromEntries(sides.map(x=>[x,0])),seen=new Set();
 for(const entry of f.probabilities){if(!sides.includes(entry.party)||!identities.has(entry.candidateId)||outcomes.has(entry.candidateId)||typeof entry.personName!=='string'||!entry.personName.trim()||typeof entry.value!=='number'||!Number.isFinite(entry.value)||entry.value<0||entry.value>1)return null;seen.add(entry.party);outcomes.add(entry.candidateId);values[entry.party]+=entry.value;}
 if(Math.abs(Object.values(values).reduce((a,b)=>a+b,0)-1)>1e-6)return null;
 return {values,model:f.model,asOf:f.asOf,source:f.source};
}
export function electionVisual(seat,rating,mode='forecast') {
 const probability=verifiedProbability(seat);
 if(!seat.contested2026)return{hologram:false,kind:'retained',side:seat.currentParty||'U',probability:null,independent:seat.currentParty==='I'};
 const category=rating?.rating||'';
 const valid=/^(solid|likely|lean)-(D|R)$/.test(category);
 return {hologram:true,kind:probability&&mode!=='current'?'probability':valid?category.split('-')[0]:category==='tossup'?'tossup':'unknown',
   side:mode==='current'?(seat.currentParty||'U'):valid?category.split('-')[1]:category==='tossup'?'T':'U',
   probability:mode==='current'?null:probability,independent:seat.currentParty==='I'};
}
