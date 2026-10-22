const publicURL=value=>typeof value==='string'&&/^https:\/\//.test(value);
export function eligiblePortrait(person){const p=person?.photo||person?.portrait;return p?.assetReady===true&&p.visualIdentityVerified===true&&p?.verified===true&&p.usageAllowed===true&&publicURL(p.url)&&publicURL(p.source)&&publicURL(p.rightsSource)?p:null;}
export function candidateEvidence(candidate){
 const c=candidate||{},source=c.candidacySource||c.candidateSource||c.source;
 const biographySource=c.backgroundSource||(c.bioVerified===true?c.source:null);
 const biography=!!c.background&&publicURL(biographySource)&&!c.audit?.blocked;
 const policy=(c.policyPositions?.length?c.policyPositions:c.positions||[]).filter(x=>x?.text&&publicURL(x.source));
 const achievements=(c.majorAchievements?.length?c.majorAchievements:c.achievements||[]).filter(x=>(x?.text||x?.title)&&publicURL(x.source));
 const honors=(c.honors||[]).filter(x=>(x?.title||x?.text)&&publicURL(x.source));
 const portrait=eligiblePortrait(c);
 const officiallyConfirmed=['official-confirmed','official-ballot-verified'].includes(c.verificationStatus)||c.verification==='official-ballot'||c.verification==='official-certified-list'||c.verification==='state-certified-general-election-list'||c.verification==='official-general-election-list';
 const gaps=[];if(!publicURL(source))gaps.push('参选依据');if(!biography)gaps.push('履历');if(!policy.length)gaps.push('政策');if(!achievements.length)gaps.push('成果');if(!honors.length)gaps.push('荣誉');if(!portrait)gaps.push('授权头像');
 return {source:publicURL(source)?source:null,biographySource,biography,policy,achievements,honors,portrait,officiallyConfirmed,gaps};
}
export function coverageAudit(seats,profiles,chamber){
 const target=seats.filter(s=>s.chamber===chamber&&s.contested2026),bySeat=new Map(profiles.map(p=>[p.seatId,p]));
 const rows=target.map(s=>{const p=bySeat.get(s.seatId),candidates=(p?.candidates||[]).map(c=>({name:c.name,...candidateEvidence(c)}));return{seatId:s.seatId,candidateCount:candidates.length,rosterComplete:rosterEvidence(p).verified,candidates};});
 const entries=rows.flatMap(r=>r.candidates),count=key=>entries.filter(c=>key==='portrait'?!!c.portrait:key==='biography'?c.biography:c[key]?.length).length;
 return{chamber,contestedSeats:target.length,seatsWithCandidates:rows.filter(r=>r.candidateCount).length,completeRosters:rows.filter(r=>r.rosterComplete).length,candidateRecords:entries.length,writeInRecords:target.reduce((n,s)=>{const p=bySeat.get(s.seatId);return n+(p?.candidates||[]).filter(c=>c.isWriteIn===true).length+(p?.writeInCandidates||[]).length;},0),biographies:count('biography'),portraits:count('portrait'),policies:count('policy'),achievements:count('achievements'),honors:count('honors'),missingSeatIds:rows.filter(r=>!r.candidateCount).map(r=>r.seatId),rows};
}
export function rosterEvidence(profile){
 const r=profile?.candidateCoverage||profile?.candidateRoster||profile?.rosterAudit;
 const statusChecked=['official-complete','official-list-checked','official-printed-ballot-checked','official-general-roster-verified','official-ballot-verified','official-whole-statewide-contest-verified','official-county-sample-verified','official-general-roster-and-declared-writeins-verified','official-general-roster-and-writeins-verified'].includes(r?.status);
 const direct=publicURL(r?.source)?r.source:null;
 const candidateSources=(profile?.candidates||[]).filter(c=>c.verification==='official-general-election-list').map(c=>c.candidacySource).filter(publicURL);
 const verified=statusChecked&&!!(direct||candidateSources.length),source=verified?(direct||candidateSources[0]):null;
 return{verified,source,scope:r?.scope||null,completeIncludingWriteIns:verified&&r?.includesWriteIns===true&&r?.complete===true};
}
