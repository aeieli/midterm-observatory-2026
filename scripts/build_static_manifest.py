"""Pin the complete static fallback file set. Regenerate with --write before committing data changes."""
import argparse
import json
from pathlib import Path
from d1_data import ROOT, DATA_PATHS, canonical, digest


def manifest(root=ROOT):
    files = {}
    for path in sorted(DATA_PATHS):
        raw = (Path(root) / 'dist' / path).read_bytes()
        files[path] = {'bytes': len(raw), 'sha256': digest(raw)}
    return {'schemaVersion': 1, 'manifestId': digest(canonical(files).encode('utf-8')), 'files': files}


def check(root=ROOT):
    path = Path(root) / 'dist' / 'static-manifest.json'
    if not path.exists() or json.loads(path.read_text(encoding='utf-8')) != manifest(root):
        raise ValueError('Static release manifest is missing or stale. Run python3 scripts/build_static_manifest.py --write and commit it with the data and translations.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    if args.write:
        (ROOT / 'dist' / 'static-manifest.json').write_text(json.dumps(manifest(), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    try:
        check()
    except (ValueError, OSError) as exc:
        raise SystemExit(str(exc))
    print('Static release manifest verified: 11 files.')
