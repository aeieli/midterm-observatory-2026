"""Explicit Cloudflare operations. Defaults to local; remote writes require protected main CI."""
import argparse
import json
import os
import subprocess
from pathlib import Path
from cloudflare_config import ROOT, generate
from d1_data import build, canonical, verify, literal, activation_sql

VERSION = '4.151.3'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['validate', 'bootstrap', 'migrate', 'stage', 'sync-data', 'publish'])
    parser.add_argument('--remote', action='store_true')
    args = parser.parse_args()
    remote = args.remote
    if remote:
        if os.environ.get('GITHUB_ACTIONS') != 'true' or os.environ.get('GITHUB_REF') != 'refs/heads/main' or os.environ.get('GITHUB_EVENT_NAME') != 'workflow_dispatch':
            raise SystemExit('Remote operations are restricted to manual GitHub Actions runs on main using PROD.')
        if args.operation == 'validate':
            raise SystemExit('Validation is local only; omit --remote.')
    elif args.operation in ['bootstrap', 'publish']:
        raise SystemExit('Bootstrap and publish are remote-only manual CI operations. No operation was performed.')

    config = generate(remote, args.operation == 'bootstrap')
    environment = dict(os.environ, WRANGLER_SEND_METRICS='false', WRANGLER_SEND_ERROR_REPORTS='false',
                       WRANGLER_LOG_SANITIZE='true', WRANGLER_LOG_PATH=str(ROOT / '.wrangler' / 'logs'), CI='true')
    if not remote:
        environment['CLOUDFLARE_CF_FETCH_ENABLED'] = 'false'
        for key in ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_KEY', 'CLOUDFLARE_EMAIL',
                    'CF_API_TOKEN', 'CF_ACCOUNT_ID', 'CF_API_KEY', 'CF_EMAIL',
                    'CLOUDFLARE_ACCESS_CLIENT_ID', 'CLOUDFLARE_ACCESS_CLIENT_SECRET']:
            environment.pop(key, None)

    def wrangler(*command, capture=False):
        command = ['npm', 'exec', '--yes', '--package=wrangler@' + VERSION, '--', 'wrangler', *command, '--config', str(config)]
        result = subprocess.run(command, cwd=ROOT, env=environment, text=True, stdout=subprocess.PIPE if capture else None, check=True)
        return result.stdout if capture else None

    target = '--remote' if remote else '--local'

    def query(sql):
        raw = wrangler('d1', 'execute', 'DB', target, '--command', sql, '--json', capture=True)
        result = json.loads(raw)
        if not isinstance(result, list) or any(item.get('success') is False for item in result):
            raise ValueError('D1 query failed; publication pointer remains unchanged')
        return [row for item in result for row in item.get('results', [])]

    if args.operation == 'validate':
        subprocess.run(['python3', 'scripts/check-locales.py'], cwd=ROOT, check=True)
        for path in sorted((ROOT / 'dist').rglob('*.js')) + [ROOT / 'src' / 'worker.js']:
            subprocess.run(['node', '--check', str(path)], check=True)
        wrangler('deploy', '--dry-run', '--outdir', str(ROOT / '.wrangler' / 'dry-run'))
        return
    if args.operation == 'bootstrap':
        wrangler('d1', 'create', 'midterm-observatory-2026', '--binding', 'DB', '--update-config')
        info = json.loads(wrangler('d1', 'info', 'midterm-observatory-2026', '--json', capture=True))
        database_id = info.get('uuid') or info.get('id')
        if not database_id:
            raise ValueError('Creation finished but the database ID was not returned; inspect D1 before retrying creation.')
        print('Database created. Set PROD variable CLOUDFLARE_D1_DATABASE_ID to:', database_id)
        print('No migration, import, deployment, or DNS change was requested by this operation.')
        return
    if args.operation == 'migrate':
        wrangler('d1', 'migrations', 'apply', 'DB', target)
        return

    plan = build()
    output = ROOT / '.wrangler' / 'import'
    output.mkdir(parents=True, exist_ok=True)
    sql_file = output / 'stage.sql'
    sql_file.write_text('\n'.join(plan['statements']) + '\n')
    (output / 'manifest.json').write_text(canonical({'id': plan['id'], **plan['manifest']}) + '\n')
    print('Staging immutable public documents; existing current snapshot is unchanged.', flush=True)
    wrangler('d1', 'execute', 'DB', target, '--file', str(sql_file), capture=True)
    print(f"Staged {len(plan['statements'])} bounded, idempotent INSERT statements.", flush=True)
    print('Reading back all document bytes, hashes, and original event references.', flush=True)
    verify(plan, query)
    query("UPDATE snapshots SET verified_at=COALESCE(verified_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id=" + literal(plan['id']))
    if args.operation == 'stage':
        print('Staged and verified. Current snapshot was not changed.')
        return
    if args.operation == 'publish':
        # D1 and Worker deployments are NOT one transaction. Preserve old current until deploy succeeds.
        wrangler('deploy')
    query(activation_sql(plan))
    current = query('SELECT snapshot_id FROM publication WHERE singleton=1')
    if current != [{'snapshot_id': plan['id']}]:
        raise ValueError('Activation was not confirmed (a newer snapshot may already exist); no destructive rollback was attempted')
    print('Current snapshot verified:', plan['id'])
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a') as f:
            f.write(f"Published data snapshot `{plan['id']}` from commit `{plan['manifest']['sourceCommit']}`.\n")


if __name__ == '__main__':
    try:
        main()
    except (ValueError, subprocess.CalledProcessError) as exc:
        raise SystemExit(str(exc))
