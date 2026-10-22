// Limited, named-candidate quotations. This is deliberately separate from the
// complete-outcome contract used to color figures and calculate model totals.
const https = value => typeof value === 'string' && /^https:\/\//.test(value);
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
export function modelQuoteForSeat(seat, profile, evidence) {
  if (!seat?.contested2026 || profile?.seatId !== seat.seatId) return null;
  const matches = (evidence?.modelProbabilityQuotes || []).filter(q => q.seatId === seat.seatId);
  if (matches.length !== 1) return null;
  const q = matches[0];
  if (q.electionYear !== 2026 || q.electionType !== (seat.special ? 'special' : 'regular') ||
      q.metric !== 'winProbability' || q.unit !== 'probability-0-1' ||
      q.coverage !== 'selected-named-candidates' || typeof q.model !== 'string' || !q.model.trim() ||
      !https(q.source) || !https(q.tableSource) || !timestamp(q.observedAt) ||
      !(q.modelUpdatedAt === null || timestamp(q.modelUpdatedAt)) ||
      !Array.isArray(q.candidates) || !q.candidates.length) return null;
  const identities = new Set();
  for (const c of q.candidates) {
    const identity = JSON.stringify([c.name, c.party]);
    if (identities.has(identity) || typeof c.value !== 'number' || !Number.isFinite(c.value) ||
        c.value < 0 || c.value > 1 || !['D', 'R', 'I', 'L', 'G'].includes(c.party) ||
        typeof c.name !== 'string' || !c.name.trim() || (profile.candidates || []).filter(p => p.name === c.name && p.party === c.party).length !== 1) return null;
    identities.add(identity);
  }
  // No normalization or missing-candidate zeroes, even when the quoted pair sums to one.
  return q;
}
export function quotedCandidateProbability(quote, candidate) {
  return quote?.candidates.find(c => c.name === candidate.name && c.party === candidate.party) ?? null;
}
const percent = value => Math.round(value * 1000) / 10;
export function modelQuoteHTML(quote, esc) {
  if (!quote) return '';
  return `<section class="model-quotes"><h3>主要候选人 · 模型胜率</h3>${quote.candidates.map(c => `<div class="model-quote-row"><div><span>${esc(c.name)} <b>${esc(c.party)}</b></span><strong>${esc(percent(c.value))}%</strong></div><div class="model-quote-track" aria-hidden="true"><i class="model-party-${esc(c.party)}" style="width:${percent(c.value)}%"></i></div></div>`).join('')}<a class="small" href="${esc(quote.source)}" target="_blank" rel="noopener">${esc(quote.model)} ↗</a><details class="source-details"><summary>模型来源与时间</summary><dl><dt>核查时间</dt><dd><time datetime="${esc(quote.observedAt)}">${esc(quote.observedAt)}</time></dd><dt>模型更新时间</dt><dd>${quote.modelUpdatedAt ? esc(quote.modelUpdatedAt) : '来源未提供'}</dd></dl><p>仅引用已核对的主要候选人；其他候选人概率未知。</p><p>模型胜率不等于得票率；不会把这六场样本汇总为全院预测。</p><a href="${esc(quote.tableSource)}" target="_blank" rel="noopener">模型原表 ↗</a></details></section>`;
}
export function candidateQuoteHTML(quote, candidate, esc) {
  const c = quotedCandidateProbability(quote, candidate);
  return c ? `<div class="candidate-model-probability"><span>模型胜率</span><strong>${esc(percent(c.value))}%</strong><a href="${esc(quote.source)}" target="_blank" rel="noopener">${esc(quote.model)} ↗</a></div>` : '';
}
