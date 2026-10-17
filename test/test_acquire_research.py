"""Research export tests use explicitly synthetic fixtures, never bundled NC data."""
import datetime as dt
import importlib.util
import json
import io
import hashlib
from unittest.mock import patch
import pathlib
import tempfile
import unittest

PATH = pathlib.Path(__file__).resolve().parents[1] / 'scripts' / 'acquire-research.py'
spec = importlib.util.spec_from_file_location('acquire_research', PATH)
research = importlib.util.module_from_spec(spec)
spec.loader.exec_module(research)
FETCHED = '2026-10-17T21:06:24.583Z'


def video(**changes):
    row = {'video_id': '7387143945744141599', 'author_id': '6958316329012003846',
           'create_time': dt.datetime(2024, 7, 2, 15, 51, 42), 'duration': 26.6,
           'desc': 'Synthetic fixture caption', 'transcript': 'Fixture words\nNext line\u2028still the same text',
           'gpt_summary': 'Synthetic upstream description fixture', 'topic': 'Lifestyle'}
    row.update(changes)
    return row


class MappingTests(unittest.TestCase):
    def test_actual_numeric_identity_and_upstream_sources_are_separate(self):
        r = research.map_video(video(), {'date': '2024-07-31', 'play_count': 0, 'like_count': 3},
                               {'date': '2024-12-09', 'follower_count': 0}, 42, FETCHED)
        self.assertEqual(r['handle'], '')
        self.assertEqual(r['creatorId'], '6958316329012003846')
        self.assertEqual(r['url'], 'https://www.tiktok.com/player/v1/7387143945744141599')
        self.assertEqual(r['authorUrl'], '')
        self.assertEqual(r['visualDescription'], 'Synthetic upstream description fixture')
        self.assertEqual(r['descriptionSource'], 'upstream-model')
        self.assertEqual(r['transcript'], video()['transcript'])
        self.assertEqual(r['fetchedAt'], FETCHED)
        self.assertEqual((r['followers'], r['views']), (0, 0))
        self.assertIsNone(r['shares'])
        p = r['archiveProvenance']
        self.assertEqual(p['sourceRowOrdinal'], 42)
        self.assertEqual(p['engagementObservedOn'], '2024-07-31')
        self.assertEqual(p['creatorObservedOn'], '2024-12-09')
        self.assertIsNone(p['postedAtTimezone'])
        self.assertEqual(p['license'], 'CC-BY-NC-4.0')
        self.assertEqual(p['transcriptSource'], 'upstream-asr')
        self.assertEqual(r['bio'], '')
        self.assertEqual(r['school'], '')
        self.assertEqual(r['email'], '')

    def test_invalid_identity_date_metric_and_missing_evidence(self):
        for changes in [{'video_id': 'invalid'}, {'author_id': None}, {'author_id': 1.1},
                        {'create_time': 'not a date'}, {'duration': float('inf')}]:
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                research.map_video(video(**changes), {}, {}, 0, FETCHED)
        r = research.map_video(video(transcript=None), {'date': '2024-07-31', 'play_count': 2**53,
                              'like_count': -1}, {}, 0, FETCHED)
        self.assertIsNone(r['views'])
        self.assertIsNone(r['likes'])
        self.assertIsNone(r['followers'])
        self.assertIsNone(r['archiveProvenance']['creatorObservedOn'])
        self.assertEqual(r['archiveProvenance']['transcriptSource'], 'unavailable')

    def test_latest_observation_is_deterministic_and_keeps_original_date(self):
        records = [{'video_id': '1', 'date': '2024-07-03', 'play_count': 5},
                   {'video_id': '1', 'date': '2024-07-01', 'play_count': 2},
                   {'video_id': '1', 'date': '2024-07-03', 'play_count': 99}]
        latest = research.latest_snapshots(iter(records), 'video_id')
        self.assertEqual(latest['1']['play_count'], 5)
        self.assertEqual(latest['1']['date'], '2024-07-03')

    def test_export_is_deterministic_deduplicated_and_jsonl_preserves_unicode(self):
        rows = [video(), video(desc='later duplicate'), video(video_id='7387143945744141598')]
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            results = []
            for name in ['first', 'second']:
                result = research.export_records(iter(rows), {}, {}, root / name, 150000, FETCHED,
                                                 {'sourceFixture': True})
                results.append((root / name / 'records.jsonl').read_bytes())
                self.assertEqual(result['counts']['indexedVideos'], 2)
                self.assertEqual(result['counts']['duplicateVideoIds'], 1)
            self.assertEqual(results[0], results[1])
            parsed = [json.loads(line) for line in results[0].decode().split('\n') if line]
            self.assertEqual(parsed[0]['transcript'], video()['transcript'])
            self.assertEqual(len(json.loads((root / 'first' / 'sample.json').read_text())['records']), 2)

    def test_limit_counts_distinct_videos_not_raw_duplicates(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory) / 'export'
            result = research.export_records(iter([video(), video(), video(video_id='7387143945744141598')]),
                                             {}, {}, root, 2, FETCHED, {})
            self.assertEqual(result['counts']['indexedVideos'], 2)
            self.assertEqual(result['counts']['sourceVideosScanned'], 3)

    def test_cached_file_hash_mismatch_is_rejected_without_download(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / 'fixture.parquet'
            path.write_bytes(b'bad bytes')
            with self.assertRaisesRegex(RuntimeError, 'SHA-256'):
                research.verify_file(path, {'bytes': 9, 'sha256': '0' * 64})


class DownloadTests(unittest.TestCase):
    def test_only_verified_bounded_metadata_download_is_promoted(self):
        class Response(io.BytesIO):
            status = 200
            headers = {}
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / 'fixture.parquet'
            expected = {'bytes': 5, 'sha256': hashlib.sha256(b'bytes').hexdigest()}
            with patch.object(research.urllib.request, 'urlopen', return_value=Response(b'bytes')):
                stamp = research.download_file(path, expected)
            self.assertEqual(path.read_bytes(), b'bytes')
            self.assertIsNotNone(dt.datetime.fromisoformat(stamp.replace('Z', '+00:00')).tzinfo)
            path.unlink()
            for body in [b'bytesX', b'wrong']:
                with self.subTest(body=body), patch.object(research.urllib.request, 'urlopen', return_value=Response(body)), self.assertRaises(RuntimeError):
                    research.download_file(path, expected)
                self.assertFalse(path.exists())


if __name__ == '__main__':
    unittest.main()
