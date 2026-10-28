// Synthetic full chamber: daily research changes must not redefine test inputs.
export function senateFixture(expandedTossups = false) {
  const seats = [], ratings = [];
  const add = (count, party, caucus, contested2026) => {
    for (let i = 0; i < count; i++) seats.push({
      seatId: `fixture-senate-${seats.length}`, chamber: 'senate', state: 'XX',
      currentParty: party, caucus, contested2026, vacant: false,
    });
  };
  add(32, 'D', 'D', false); add(2, 'I', 'D', false); add(31, 'R', 'R', false);
  add(13, 'D', 'D', true); add(22, 'R', 'R', true);
  const groups = expandedTossups
    ? [['solid-D',8],['likely-D',3],['lean-D',1],['tossup',10],['lean-R',1],['likely-R',1],['solid-R',11]]
    : [['solid-D',8],['likely-D',2],['lean-D',2],['tossup',8],['lean-R',3],['likely-R',1],['solid-R',11]];
  let index = 65;
  for (const [rating,count] of groups) for (let i = 0; i < count; i++) ratings.push({seatId: seats[index++].seatId, rating});
  return {roster: {seats}, evidence: {ratings}};
}
