import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from build_static_manifest import manifest, check, DATA_PATHS


class StaticManifestTests(unittest.TestCase):
    def test_update_requires_regeneration_and_preserves_raw_unicode_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for relative in DATA_PATHS:
                path = root / 'dist' / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text('{"example":"中文 / 日本語 / café"}\n', encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'missing or stale'):
                check(root)
            release = manifest(root)
            target = root / 'dist/static-manifest.json'
            target.write_text(json.dumps(release))
            check(root)
            changed = root / 'dist/locales/fr.json'
            changed.write_bytes(changed.read_bytes().replace(b'example', b'Example'))
            self.assertEqual(manifest(root)['files']['locales/fr.json']['bytes'], release['files']['locales/fr.json']['bytes'])
            with self.assertRaisesRegex(ValueError, 'missing or stale'):
                check(root)
            target.write_text(json.dumps(manifest(root)))
            check(root)


if __name__ == '__main__':
    unittest.main()
