export const supported=['en','zh','fr','es','ja'];
export function languagePreference({saved,explicit,promptSeen,languages=[]}) {
 const valid=supported.includes(saved),legacy=valid&&!explicit;
 const browser=languages.map(x=>String(x).toLowerCase().split('-')[0]).find(x=>supported.includes(x))||'en';
 return { language:explicit&&valid?saved:'en', suggestion:!explicit&&!promptSeen?(legacy?saved:browser):null, legacy };
}
