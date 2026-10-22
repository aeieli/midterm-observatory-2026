import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
from test_publish_guards import ci
from check_auto_publish import assert_auto_push, assert_data_only_range, assert_automatic_baseline


class AutoPublishTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / 'repo'
        self.root.mkdir()
        self.git_env = dict(os.environ, GIT_AUTHOR_NAME='Fixture', GIT_AUTHOR_EMAIL='fixture@example.test',
                            GIT_COMMITTER_NAME='Fixture', GIT_COMMITTER_EMAIL='fixture@example.test')
        self.git('init', '-b', 'main')
        for path in ['dist/data/evidence.json', 'dist/locales/en.json', 'dist/static-manifest.json', 'src/worker.js']:
            file = self.root / path
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text('{}\n')
        self.base = self.commit()

    def tearDown(self):
        self.temp.cleanup()

    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.root, env=self.git_env, stderr=subprocess.PIPE, text=True).strip()

    def commit(self):
        self.git('add', '.')
        self.git('commit', '-m', 'Fixture change')
        return self.git('rev-parse', 'HEAD')

    def change(self, path, text):
        (self.root / path).write_text(text)

    def event_environment(self, before, after, **overrides):
        event = {'ref': 'refs/heads/main', 'before': before, 'after': after, 'created': False, 'deleted': False, 'forced': False, **overrides}
        path = Path(self.temp.name) / 'event.json'
        path.write_text(json.dumps(event))
        return {'GITHUB_ACTIONS': 'true', 'GITHUB_EVENT_NAME': 'push', 'GITHUB_REF': 'refs/heads/main',
                'GITHUB_REPOSITORY': 'aeieli/midterm-observatory-2026', 'GITHUB_SHA': after, 'GITHUB_EVENT_PATH': str(path)}

    def test_data_push_and_published_baseline_pass(self):
        self.change('dist/data/evidence.json', '{"verified":"public evidence"}\n')
        head = self.commit()
        self.assertEqual(assert_auto_push(self.root, self.event_environment(self.base, head)), ['dist/data/evidence.json'])
        self.assertEqual(assert_automatic_baseline([{'source_commit': self.base}], head, self.root), ['dist/data/evidence.json'])

    def test_code_mixed_into_push_is_rejected(self):
        self.change('dist/data/evidence.json', '{"updated":true}')
        self.change('src/worker.js', 'changed code')
        head = self.commit()
        with self.assertRaisesRegex(ValueError, 'non-data change'):
            assert_auto_push(self.root, self.event_environment(self.base, head))

    def test_pending_code_cannot_be_carried_by_later_data_only_push(self):
        self.change('src/worker.js', 'unpublished code')
        code_head = self.commit()
        self.change('dist/data/evidence.json', '{"updated":true}')
        head = self.commit()
        self.assertEqual(assert_auto_push(self.root, self.event_environment(code_head, head)), ['dist/data/evidence.json'])
        with self.assertRaisesRegex(ValueError, 'non-data change'):
            assert_automatic_baseline([{'source_commit': self.base}], head, self.root)

    def test_symlink_and_deletion_are_rejected(self):
        target = self.root / 'dist/locales/en.json'
        target.unlink()
        target.symlink_to('../../src/worker.js')
        head = self.commit()
        with self.assertRaises(ValueError):
            assert_data_only_range(self.base, head, self.root)
        target.unlink()
        removed = self.commit()
        with self.assertRaises(ValueError):
            assert_data_only_range(head, removed, self.root)

    def test_force_push_wrong_sha_and_missing_baseline_are_rejected(self):
        self.change('dist/data/evidence.json', '{"updated":true}')
        head = self.commit()
        with self.assertRaisesRegex(ValueError, 'force pushes'):
            assert_auto_push(self.root, self.event_environment(self.base, head, forced=True))
        environment = self.event_environment(self.base, head)
        environment['GITHUB_SHA'] = self.base
        with self.assertRaisesRegex(ValueError, 'do not match'):
            assert_auto_push(self.root, environment)
        with self.assertRaisesRegex(ValueError, 'first publish manually'):
            assert_automatic_baseline([], head, self.root)

    def test_push_cannot_choose_bootstrap_migrate_or_sync(self):
        with patch.dict(os.environ, {'GITHUB_ACTIONS': 'true', 'GITHUB_REF': 'refs/heads/main', 'GITHUB_EVENT_NAME': 'push'}):
            for operation in ['bootstrap', 'migrate', 'sync-data', 'stage', 'validate']:
                with self.assertRaisesRegex(ValueError, 'may only publish'):
                    ci.assert_remote_operation(operation)

    def test_automatic_baseline_guard_runs_before_deploy(self):
        plan = {'id': 'b' * 64, 'manifest': {'sourceCommit': 'b' * 40}}
        query = Mock(side_effect=[[{'id': plan['id'], 'sequence': 2, 'source_commit': 'b' * 40, 'verified_at': 'verified'}],
                                 [{'id': 'a' * 64, 'sequence': 1, 'source_commit': 'a' * 40}]])
        deploy = Mock()
        with patch.dict(os.environ, {'GITHUB_EVENT_NAME': 'push'}), patch.object(ci, 'assert_current_main'), \
             patch.object(ci, 'assert_automatic_baseline', side_effect=ValueError('pending code requires manual publish')):
            with self.assertRaisesRegex(ValueError, 'pending code'):
                ci.publish_verified_snapshot(plan, query, deploy, remote=True)
        deploy.assert_not_called()
        self.assertEqual(query.call_count, 2)  # Only reads; no activation SQL.
