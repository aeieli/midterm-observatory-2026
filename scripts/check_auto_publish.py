"""Fail closed before production credentials are supplied to an automatic data publication."""
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SHA = re.compile(r'[0-9a-f]{40,64}')
DATA_PATH = re.compile(r'dist/(?:data|locales)/[^/]+\.json|dist/static-manifest\.json')


def assert_data_only_range(base, head, root=ROOT):
    if not all(SHA.fullmatch(value or '') and set(value) != {'0'} for value in [base, head]):
        raise ValueError('Automatic publication needs two verified Git commit IDs; use manual publish.')
    ancestor = subprocess.run(['git', 'merge-base', '--is-ancestor', base, head], cwd=root,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if ancestor.returncode:
        raise ValueError('Automatic publication requires intact forward Git history; use manual publish.')
    fields = subprocess.check_output(['git', 'diff', '--name-status', '--no-renames', '-z', base, head, '--'], cwd=root).decode('utf-8').split('\0')
    fields = fields[:-1]
    if not fields or len(fields) % 2:
        raise ValueError('No publishable research changes were found; no automatic deployment is needed.')
    paths = []
    for status, path in zip(fields[::2], fields[1::2]):
        if status not in ['A', 'M'] or not DATA_PATH.fullmatch(path):
            raise ValueError('Automatic publication contains code, workflow, migration, deletion, or another non-data change; use explicit manual publish.')
        paths.append(path)
    entries = subprocess.check_output(['git', 'ls-tree', '-z', head, '--', *paths], cwd=root).decode('utf-8').split('\0')[:-1]
    if len(entries) != len(paths) or any(not entry.startswith('100644 blob ') for entry in entries):
        raise ValueError('Automatic research files must be regular JSON files; links and executable files require manual review.')
    return paths


def assert_auto_push(root=ROOT, environment=None):
    environment = os.environ if environment is None else environment
    if (environment.get('GITHUB_ACTIONS') != 'true' or environment.get('GITHUB_EVENT_NAME') != 'push' or
        environment.get('GITHUB_REF') != 'refs/heads/main' or environment.get('GITHUB_REPOSITORY') != 'aeieli/midterm-observatory-2026'):
        raise ValueError('Automatic publication is restricted to a main push in the project repository.')
    event = json.loads(Path(environment['GITHUB_EVENT_PATH']).read_text(encoding='utf-8'))
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
    if event.get('ref') != 'refs/heads/main' or event.get('after') != head or environment.get('GITHUB_SHA') != head:
        raise ValueError('Push event, checkout, and workflow commit do not match; automatic publication refused.')
    if any(event.get(flag) for flag in ['created', 'deleted', 'forced']):
        raise ValueError('Branch creation, deletion, and force pushes require explicit manual publication.')
    return assert_data_only_range(event.get('before'), head, root)


def assert_automatic_baseline(current, source_commit, root=ROOT):
    if len(current) != 1:
        raise ValueError('Automatic publication needs an existing published database snapshot; run the first publish manually.')
    # Include every net change since the deployed source, not only the triggering push.
    return assert_data_only_range(current[0]['source_commit'], source_commit, root)


if __name__ == '__main__':
    try:
        changed = assert_auto_push()
    except (ValueError, KeyError, OSError, subprocess.CalledProcessError) as exc:
        raise SystemExit(str(exc))
    print(f'Automatic push allowlist passed: {len(changed)} research files. Production credentials were not needed.')
