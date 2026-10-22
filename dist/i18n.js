import { languagePreference } from './language-preference.js';
import { loadJSON } from './data-loader.js';
const locales={zh:'zh-CN',en:'en-US',fr:'fr-FR',es:'es-ES',ja:'ja-JP'};
let changeSequence=0;
let language='en',catalog=[],messages={},pattern=null,cache=new Map(),observer=null,scheduled=false;
const originals=new WeakMap(),attributeOriginals=new WeakMap();
const englishHeadings={
 en:{},
 fr:{'2026 EDITION':'ÉDITION 2026','SENATE':'SÉNAT','UNITED STATES · CONGRESSIONAL ELECTIONS':'ÉTATS-UNIS · ÉLECTIONS AU CONGRÈS','MIDTERM OBSERVATORY':'OBSERVATOIRE DES ÉLECTIONS','THE CHAMBER':'LES CHAMBRES','SEAT EXPLORER':'EXPLORER LES SIÈGES','SIGNALS, NOT NOISE':'LES SIGNAUX ESSENTIELS','DAILY RECORD':'SUIVI QUOTIDIEN','WHAT CHANGED':'CE QUI CHANGE','OPEN METHODOLOGY':'MÉTHODOLOGIE OUVERTE','POWER & PROCEDURE':'POUVOIRS ET PROCÉDURES','PRESIDING OFFICER & CONDITIONAL SCENARIOS':'PRÉSIDENCE ET SCÉNARIOS CONDITIONNELS','PUBLIC SERVICE ID':'FICHE DU PARLEMENTAIRE','POLLING / ORIGINAL SAMPLES':'SONDAGES / ÉCHANTILLONS ORIGINAUX'},
 es:{'2026 EDITION':'EDICIÓN 2026','SENATE':'SENADO','UNITED STATES · CONGRESSIONAL ELECTIONS':'ESTADOS UNIDOS · ELECCIONES AL CONGRESO','MIDTERM OBSERVATORY':'OBSERVATORIO ELECTORAL','THE CHAMBER':'LAS CÁMARAS','SEAT EXPLORER':'EXPLORAR ESCAÑOS','SIGNALS, NOT NOISE':'SEÑALES RELEVANTES','DAILY RECORD':'REGISTRO DIARIO','WHAT CHANGED':'QUÉ HA CAMBIADO','OPEN METHODOLOGY':'METODOLOGÍA ABIERTA','POWER & PROCEDURE':'PODERES Y PROCEDIMIENTOS','PRESIDING OFFICER & CONDITIONAL SCENARIOS':'PRESIDENCIA Y ESCENARIOS CONDICIONALES','PUBLIC SERVICE ID':'FICHA DEL LEGISLADOR','POLLING / ORIGINAL SAMPLES':'ENCUESTAS / MUESTRAS ORIGINALES'},
 ja:{'2026 EDITION':'2026年版','SENATE':'上院','UNITED STATES · CONGRESSIONAL ELECTIONS':'米国 · 連邦議会選挙','MIDTERM OBSERVATORY':'中間選挙オブザーバトリー','THE CHAMBER':'議場','SEAT EXPLORER':'議席を調べる','SIGNALS, NOT NOISE':'重要な変化を追う','DAILY RECORD':'日次記録','WHAT CHANGED':'変化したこと','OPEN METHODOLOGY':'公開された分析方法','POWER & PROCEDURE':'権限と手続','PRESIDING OFFICER & CONDITIONAL SCENARIOS':'議事主宰者と条件付きシナリオ','PUBLIC SERVICE ID':'議員プロフィール','POLLING / ORIGINAL SAMPLES':'世論調査 / 元の標本'}
};
const notes={zh:'',en:'Translated research text. Original sources remain linked; names and data are preserved.',fr:'Textes de recherche traduits. Les sources originales restent accessibles ; noms et données sont conservés.',es:'Textos de investigación traducidos. Se conservan los nombres, los datos y los enlaces a las fuentes originales.',ja:'調査テキストの翻訳版です。氏名・数値・原典へのリンクは保持しています。'};
export const getLocale=()=>locales[language];
export function translate(text){if(language==='zh')return text;if(cache.has(text))return cache.get(text);let result=pattern?text.replace(pattern,source=>messages[source]??source):text;if(['en','fr','es'].includes(language))result=result.replace(/[。；：，（）]/g,c=>({'。':'. ','；':'; ','：':': ','，':', ','（':' (','）':') '})[c]);cache.set(text,result);return result;}
function apply(){scheduled=false;observer?.disconnect();const walker=document.createTreeWalker(document.documentElement,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentElement?.closest('script,style,[data-i18n-skip]')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});let node;while(node=walker.nextNode()){let saved=originals.get(node);if(!saved||node.nodeValue!==saved.translated)saved={source:node.nodeValue};let value=translate(saved.source);if(node.nodeValue!==value)node.nodeValue=value;saved.translated=value;originals.set(node,saved);}for(const el of document.querySelectorAll('[aria-label],[placeholder],[title],[alt],meta[name="description"]')){if(el.closest('[data-i18n-skip]'))continue;let saved=attributeOriginals.get(el)||{};for(const name of ['aria-label','placeholder','title','alt',...(el.tagName==='META'?['content']:[])]){if(!el.hasAttribute(name))continue;let value=el.getAttribute(name),record=saved[name];if(!record||value!==record.translated)record={source:value};record.translated=translate(record.source);if(value!==record.translated)el.setAttribute(name,record.translated);saved[name]=record;}attributeOriginals.set(el,saved);}observer?.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','placeholder','title','alt']});}
function queue(){if(scheduled)return;scheduled=true;queueMicrotask(apply);}
async function changeLanguage(next,{persist=true}={}) {
 const sequence=++changeSequence,select=document.querySelector('#language-select');
 try {
  let translated={};
  if(next!=='zh'){
   const map=await loadJSON(`locales/${next}.json`);
   const missing=catalog.filter(x=>typeof map[x.id]!=='string'||!map[x.id].trim());
   if(missing.length)throw Error(`Incomplete locale: ${missing.length}`);
   for(const entry of catalog)translated[entry.source]=map[entry.id];
   Object.assign(translated,englishHeadings[next]||{});
  }
  if(sequence!==changeSequence)return false;
  messages=translated;language=next;cache=new Map();
  const keys=Object.keys(messages).sort((a,b)=>b.length-a.length);
  pattern=keys.length?new RegExp(keys.map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g'):null;
  document.documentElement.lang=locales[next];
  if(persist){try{localStorage.setItem('midterm-language',next);localStorage.setItem('midterm-language-explicit','1');}catch{}document.querySelector('#language-suggestion')?.remove();}
  if(select)select.value=next;
  document.querySelector('#translation-note').textContent=notes[next];
  document.querySelector('#language-error')?.remove();
  window.dispatchEvent(new CustomEvent('localechange'));apply();return true;
 }catch(error){
  if(sequence!==changeSequence)return false;
  console.error('Language loading failed',error);
  if(select)select.value=language;
  const warning=document.querySelector('#language-error')||document.createElement('p');warning.id='language-error';warning.dataset.i18nSkip='';warning.setAttribute('role','status');warning.textContent='Translation could not be loaded. Your current language is unchanged. Please try again.';document.querySelector('.language-picker')?.after(warning);return false;
 }
}
export async function initLocale(){
 try {
  catalog=await loadJSON('locales/catalog.json');
  if(!catalog.some(x=>x.source==='当前任期 · 党团席位'))throw Error('The data snapshot does not yet include this interface translation catalog');
  const title=document.querySelector('title[data-source-title]');if(title)title.textContent=title.dataset.sourceTitle;
  const picker=document.createElement('div');picker.className='language-picker';picker.dataset.i18nSkip='';
  picker.innerHTML='<span aria-hidden="true">◎</span><select id="language-select" aria-label="Language / 言語 / 语言"><option value="en">English</option><option value="zh">中文</option><option value="fr">Français</option><option value="es">Español</option><option value="ja">日本語</option></select>';document.querySelector('header').appendChild(picker);
  const note=document.createElement('p');note.id='translation-note';note.className='translation-note';note.dataset.i18nSkip='';document.querySelector('.intro').after(note);
  observer=new MutationObserver(queue);
  picker.querySelector('select').onchange=e=>changeLanguage(e.target.value);
  let saved=null,explicit=false,promptSeen=false;try{saved=localStorage.getItem('midterm-language');explicit=localStorage.getItem('midterm-language-explicit')==='1';promptSeen=localStorage.getItem('midterm-language-prompt-seen')==='1';}catch{}
  const preference=languagePreference({saved,explicit,promptSeen,languages:navigator.languages||[navigator.language]});
  if(!await changeLanguage(preference.language,{persist:false}))throw Error('Initial translation unavailable');
  document.documentElement.classList.remove('locale-loading');
  if(preference.suggestion&&(preference.suggestion!=='en'||preference.legacy)){
   const native={zh:'切换为中文',en:'Use English',fr:'Passer au français',es:'Cambiar a español',ja:'日本語に切り替え'};
   const banner=document.createElement('div');banner.id='language-suggestion';banner.dataset.i18nSkip='';banner.setAttribute('role','region');banner.setAttribute('aria-label','Language suggestion');
   const text=document.createElement('span');text.textContent=preference.legacy?'An earlier language was saved automatically. Confirm your preference:':'Prefer your browser language?';
   const switchButton=document.createElement('button');switchButton.textContent=native[preference.suggestion];switchButton.lang=locales[preference.suggestion];switchButton.onclick=()=>changeLanguage(preference.suggestion);
   const dismiss=document.createElement('button');dismiss.textContent='Keep English ×';dismiss.onclick=()=>changeLanguage('en');banner.append(text,switchButton,dismiss);note.before(banner);
   try{localStorage.setItem('midterm-language-prompt-seen','1');}catch{}
  }
 }catch(error){
  observer?.disconnect();document.documentElement.lang='en';document.title='Midterm Observatory · 2026';
  document.body.replaceChildren();const message=document.createElement('main');message.className='locale-failure';message.innerHTML='<h1>Research could not be loaded</h1><p>The verified data or translations are unavailable. No partial research is displayed.</p><button>Try again</button>';message.querySelector('button').onclick=()=>location.reload();document.body.append(message);document.documentElement.classList.remove('locale-loading');throw error;
 }
}
