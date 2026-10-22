"""Validate complete static translation files before publishing. No network use."""
import json,re,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'dist'/'locales'
catalog=json.loads((root/'catalog.json').read_text());ids={x['id'] for x in catalog}
errors=[]
for lang in ['en','fr','es','ja']:
 file=root/(lang+'.json')
 if not file.exists():errors.append(f'{lang}: file missing');continue
 data=json.loads(file.read_text());missing=[key for key in ids if not isinstance(data.get(key),str) or not data[key].strip()]
 if missing:errors.append(f'{lang}: {len(missing)} missing translations')
 if lang!='ja':
  residual=[key for key,value in data.items() if re.search('[\u3400-\u9fff]',value)]
  if residual:errors.append(f'{lang}: Chinese characters in {residual[:8]}')
 print(f'{lang}: {len(ids)-len(missing)}/{len(ids)} catalog entries')
if errors:print('\n'.join(errors),file=sys.stderr);sys.exit(1)
print('Locale key coverage passed. Semantic and browser checks remain required.')
