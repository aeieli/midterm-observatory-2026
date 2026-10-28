import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const template=source.match(/\(evidence\.polls\|\|\[\]\)\.map\(p=>(`[\s\S]*?`)\)\.join\(''\)/);
assert.ok(template,'Locate the actual polling card template');
const render=new Function('p','esc','return '+template[1]),esc=value=>String(value??'');
test('unknown poll metadata stays unknown and never substitutes the full RV sample',()=>{
 const unknown={state:'ME',pollster:'Fixture',dem:49,rep:47,sample:null,moe:null,sampleType:'LV-weighted RV sample',fullRegisteredVoterSample:1449,fullRVMoe:3,mode:null,weighting:null};
 const html=render(unknown,esc);
 assert.match(html,/样本 待核验/);assert.match(html,/误差待核验/);assert.match(html,/权重：待核验/);
 assert.doesNotMatch(html,/null|undefined|1,?449|±3/);
 const known=render({...unknown,sample:600,moe:4},esc);
 assert.match(known,/样本 600/);assert.match(known,/误差 ±4 个百分点/);
 const zero=render({...unknown,sample:0,moe:0},esc);
 assert.match(zero,/样本 0/);assert.match(zero,/误差 ±0 个百分点/);
});
