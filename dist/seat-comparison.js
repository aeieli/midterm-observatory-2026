import { buildSeatComparison, thresholdReference } from './seat-outlook.js';
const labels={base:'不改选基础',current:'当前党团',solid:'稳固评级',likely:'较稳评级',lean:'倾向评级',tossup:'竞争胶着',unknown:'未知评级',vacant:'空缺'};
const sides={D:'民主党党团',R:'共和党党团',I:'独立未归团',T:'竞争胶着',U:'未知评级'};
export function comparisonHTML(roster,evidence,chamber,power,esc,side='D') {
 const m=buildSeatComparison(roster,evidence,chamber),ref=thresholdReference(power,chamber,m.capacity),occupied=thresholdReference(power,chamber,m.occupied);
 const description=s=>s.alignment==='T'||s.alignment==='U'?labels[s.kind]:sides[s.alignment]+' · '+labels[s.kind];
 const nums=value=>esc(value),fraction=ref.votes/m.capacity*100;
 const ruler=`<div class="vote-ruler" aria-label="所需赞成票（满员参考）"><span class="vote-frame" style="width:${fraction}%;${side==='R'?'right:0':'left:0'}"><b>${nums(ref.votes)} / ${nums(m.capacity)}</b></span></div><p class="ruler-label">所需赞成票（满员参考） · <strong>${nums(ref.votes)}</strong></p>`;
 const segments=group=>`<div class="seat-track">${group.segments.map(s=>`<span class="seat-segment side-${s.alignment} kind-${s.kind}${s.independent?' is-independent':''}" style="flex-basis:${s.count/m.capacity*100}%" title="${esc(description(s))}${s.independent?' · 独立议员':''} · ${nums(s.count)}">${s.count/m.capacity>.055?nums(s.count):''}</span>`).join('')}</div>`;
 const legend=group=>`<ul class="seat-key">${group.segments.map(s=>`<li><i class="seat-segment side-${s.alignment} kind-${s.kind}${s.independent?' is-independent':''}"></i><span>${esc(description(s))}${s.independent?' · 独立议员':''}</span><b>${nums(s.count)}</b></li>`).join('')}</ul>`;
 const gap=Math.max(0,ref.votes-m.current.aligned[side]),steps=m.steps[side];
 return `<div class="comparison-controls"><p>一致党团口径 · 独立身份用紫色边框保留</p><div role="group" aria-label="门槛参考方向"><button data-threshold-side="D" aria-pressed="${side==='D'}">民主党党团</button><button data-threshold-side="R" aria-pressed="${side==='R'}">共和党党团</button></div></div>
 <div class="seat-comparison" data-capacity="${m.capacity}" data-threshold="${ref.votes}" data-reference-side="${side}">
 <article class="comparison-card"><span class="eyebrow">CURRENT TERM · 119TH</span><h4>当前任期 · 党团席位</h4><p class="comparison-note">当前席位构成，不是2024原始选举结果。</p>${ruler}${segments(m.current)}<div class="caucus-totals"><strong class="blue">D ${nums(m.current.aligned.D)}</strong><strong class="red">R ${nums(m.current.aligned.R)}</strong><span>空缺 ${nums(m.party.vacant)}</span></div>${legend(m.current)}<p class="comparison-note">当前党籍：D ${nums(m.party.D)} · R ${nums(m.party.R)} · I ${nums(m.party.I)}</p><p class="distance-note">${esc(sides[side])} · 距满员参考：${nums(gap)}<br><small>仅席位数差额，不是所缺实际赞成票。</small></p></article>
 <article class="comparison-card"><span class="eyebrow">AFTER 2026 · RATING SCENARIOS</span><h4>选后情景 · 逐席来源评级</h4><p class="comparison-note">评级是类别，不是概率或得票率。</p>${ruler}${segments(m.outlook)}<div class="caucus-totals"><strong class="blue">D ${nums(m.outlook.aligned.D)}</strong><strong class="red">R ${nums(m.outlook.aligned.R)}</strong><span>竞争 ${nums(m.outlook.aligned.T)} · 未知 ${nums(m.outlook.aligned.U)}</span></div>${legend(m.outlook)}<p class="comparison-note">不改选基础 ${nums(m.retained)} · 已映射评级 ${nums(m.mapped)} / ${nums(m.contested)}</p><p class="distance-note">${esc(sides[side])} · ${nums(steps[0])} → ${nums(steps[1])} → ${nums(steps[2])}<br><small>基础＋稳固 → 加较稳 → 加倾向；类别累加，不是置信区间。</small></p><p class="comparison-note">距满员参考：${nums(Math.max(0,ref.votes-steps[2]))}–${nums(Math.max(0,ref.votes-steps[0]))} · 未分配竞争与未知席。</p></article></div>
 <p class="threshold-caution">中性框仅表示票数标尺，不选定任何议员，也不保证通过。</p>
 <p class="small">${esc(power.denominator)}</p>${m.occupied!==m.capacity?`<p class="small">现任非空缺席位 ${nums(m.occupied)}；若全部计入本项分母，示例门槛 ${nums(occupied.votes)}。实际出席与投票须另行核验。</p>`:''}
 ${m.outlook.aligned.U?'<p class="coverage-alert">未知评级保持未知，不按现任党派分配，也不视为平手。</p>':''}
 <p class="small muted">${esc(power.thresholds.find(t=>t.chamber===chamber)?.tieBreaker||'')}</p>`;
}
