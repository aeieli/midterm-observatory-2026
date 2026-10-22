import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
// Run the real language switch against a tiny DOM adapter and delayed document loads.
// No browser internals, credentials, or network calls are used.
test('late and failed translation requests cannot overwrite the latest successful explicit choice',async()=>{
 const pending=new Map(),storage=new Map(),select={value:'en'},note={},nodes=new Map();
 globalThis.__localeLoad=path=>new Promise((resolve,reject)=>pending.set(path,{resolve,reject}));
 globalThis.document={documentElement:{lang:'en'},querySelector:q=>q==='#language-select'?select:q==='#translation-note'?note:q==='.language-picker'?{after:n=>nodes.set(n.id,n)}:nodes.get(q.slice(1)),querySelectorAll:()=>[],createTreeWalker:()=>({nextNode:()=>null}),createElement:()=>({dataset:{},setAttribute(){},remove(){nodes.delete(this.id)}})};
 globalThis.NodeFilter={SHOW_TEXT:4};globalThis.localStorage={setItem:(k,v)=>storage.set(k,v)};globalThis.window={dispatchEvent(){}};globalThis.CustomEvent=class{};
 let source=fs.readFileSync(new URL('../dist/i18n.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'');
 source='const loadJSON=globalThis.__localeLoad;\n'+source+'\nexport {changeLanguage};';
 const mod=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const french=mod.changeLanguage('fr'),japanese=mod.changeLanguage('ja');
 pending.get('locales/ja.json').resolve({});assert.equal(await japanese,true);pending.get('locales/fr.json').resolve({});assert.equal(await french,false);assert.equal(document.documentElement.lang,'ja-JP');assert.equal(storage.get('midterm-language'),'ja');
 const spanish=mod.changeLanguage('es');pending.get('locales/es.json').reject(Error('test translation unavailable'));assert.equal(await spanish,false);assert.equal(select.value,'ja');assert.equal(document.documentElement.lang,'ja-JP');assert.equal(storage.get('midterm-language'),'ja');assert.match(nodes.get('language-error').textContent,/unchanged/);
 for(const key of ['document','NodeFilter','localStorage','window','CustomEvent','__localeLoad'])delete globalThis[key];
});
