"""Offline mapping and transfer-bound tests; fixtures are explicitly synthetic."""
import importlib.util
import io
import json
import pathlib
import tempfile
import unittest
from unittest.mock import patch
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import threading

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / 'scripts' / 'acquire-archive.py'
spec = importlib.util.spec_from_file_location('acquire_archive', SCRIPT)
archive = importlib.util.module_from_spec(spec)
spec.loader.exec_module(archive)


def fixture(**changes):
    row = {
        'aweme_id': '1234567890123456789', 'author_user_id': 123456789,
        'create_time': 1788480000, 'desc': 'Fixture caption 🐈', 'content_type': 'video',
        'author': {'uid': 123456789, 'unique_id': 'actual.fixture',
                   'signature': 'Fixture public bio contact@example.org',
                   'follower_count': 0, 'following_count': 0,
                   'aweme_count': 0, 'total_favorited': 0, 'region': 'US'},
        'statistics': {'play_count': 0, 'digg_count': 3, 'share_count': None},
        'video': {'duration': 1300},
    }
    row.update(changes)
    return row


class MappingTests(unittest.TestCase):
    def test_actual_ids_profiles_and_unknown_snapshot_survive_mapping(self):
        record, provenance = archive.map_row(fixture(), 3, 1)
        self.assertEqual(record['id'], 'tiktok-1234567890123456789')
        self.assertEqual(record['handle'], '@actual.fixture')
        self.assertEqual(record['url'], 'https://www.tiktok.com/@actual.fixture/video/1234567890123456789')
        self.assertEqual(record['authorUrl'], 'https://www.tiktok.com/@actual.fixture')
        self.assertEqual(record['email'], 'contact@example.org')
        self.assertEqual(record['views'], 0)
        self.assertIsNone(record['followers'])
        self.assertIsNone(record['shares'])
        self.assertEqual(record['transcript'], '')
        self.assertEqual(record['school'], '')
        self.assertEqual(record['location'], '')
        self.assertEqual(provenance['creatorId'], '123456789')
        self.assertEqual(provenance['username'], 'actual.fixture')
        self.assertIsNone(provenance['platformObservationAt'])
        self.assertEqual(provenance['sourceRowOrdinal'], 3)
        self.assertEqual(provenance['sourceRowGroup'], 1)
        self.assertEqual(record['fetchedAt'], archive.ARCHIVE_DATE)

    def test_zero_followers_are_known_only_with_nonstub_profile(self):
        row = fixture()
        row['author']['aweme_count'] = 5
        record, _ = archive.map_row(row, 0, 0)
        self.assertEqual(record['followers'], 0)
        row['statistics']['play_count'] = 2**53
        row['statistics']['digg_count'] = -1
        record, _ = archive.map_row(row, 0, 0)
        self.assertIsNone(record['views'])
        self.assertIsNone(record['likes'])

    def test_missing_or_mismatched_real_identity_is_rejected(self):
        for changed in [{'author_user_id': 999}, {'aweme_id': 'made-up'},
                        {'content_type': 'multi_photo'}, {'desc': ''},
                        {'video': {'duration': float('nan')}}, {'create_time': float('inf')}]:
            with self.subTest(changed=changed), self.assertRaises(ValueError):
                archive.map_row(fixture(**changed), 0, 0)
        for username in ['', '@invented', 'a/b', '_']:
            row = fixture()
            row['author']['unique_id'] = username
            with self.subTest(username=username), self.assertRaises(ValueError):
                archive.map_row(row, 0, 0)

    def test_text_limits_use_utf16_without_broken_surrogates(self):
        row = fixture(desc='🐈' * 6000)
        record, _ = archive.map_row(row, 0, 0)
        self.assertEqual(len(record['caption'].encode('utf-16-le')) // 2, 10000)
        self.assertTrue(record['caption'].endswith('🐈'))

    def test_first_eligible_real_id_wins_and_rejected_row_cannot_poison_dedup(self):
        rows = [fixture(desc=''), fixture(desc='first'), fixture(desc='later')]
        stats = {}
        output = list(archive.select_rows(iter(enumerate(rows)), 0, set(), stats))
        self.assertEqual(len(output), 1)
        self.assertEqual(output[0][0]['caption'], 'first')
        self.assertEqual(output[0][1]['sourceRowOrdinal'], 1)
        self.assertEqual(stats['duplicateVideoId'], 1)
        self.assertEqual(stats['noCaption'], 1)

    def test_output_json_is_consumable_by_node_cli_and_keeps_creator_provenance(self):
        record, provenance = archive.map_row(fixture(), 0, 0)
        output = io.StringIO()
        archive.write_export(output, [(record, provenance)], {'testFixture': True})
        result = json.loads(output.getvalue())
        self.assertEqual(result['kind'], 'real')
        self.assertEqual(result['records'][0]['archiveProvenance']['creatorId'], '123456789')
        self.assertTrue(result['datasetProvenance']['testFixture'])


class Response(io.BytesIO):
    def __init__(self, data, status, headers):
        super().__init__(data)
        self.status = status
        self.headers = headers
        self.read_called = False

    def read(self, *args):
        self.read_called = True
        return super().read(*args)


class RangeTests(unittest.TestCase):
    def reader(self, response, **kwargs):
        return archive.RangeFile('https://example.org/pinned.parquet', 10,
                                 opener=lambda *args, **kwargs: response, **kwargs)

    def test_exact_206_range_seek_eof_and_receipt(self):
        response = Response(b'234', 206, {'Content-Range': 'bytes 2-4/10'})
        reader = self.reader(response)
        reader.seek(2)
        self.assertEqual(reader.read(3), b'234')
        self.assertEqual(reader.tell(), 5)
        self.assertEqual(reader.received, 3)
        self.assertEqual(reader.calls[0]['start'], 2)
        self.assertEqual(reader.calls[0]['length'], 3)
        self.assertEqual(len(reader.calls[0]['sha256']), 64)
        reader.seek(0, io.SEEK_END)
        self.assertEqual(reader.read(), b'')

    def test_refuses_full_file_200_before_consuming_body(self):
        response = Response(b'0123456789', 200, {})
        with self.assertRaisesRegex(RuntimeError, '206'):
            self.reader(response).read(2)
        self.assertFalse(response.read_called)

    def test_rejects_wrong_ranges_and_short_bodies(self):
        for response in [Response(b'01', 206, {'Content-Range': 'bytes 0-1/10', 'Content-Length': '1000000'}),
                         Response(b'01', 206, {'Content-Range': 'bytes 1-2/10'}),
                         Response(b'0', 206, {'Content-Range': 'bytes 0-1/10'})]:
            with self.subTest(), self.assertRaises(RuntimeError):
                self.reader(response).read(2)

    def test_budget_stops_before_request(self):
        called = []
        reader = archive.RangeFile('https://example.org/pinned.parquet', 10, max_bytes=2,
                                   opener=lambda *args, **kwargs: called.append(1))
        with self.assertRaisesRegex(RuntimeError, 'budget'):
            reader.read(3)
        self.assertEqual(called, [])


class LocalParquetTests(unittest.TestCase):
    def test_actual_parquet_reader_exports_through_local_http_ranges(self):
        try:
            import pyarrow as pa
            import pyarrow.parquet as pq
        except ImportError:
            self.skipTest('Optional pyarrow dependency is not installed')
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            source = root / 'source.parquet'
            pq.write_table(pa.Table.from_pylist([fixture(desc='first'), fixture(desc='duplicate')]), source)
            payload = source.read_bytes()
            requested = []

            class Handler(BaseHTTPRequestHandler):
                def do_GET(self):
                    if self.path.endswith('/README.md'):
                        body, status, headers = b'Fixture publisher card. license: mit', 200, {}
                    else:
                        value = self.headers['Range']
                        requested.append(value)
                        start, end = map(int, value.removeprefix('bytes=').split('-'))
                        body, status = payload[start:end + 1], 206
                        headers = {'Content-Range': f'bytes {start}-{end}/{len(payload)}'}
                    self.send_response(status)
                    self.send_header('Content-Length', str(len(body)))
                    for key, value in headers.items():
                        self.send_header(key, value)
                    self.end_headers()
                    self.wfile.write(body)

                def log_message(self, *args):
                    pass

            server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            base = f'http://127.0.0.1:{server.server_port}'
            original = archive.RangeFile
            try:
                with patch.object(archive, 'BASE', base), patch.object(archive, 'SIZE', len(payload)), \
                        patch.object(archive, 'RangeFile', lambda **kwargs: original(base + '/fixture.parquet', len(payload), **kwargs)), \
                        patch('sys.stdout', io.StringIO()), patch('sys.stderr', io.StringIO()):
                    archive.acquire(root / 'output', 2 * 1024**2)
            finally:
                server.shutdown()
                server.server_close()
                thread.join()
            exported = json.loads((root / 'output' / 'records.json').read_text())
            receipt = json.loads((root / 'output' / 'manifest.json').read_text())
            self.assertEqual(len(exported['records']), 1)
            self.assertEqual(exported['records'][0]['caption'], 'first')
            self.assertEqual(receipt['counts']['duplicateVideoId'], 1)
            self.assertTrue(requested)
            self.assertEqual(receipt['rangeRequests'], len(requested))
            self.assertFalse((root / 'output' / 'records.partial.json').exists())


if __name__ == '__main__':
    unittest.main()
