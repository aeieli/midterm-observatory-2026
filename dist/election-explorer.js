import {buildSeatComparison,ratingForSeat} from './seat-outlook.js';

export const monitoredStates=['MI','OH','ME','AK','TX','IA','NC','GA','NH'];
export const isKeySeat=(seat,evidence)=>seat.contested2026&&['tossup','lean-D','lean-R'].includes(ratingForSeat(seat,evidence)?.rating);
export const categoryLabels={base:'不改选基础',current:'当前党团',solid:'稳固评级',likely:'较稳评级',lean:'倾向评级',tossup:'竞争胶着',unknown:'未知评级',vacant:'空缺',historical:'历史党籍'};
export function segmentColor(s){return s.alignment==='D'?({likely:'#4b82ff',lean:'#b3cbff'}[s.kind]||'#155dff'):s.alignment==='R'?({likely:'#f76380',lean:'#ffc2ce'}[s.kind]||'#f1264f'):({I:'#9c54ff',T:'#f7b72e',U:'#dae0e6'}[s.alignment]||'#dae0e6');}
export function explorerModel(roster,evidence,chamber,state=null){
 const seats=roster.seats.filter(s=>s.chamber===chamber&&(!state||s.state===state)),whole=buildSeatComparison({seats},evidence,chamber),keySeats=seats.filter(s=>isKeySeat(s,evidence));
 return {...whole,seats,keySeats,key:buildSeatComparison({seats:keySeats},evidence,chamber),majority:Math.floor((chamber==='senate'?100:435)/2)+1};
}
export function floorSegments(model){let count=0;return model.outlook.segments.map(s=>{const start=count/model.capacity;count+=s.count;return {...s,start,end:count/model.capacity,color:segmentColor(s)};});}
export function floorLead(model){const difference=model.outlook.aligned.D-model.outlook.aligned.R;return {side:difference>0?'D':difference<0?'R':null,seats:Math.abs(difference),arcRadians:Math.PI*Math.abs(difference)/model.capacity,midpoint:.5};}
export function compactKeyHTML(model,esc){return `<div class="focus-summary"><strong>关键席位 ${model.keySeats.length} / ${model.capacity}</strong><span>D ${model.key.outlook.aligned.D} · R ${model.key.outlook.aligned.R} · 竞争胶着 ${model.key.outlook.aligned.T}</span></div><div class="focus-categories">${model.key.outlook.segments.map(s=>`<span><i style="background:${segmentColor(s)}"></i>${s.alignment==='T'?'':s.alignment+' · '}${esc(categoryLabels[s.kind])} <b>${s.count}</b></span>`).join('')}</div><details class="source-details"><summary>筛选与来源</summary><p>关键席位仅含有来源的倾向与竞争胶着评级；未知评级不计入。</p><p>全院多数参考 ${model.majority} · 未知评级 ${model.outlook.aligned.U}</p><p>星标为监测重点，不表示已证实将决定控制权。</p></details>`;}

// Albers equal-area projection for the contiguous states; AK and HI are
// explicitly separate, scaled insets. Normalize Alaska across the dateline.
export function projectPoint(lon,lat,state){
 const rad=Math.PI/180;
 if(state==='AK'){if(lon>0)lon-=360;return [(lon+154)*Math.cos(63*rad)*.28-11.2,-(lat-63)*.28+8.2];}
 if(state==='HI')return [(lon+157)*.55-3.8,-(lat-20.5)*.55+8.4];
 const phi1=29.5*rad,phi2=45.5*rad,n=(Math.sin(phi1)+Math.sin(phi2))/2,C=Math.cos(phi1)**2+2*n*Math.sin(phi1),rho=Math.sqrt(C-2*n*Math.sin(lat*rad))/n,rho0=Math.sqrt(C-2*n*Math.sin(38*rad))/n,theta=n*(lon+96)*rad;
 return [rho*Math.sin(theta)*32,(rho*Math.cos(theta)-rho0)*32];
}
export function projectedPolygons(feature){const state=feature.properties.postal;const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.type==='MultiPolygon'?feature.geometry.coordinates:[];return polygons.map(rings=>rings.map(ring=>ring.map(([lon,lat])=>projectPoint(lon,lat,state))));}

export function historicalComposition(evidence,chamber,state=null){
 const dataset=evidence.historicalBaselines?.[chamber==='house'?'house2024':'senatePost2024'];
 if(!dataset?.seats)return null;
 const seats=dataset.seats.filter(s=>!state||s.state===state),counts={D:0,R:0,I:0,U:0};
 for(const seat of seats){const party=chamber==='house'?seat.winnerParty:seat.historicalParty;counts[['D','R','I'].includes(party)?party:'U']++;}
 return {segments:['D','I','R','U'].filter(side=>counts[side]).map(alignment=>({alignment,kind:'historical',independent:alignment==='I',count:counts[alignment]})),aligned:counts,seats,sources:dataset.sources||[dataset.source]};
}
