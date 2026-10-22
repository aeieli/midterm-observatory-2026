import importlib.util
import os
import sqlite3
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
spec = importlib.util.spec_from_file_location('cloudflare_ci', ROOT / 'scripts/cloudflare-ci.py')
ci = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ci)


class PublishGuardTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.row_factory = sqlite3.Row
        self.db.executescript((ROOT / 'migrations/0001_snapshots.sql').read_text())
        self.deploy = Mock()

    def tearDown(self):
        self.db.close()

    def query(self, sql):
        return [dict(row) for row in self.db.execute(sql)]

    def candidate(self, digit, source=None):
        plan = {'id': digit * 64, 'manifest': {'sourceCommit': (source or digit) * 40}}
        self.db.execute('INSERT INTO snapshots(id,source_commit,manifest_json,verified_at) VALUES (?,?,?,?)',
                        (plan['id'], plan['manifest']['sourceCommit'], '{}', 'verified'))
        return plan

    def test_a_then_b_then_rerun_a_never_calls_deploy_again(self):
        a, b = self.candidate('a'), self.candidate('b')
        with patch.object(ci, 'assert_current_main'), patch.object(ci, 'source_is_ancestor', return_value=True):
            ci.publish_verified_snapshot(a, self.query, self.deploy, remote=True)
            ci.publish_verified_snapshot(b, self.query, self.deploy, remote=True)
            self.assertEqual(self.deploy.call_count, 2)
            with self.assertRaisesRegex(ValueError, 'older than current'):
                ci.publish_verified_snapshot(a, self.query, self.deploy, remote=True)
        self.assertEqual(self.deploy.call_count, 2)
        self.assertEqual(self.query('SELECT snapshot_id FROM publication'), [{'snapshot_id': b['id']}])

    def test_new_sequence_does_not_allow_older_source_code(self):
        b = self.candidate('b')
        with patch.object(ci, 'assert_current_main'):
            ci.publish_verified_snapshot(b, self.query, self.deploy, remote=True)
            stale_source = self.candidate('c', source='a')
            with patch.object(ci, 'source_is_ancestor', return_value=False):
                with self.assertRaisesRegex(ValueError, 'Candidate source'):
                    ci.publish_verified_snapshot(stale_source, self.query, self.deploy, remote=True)
        self.assertEqual(self.deploy.call_count, 1)

    def test_old_main_workflow_sha_is_rejected_before_deploy(self):
        a = self.candidate('a')
        with patch.dict(os.environ, {'GITHUB_SHA': 'a' * 40}), patch.object(ci.subprocess, 'check_output', side_effect=['a' * 40 + '\n', 'b' * 40 + '\trefs/heads/main\n']):
            with self.assertRaisesRegex(ValueError, 'no longer remote main'):
                ci.publish_verified_snapshot(a, self.query, self.deploy, remote=True)
        self.deploy.assert_not_called()
        self.assertEqual(self.query('SELECT * FROM publication'), [])

    def test_matching_main_passes_and_deploy_failure_keeps_old_current(self):
        a, b = self.candidate('a'), self.candidate('b')
        with patch.object(ci, 'assert_current_main'), patch.object(ci, 'source_is_ancestor', return_value=True):
            ci.publish_verified_snapshot(a, self.query, self.deploy, remote=True)
            with self.assertRaisesRegex(RuntimeError, 'deployment failed'):
                ci.publish_verified_snapshot(b, self.query, Mock(side_effect=RuntimeError('deployment failed')), remote=True)
        self.assertEqual(self.query('SELECT snapshot_id FROM publication'), [{'snapshot_id': a['id']}])
        with patch.dict(os.environ, {'GITHUB_SHA': 'b' * 40}), patch.object(ci.subprocess, 'check_output', side_effect=['b' * 40 + '\n', 'b' * 40 + '\trefs/heads/main\n']):
            ci.assert_current_main('b' * 40)


if __name__ == '__main__':
    unittest.main()
