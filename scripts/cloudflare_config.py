"""Generate local or production Wrangler JSON without persisting authentication secrets."""
import argparse
import json
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCAL_ID = '00000000-0000-0000-0000-000000000000'


def generate(remote=False, bootstrap=False, output=None):
    config = json.loads((ROOT / 'wrangler.jsonc').read_text())
    if remote:
        if not re.fullmatch(r'[0-9a-fA-F]{32}', os.environ.get('CLOUDFLARE_ACCOUNT_ID', '')):
            raise ValueError('Missing or invalid PROD secret CLOUDFLARE_ACCOUNT_ID (expected a 32-character account ID; value is never printed).')
        if not os.environ.get('CLOUDFLARE_API_TOKEN'):
            raise ValueError('Missing PROD secret CF_DEPLOY mapped to CLOUDFLARE_API_TOKEN.')
    database_id = os.environ.get('CLOUDFLARE_D1_DATABASE_ID', '') if remote else LOCAL_ID
    if remote and not bootstrap and (not re.fullmatch(r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}', database_id) or database_id.lower() == LOCAL_ID):
        raise ValueError('Missing or invalid PROD variable CLOUDFLARE_D1_DATABASE_ID. Explicitly create/select the intended database first; no database will be created automatically.')
    config['main'] = str(ROOT / 'src' / 'worker.js')
    config['assets']['directory'] = str(ROOT / 'dist')
    if bootstrap:
        config.pop('d1_databases', None)
    else:
        config['d1_databases'][0]['database_id'] = database_id
        config['d1_databases'][0]['migrations_dir'] = str(ROOT / 'migrations')
    output = Path(output or ROOT / '.wrangler' / 'generated.json')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(config, ensure_ascii=False, indent=2) + '\n')
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--remote', action='store_true')
    parser.add_argument('--bootstrap', action='store_true')
    args = parser.parse_args()
    try:
        generate(args.remote, args.bootstrap)
        print('Wrangler configuration generated. No network calls or resources created.')
    except ValueError as exc:
        raise SystemExit(str(exc))
