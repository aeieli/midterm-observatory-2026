import json
import subprocess
import unittest
from unittest.mock import Mock, patch
from test_publish_guards import ci

ID = '12345678-1234-1234-1234-123456789abc'
PROJECT = json.dumps([{'name': ci.DATABASE_NAME, 'uuid': ID}])


class BootstrapTests(unittest.TestCase):
    def test_repeated_bootstrap_reuses_existing_database(self):
        wrangler = Mock(return_value=PROJECT)
        self.assertEqual(ci.bootstrap_database(wrangler), (ID, 'reused'))
        self.assertEqual(ci.bootstrap_database(wrangler, ID), (ID, 'reused'))
        self.assertTrue(all(call.args == ('d1', 'list', '--json') for call in wrangler.call_args_list))

    def test_create_once_and_read_back_uuid(self):
        wrangler = Mock(side_effect=['[]', 'creation output is not parsed or logged', PROJECT])
        with patch.object(ci, 'assert_current_main') as guard:
            self.assertEqual(ci.bootstrap_database(wrangler), (ID, 'created'))
        guard.assert_called_once()
        self.assertEqual(sum(call.args[1] == 'create' for call in wrangler.call_args_list), 1)

    def test_configured_id_mismatch_never_creates_or_replaces(self):
        for listing in ['[]', PROJECT]:
            wrangler = Mock(return_value=listing)
            with self.assertRaisesRegex(ValueError, 'Configured'):
                ci.bootstrap_database(wrangler, '98765432-1234-1234-1234-123456789abc')
            wrangler.assert_called_once_with('d1', 'list', '--json', capture=True)

    def test_uncertain_creation_reads_back_without_retry(self):
        wrangler = Mock(side_effect=['[]', subprocess.CalledProcessError(1, ['wrangler', 'd1', 'create']), PROJECT])
        with patch.object(ci, 'assert_current_main'):
            self.assertEqual(ci.bootstrap_database(wrangler), (ID, 'confirmed-after-uncertain-create'))
        self.assertEqual(sum(call.args[1] == 'create' for call in wrangler.call_args_list), 1)

    def test_failed_creation_without_database_stops(self):
        wrangler = Mock(side_effect=['[]', subprocess.CalledProcessError(1, ['wrangler', 'd1', 'create']), '[]'])
        with patch.object(ci, 'assert_current_main'):
            with self.assertRaisesRegex(ValueError, 'No creation retry'):
                ci.bootstrap_database(wrangler)
        self.assertEqual(sum(call.args[1] == 'create' for call in wrangler.call_args_list), 1)
