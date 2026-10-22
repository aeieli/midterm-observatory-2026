import base64
import json
import os
from pathlib import Path
import shutil
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from d1_data import build, verify, activation_sql, CHUNK_BYTES
from cloudflare_config import generate, LOCAL_ID


class SnapshotTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.fixture = Path(self.temp.name)
        for folder in ['data', 'locales']:
            shutil.copytree(ROOT / 'dist' / folder, self.fixture / 'dist' / folder)
        self.db = sqlite3.connect(':memory:')
        self.db.row_factory = sqlite3.Row
        self.db.execute('PRAGMA foreign_keys=ON')
        self.db.executescript((ROOT / 'migrations/0001_snapshots.sql').read_text())
        self.plan = build(self.fixture, '1' * 40)
        self.original_history = json.loads((self.fixture / 'dist/data/evidence.json').read_text())['history']

    def tearDown(self):
        self.db.close()
        self.temp.cleanup()

    def query(self, sql):
        return [dict(row) for row in self.db.execute(sql)]

    def stage(self, plan):
        self.db.executescript('\n'.join(plan['statements']))

    def activate(self, plan):
        verify(plan, self.query)
        self.db.execute('UPDATE snapshots SET verified_at=? WHERE id=?', ('test-verification-time', plan['id']))
        self.db.execute(activation_sql(plan))

    def current(self):
        return self.db.execute('SELECT snapshot_id FROM publication').fetchone()[0]

    def test_idempotent_import_preserves_real_history_and_full_snapshot_count(self):
        self.stage(self.plan)
        self.activate(self.plan)
        counts = [self.db.execute('SELECT count(*) FROM ' + table).fetchone()[0] for table in ['documents', 'document_chunks', 'snapshots', 'history_events']]
        published = self.query('SELECT * FROM publication')
        self.stage(self.plan)
        self.activate(self.plan)
        self.assertEqual(counts, [self.db.execute('SELECT count(*) FROM ' + table).fetchone()[0] for table in ['documents', 'document_chunks', 'snapshots', 'history_events']])
        self.assertEqual(published, self.query('SELECT * FROM publication'))
        self.assertEqual(self.db.execute('SELECT count(*) FROM snapshots').fetchone()[0], 1)
        self.assertEqual([row[0] for row in self.db.execute("SELECT event_date FROM history_events WHERE kind='generic-ballot-snapshot' ORDER BY event_date")], sorted(record['date'] for record in self.original_history))

    def large_plan(self):
        p = self.fixture / 'dist/data/leadership.json'
        doc = json.loads(p.read_text())
        doc['testOnlyText'] = "中🗳️ O'Reilly ; DROP TABLE publication; " * 65000
        p.write_text(json.dumps(doc, ensure_ascii=False))
        self.assertGreater(p.stat().st_size, 2_000_000)
        return build(self.fixture, '2' * 40)

    def test_unicode_quotes_and_document_over_two_megabytes(self):
        plan = self.large_plan()
        self.stage(plan)
        self.activate(plan)
        self.assertTrue(all(len(sql.encode()) < 100_000 for sql in plan['statements']))
        chunks = self.query('SELECT body_base64 FROM document_chunks')
        self.assertTrue(all(len(base64.b64decode(row['body_base64'])) <= CHUNK_BYTES for row in chunks))
        self.assertEqual(self.current(), plan['id'])

    def test_interrupted_import_and_missing_chunk_keep_old_current(self):
        self.stage(self.plan)
        self.activate(self.plan)
        later = self.large_plan()
        self.db.executescript('\n'.join(later['statements'][:len(later['statements']) // 2]))
        with self.assertRaises(ValueError):
            verify(later, self.query)
        self.assertEqual(self.current(), self.plan['id'])
        self.stage(later)
        key = later['manifest']['documents']['data/leadership.json']
        self.db.execute('DELETE FROM document_chunks WHERE document_hash=? AND chunk_index=1', (key,))
        with self.assertRaises(ValueError):
            verify(later, self.query)
        self.db.execute(activation_sql(later))
        self.assertEqual(self.current(), self.plan['id'])
        self.stage(later)
        self.activate(later)
        self.assertEqual(self.current(), later['id'])
        self.db.execute(activation_sql(self.plan))
        self.assertEqual(self.current(), later['id'])

    def test_dropped_input_history_is_not_deleted_and_staged_events_are_not_published(self):
        self.stage(self.plan)
        self.activate(self.plan)
        p = self.fixture / 'dist/data/evidence.json'
        evidence = json.loads(p.read_text())
        evidence['history'] = []
        p.write_text(json.dumps(evidence, ensure_ascii=False))
        later = build(self.fixture, '3' * 40)
        self.stage(later)
        verify(later, self.query)
        self.db.execute('UPDATE snapshots SET verified_at=? WHERE id=?', ('verified-but-not-deployed', later['id']))
        self.assertIsNone(self.db.execute('SELECT published_at FROM snapshots WHERE id=?', (later['id'],)).fetchone()[0])
        self.activate(later)
        self.assertEqual(self.db.execute("SELECT count(*) FROM history_events WHERE kind='generic-ballot-snapshot'").fetchone()[0], len(self.original_history))

    def test_configuration_requires_ids_and_does_not_persist_secrets(self):
        output = self.fixture / 'config.json'
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(ValueError, 'CLOUDFLARE_ACCOUNT_ID'):
                generate(True, output=output)
        fake = {'CLOUDFLARE_ACCOUNT_ID': 'a' * 32, 'CLOUDFLARE_API_TOKEN': 'NONSECRET_TEST_SENTINEL'}
        with patch.dict(os.environ, fake, clear=True):
            with self.assertRaisesRegex(ValueError, 'CLOUDFLARE_D1_DATABASE_ID'):
                generate(True, output=output)
            generate(False, output=output)
            self.assertEqual(json.loads(output.read_text())['d1_databases'][0]['database_id'], LOCAL_ID)
        fake['CLOUDFLARE_D1_DATABASE_ID'] = '12345678-1234-1234-1234-123456789abc'
        with patch.dict(os.environ, fake, clear=True):
            generate(True, output=output)
            text = output.read_text()
            self.assertNotIn(fake['CLOUDFLARE_API_TOKEN'], text)
            self.assertNotIn(fake['CLOUDFLARE_ACCOUNT_ID'], text)


if __name__ == '__main__':
    unittest.main()
