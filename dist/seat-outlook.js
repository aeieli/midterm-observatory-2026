// Categorical seat accounting. Ratings are not probabilities or promised votes.
const ratings = new Set(['solid-D','likely-D','lean-D','tossup','lean-R','likely-R','solid-R']);
const districtNumber = value => ['AL','AT-LARGE'].includes(String(value).toUpperCase()) ? 0 : Number(value);

export function ratingForSeat(seat, evidence) {
  if (!seat.contested2026) return null;
  const matches = (evidence.ratings || []).filter(r => r.seatId ? r.seatId === seat.seatId :
    r.chamber === seat.chamber && r.state === seat.state && (seat.chamber === 'senate' || districtNumber(r.district) === districtNumber(seat.district)));
  return matches.length === 1 && ratings.has(matches[0].rating) ? matches[0] : null;
}

export function meaningfulPowers(powers, chamber) {
  const ids = powers[chamber === 'senate' ? 'recommendedSenatePowerIds' : 'recommendedHousePowerIds'];
  return ids.map(id => powers.powers.find(p => p.id === id)).filter(p => p?.gauge?.showSeatLine && p.chambers.includes(chamber));
}

export function thresholdReference(power, chamber, denominator) {
  if (!Number.isInteger(denominator) || denominator < 1) throw Error('Invalid illustrative denominator');
  const rule = power.thresholds.find(t => t.chamber === chamber);
  if (!rule || !power.gauge?.showSeatLine) return null;
  const formula = rule.formula;
  const votes = /^floor\([VC] \/ 2\) \+ 1$/.test(formula) ? Math.floor(denominator / 2) + 1 :
    /^ceil\(2 \* [VP] \/ 3\)$/.test(formula) ? Math.ceil(2 * denominator / 3) :
    formula === 'ceil(3 * N / 5)' ? Math.ceil(3 * denominator / 5) : null;
  if (votes === null) throw Error('Unsupported voting rule; do not invent a threshold');
  return { votes, denominator, denominatorType: rule.denominator, tieBreaker: rule.tieBreaker || null };
}

export function buildSeatComparison(roster, evidence, chamber) {
  const seats = roster.seats.filter(s => s.chamber === chamber);
  const current = new Map(), outlook = new Map();
  const party = { D: 0, R: 0, I: 0, U: 0, vacant: 0 };
  let retained = 0, mapped = 0;
  function add(target, alignment, kind, independent = false) {
    const key = [alignment,kind,independent ? 'I' : 'party'].join('-');
    if (!target.has(key)) target.set(key, { key, alignment, kind, independent, count: 0 });
    target.get(key).count++;
  }
  for (const seat of seats) {
    const p = seat.vacant ? 'vacant' : ['D','R','I'].includes(seat.currentParty) ? seat.currentParty : 'U';
    party[p]++;
    const alignment = seat.vacant ? 'U' : ['D','R'].includes(seat.caucus) ? seat.caucus : ['D','R','I'].includes(p) ? p : 'U';
    add(current, alignment, seat.vacant ? 'vacant' : 'current', p === 'I');
    if (!seat.contested2026) {
      retained++;
      add(outlook, alignment, seat.vacant ? 'unknown' : 'base', p === 'I');
    } else {
      const rating = ratingForSeat(seat, evidence)?.rating;
      if (!rating) add(outlook, 'U', 'unknown');
      else {
        mapped++;
        if (rating === 'tossup') add(outlook, 'T', 'tossup');
        else { const [kind, side] = rating.split('-'); add(outlook, side, kind); }
      }
    }
  }
  function finish(map) {
    const rank = { current: 0, base: 0, solid: 2, likely: 3, lean: 4, tossup: 5, unknown: 6, vacant: 6 };
    const position = s => s.alignment === 'D' ? rank[s.kind] + (s.independent ? 1 : 0) :
      s.alignment === 'R' ? 20 - rank[s.kind] - (s.independent ? 1 : 0) : s.alignment === 'I' ? 8 : s.alignment === 'T' ? 9 : 10;
    const segments = [...map.values()].sort((a,b) => position(a) - position(b));
    const aligned = Object.fromEntries(['D','R','I','T','U'].map(side => [side, segments.filter(s => s.alignment === side).reduce((n,s) => n+s.count, 0)]));
    const independent = Object.fromEntries(['D','R','I'].map(side => [side, segments.filter(s => s.alignment === side && s.independent).reduce((n,s) => n+s.count, 0)]));
    return { segments, aligned, independent };
  }
  const next = finish(outlook);
  const steps = {};
  for (const side of ['D','R']) {
    const count = kinds => next.segments.filter(s => s.alignment === side && kinds.includes(s.kind)).reduce((n,s) => n+s.count, 0);
    steps[side] = [count(['base','solid']), count(['base','solid','likely']), count(['base','solid','likely','lean'])];
  }
  return { capacity: seats.length, occupied: seats.filter(s => !s.vacant).length, retained, contested: seats.filter(s => s.contested2026).length,
    mapped, party, current: finish(current), outlook: next, steps };
}
