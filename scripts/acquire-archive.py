#!/usr/bin/env python3
"""Acquire selected metadata from one pinned publisher archive; original code MIT.

Requires optional pyarrow. No authentication, TikTok endpoints, or media downloads.
Dataset licensing and underlying content rights are separate; see ARCHIVE_DATA.md.
"""
import argparse
import datetime as dt
import hashlib
import io
import json
import math
import pathlib
import re
import sys
import time
import urllib.request

REPO = 'EinzzCookie/tiktok-videos-users-info'
REVISION = '68899264e287bef0fffe389e683fdb1043b2a03f'
SIZE = 3868804371
ARCHIVE_DATE = '2026-09-07T14:42:23.000Z'
SOURCE = f'https://huggingface.co/datasets/{REPO}/tree/{REVISION}'
BASE = f'https://huggingface.co/datasets/{REPO}/resolve/{REVISION}'
URL = BASE + '/tiktok_video_user_data.parquet'
PUBLISHER_FILE_SHA256 = '037b614040cad425da5efde24a1eed8f64f28ec19ad6e62f818d431eba15597f'
COLUMNS = ['aweme_id', 'author_user_id', 'create_time', 'desc', 'aweme_type', 'content_type',
           'author.uid', 'author.unique_id', 'author.signature', 'author.follower_count',
           'author.following_count', 'author.aweme_count', 'author.total_favorited',
           'author.region', 'author.language', 'statistics.play_count', 'statistics.digg_count',
           'statistics.comment_count', 'statistics.share_count', 'video.duration']
NOTICE = ('Publisher declares dataset MIT. Underlying TikTok content rights are not independently '
          'cleared. Retain the publisher card and provenance; follow its terms and applicable rights. '
          'Archive publication is not a platform metric observation date.')


class RangeFile(io.RawIOBase):
    """Seekable HTTP file that refuses full bodies and enforces a byte budget."""
    def __init__(self, url=URL, size=SIZE, max_bytes=128 * 1024**2, opener=None):
        self.url, self.size, self.maximum = url, size, max_bytes
        self.position = self.received = 0
        self.calls = []
        self.opener = opener or urllib.request.urlopen

    def readable(self):
        return True

    def seekable(self):
        return True

    def tell(self):
        return self.position

    def seek(self, offset, whence=io.SEEK_SET):
        if whence not in (io.SEEK_SET, io.SEEK_CUR, io.SEEK_END):
            raise ValueError('Invalid seek origin')
        position = offset + (0 if whence == io.SEEK_SET else self.position if whence == io.SEEK_CUR else self.size)
        if position < 0:
            raise ValueError('Negative seek position')
        self.position = position
        return position

    def read(self, length=-1):
        length = min(max(0, self.size - self.position), length if length >= 0 else self.size)
        if not length:
            return b''
        if self.received + length > self.maximum:
            raise RuntimeError('HTTP Range byte budget exhausted; no full-file fallback')
        start, end = self.position, self.position + length - 1
        request = urllib.request.Request(self.url, headers={
            'Range': f'bytes={start}-{end}', 'Accept-Encoding': 'identity',
            'User-Agent': 'OpenReel-Archive-Acquisition/1.0'})
        with self.opener(request, timeout=60) as response:
            if response.status != 206:
                raise RuntimeError(f'Expected HTTP 206; refused status {response.status} before reading body')
            if response.headers.get('Content-Range') != f'bytes {start}-{end}/{self.size}':
                raise RuntimeError('Unexpected Content-Range; body refused')
            declared = response.headers.get('Content-Length')
            if declared is not None and declared != str(length):
                raise RuntimeError('Unexpected Content-Length; body refused')
            if response.headers.get('Content-Encoding', 'identity') != 'identity':
                raise RuntimeError('Compressed HTTP transfer refused')
            # Read exactly the requested count. Never probe one byte beyond the budget.
            data = response.read(length)
            self.received += len(data)
            if len(data) != length:
                raise RuntimeError('Short HTTP Range body')
        self.position += length
        self.calls.append({'start': start, 'length': length, 'sha256': hashlib.sha256(data).hexdigest()})
        return data

    def readinto(self, buffer):
        data = self.read(len(buffer))
        buffer[:len(data)] = data
        return len(data)


def clip(value, maximum):
    return str(value or '').encode('utf-16-le')[:maximum * 2].decode('utf-16-le', errors='ignore').strip()


def metric(value):
    return value if isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= 9007199254740991 else None


def map_row(row, ordinal, group):
    """Map actual upstream fields; reject missing identities instead of inventing them."""
    author, engagement, video = row.get('author') or {}, row.get('statistics') or {}, row.get('video') or {}
    video_id, username, creator_id = str(row.get('aweme_id') or ''), str(author.get('unique_id') or '').strip(), str(author.get('uid') or '')
    if not re.fullmatch(r'\d{9,24}', video_id):
        raise ValueError('invalidVideoId')
    if username == '_' or not re.fullmatch(r'[A-Za-z0-9_][A-Za-z0-9_.]{0,79}', username):
        raise ValueError('invalidUsername')
    if not re.fullmatch(r'\d+', creator_id) or (row.get('author_user_id') is not None and creator_id != str(row['author_user_id'])):
        raise ValueError('invalidCreatorJoin')
    duration = video.get('duration')
    if row.get('content_type') != 'video' or isinstance(duration, bool) or not isinstance(duration, (int, float)) or not math.isfinite(duration) or duration <= 0:
        raise ValueError('notVideo')
    caption = clip(row.get('desc'), 10000)
    if not caption:
        raise ValueError('noCaption')
    try:
        epoch = row['create_time']
        if isinstance(epoch, bool):
            raise ValueError()
        posted = dt.datetime.fromtimestamp(epoch, dt.timezone.utc)
        if posted.year < 2014 or posted > dt.datetime(2026, 9, 8, tzinfo=dt.timezone.utc):
            raise ValueError()
    except (KeyError, TypeError, ValueError, OverflowError, OSError):
        raise ValueError('invalidPostedAt') from None
    followers = metric(author.get('follower_count'))
    stub = followers == 0 and all(metric(author.get(k)) in (None, 0) for k in ('following_count', 'aweme_count', 'total_favorited'))
    if stub:
        followers = None
    bio = clip(author.get('signature'), 2000)
    match = re.search(r'(?<![\w.+-])([A-Za-z0-9_.+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})(?![\w.-])', bio)
    record = {'id': 'tiktok-' + video_id, 'handle': '@' + username, 'caption': caption,
              'transcript': '', 'hook': '', 'format': '', 'niche': '', 'bio': bio,
              'school': '', 'location': '', 'email': match.group(1).rstrip('.') if match else '',
              'followers': followers,
              **{key: metric(engagement.get(raw)) for key, raw in [('views', 'play_count'), ('likes', 'digg_count'), ('comments', 'comment_count'), ('shares', 'share_count')]},
              'postedAt': posted.isoformat().replace('+00:00', 'Z'),
              'url': f'https://www.tiktok.com/@{username}/video/{video_id}',
              'authorUrl': f'https://www.tiktok.com/@{username}',
              'sourceType': 'huggingface-archival-dataset', 'fetchedAt': ARCHIVE_DATE, 'demo': False}
    provenance = {'id': record['id'], 'videoId': video_id, 'creatorId': creator_id, 'username': username,
                  'sourceRowOrdinal': ordinal, 'sourceRowGroup': group, 'dataset': REPO,
                  'datasetRevision': REVISION, 'datasetArchivePublishedAt': ARCHIVE_DATE,
                  'platformObservationAt': None, 'metricObservationAt': None, 'profileObservationAt': None,
                  'sourceUrl': SOURCE, 'publisherDeclaredDatasetLicense': 'MIT',
                  'underlyingContentRights': NOTICE, 'durationMilliseconds': duration,
                  'creatorRegion': author.get('region'), 'descriptionLanguage': author.get('language'),
                  'profileStatsZeroFilled': stub}
    return record, provenance


def increment(stats, key, amount=1):
    stats[key] = stats.get(key, 0) + amount


def select_rows(rows, group, seen, stats):
    for ordinal, row in rows:
        increment(stats, 'rowsScanned')
        identity = str(row.get('aweme_id') or '')
        if identity in seen:
            increment(stats, 'duplicateVideoId')
            continue
        try:
            record, provenance = map_row(row, ordinal, group)
        except ValueError as error:
            increment(stats, str(error))
            continue
        seen.add(identity)
        increment(stats, 'recordsExported')
        yield record, provenance


def write_export(output, pairs, manifest):
    output.write('{"kind":"real","source":' + json.dumps(SOURCE) + ',"records":[')
    first = True
    for record, provenance in pairs:
        if not first:
            output.write(',\n')
        json.dump({**record, 'archiveProvenance': provenance}, output, ensure_ascii=False, separators=(',', ':'), allow_nan=False)
        first = False
    output.write('],"datasetProvenance":')
    json.dump(manifest, output, ensure_ascii=False, indent=2, allow_nan=False)
    output.write('}\n')


def acquire(destination, max_bytes):
    try:
        import pyarrow.parquet as pq
    except ImportError:
        raise RuntimeError('Install optional dependency: python -m pip install -r scripts/requirements-data.txt') from None
    destination.mkdir(parents=True, exist_ok=False)
    started = time.monotonic()
    # Preserve the publisher's complete card/license declaration, with a bounded read.
    with urllib.request.urlopen(BASE + '/README.md', timeout=60) as response:
        card = response.read(65537)
    if len(card) > 65536:
        raise RuntimeError('Publisher card exceeds metadata limit')
    (destination / 'publisher-README.md').write_bytes(card)
    manifest = {'dataset': REPO, 'revision': REVISION, 'source': SOURCE,
                'archivePublishedAt': ARCHIVE_DATE, 'platformObservationAt': None,
                'publisherDeclaredDatasetLicense': 'MIT', 'underlyingContentRightsCleared': False,
                'notice': NOTICE, 'videoOrAudioDownloaded': False, 'columnsSelected': COLUMNS,
                'upstreamFileSize': SIZE, 'publisherFileSha256': PUBLISHER_FILE_SHA256,
                'wholeFileSha256Verified': False, 'cardSha256': hashlib.sha256(card).hexdigest(),
                'cardBytesReceived': len(card), 'maxRangeBytes': max_bytes,
                'selection': 'First eligible occurrence of each actual video ID in pinned source row order.',
                'counts': {}, 'transcriptCoverage': 0, 'summaryCoverage': 0}
    stats, creators, usernames, dates = manifest['counts'], set(), set(), []
    with RangeFile(max_bytes=max_bytes) as reader:
        parquet = pq.ParquetFile(reader)
        manifest['upstreamParquetRows'] = parquet.metadata.num_rows

        def pairs():
            seen, ordinal = set(), 0
            for group in range(parquet.metadata.num_row_groups):
                table = parquet.read_row_group(group, columns=COLUMNS, use_threads=False)
                for batch in table.to_batches(max_chunksize=1000):
                    rows = batch.to_pylist()
                    for record, provenance in select_rows(enumerate(rows, ordinal), group, seen, stats):
                        creators.add(provenance['creatorId'])
                        usernames.add(provenance['username'].lower())
                        dates.append(record['postedAt'])
                        for key, yes in [('recordsWithBio', bool(record['bio'])), ('recordsWithPublicBioEmail', bool(record['email'])), ('recordsWithKnownFollowers', record['followers'] is not None), ('recordsWithKnownViews', record['views'] is not None), ('zeroFilledProfileStatsUnknown', provenance['profileStatsZeroFilled'])]:
                            increment(stats, key, int(yes))
                        yield record, provenance
                    ordinal += len(rows)
                print(f'Group {group + 1}/{parquet.metadata.num_row_groups}: {stats.get("recordsExported", 0)} distinct videos, {reader.received} Range bytes', file=sys.stderr, flush=True)
                del table
            manifest.update({'rangeBytesReceived': reader.received, 'rangeRequests': len(reader.calls),
                             'rangeReceipts': reader.calls, 'uniqueCreatorIds': len(creators),
                             'uniqueUsernames': len(usernames), 'postedAtMin': min(dates) if dates else None,
                             'postedAtMax': max(dates) if dates else None,
                             'seconds': round(time.monotonic() - started, 3)})

        partial = destination / 'records.partial.json'
        with partial.open('w', encoding='utf-8', newline='\n') as output:
            write_export(output, pairs(), manifest)
        partial.rename(destination / 'records.json')
    manifest['recordsJsonSha256'] = hashlib.sha256((destination / 'records.json').read_bytes()).hexdigest()
    (destination / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({key: value for key, value in manifest.items() if key != 'rangeReceipts'}, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=pathlib.Path, required=True, help='New directory for records.json, publisher card, and manifest')
    parser.add_argument('--max-bytes', type=int, default=128 * 1024**2, help='Parquet Range byte budget (default 128 MiB; maximum 2 GB)')
    args = parser.parse_args()
    if not 1 <= args.max_bytes <= 2_000_000_000:
        parser.error('--max-bytes must be 1..2000000000')
    try:
        acquire(args.output, args.max_bytes)
    except (RuntimeError, OSError, ValueError) as error:
        parser.exit(1, f'Archive acquisition failed: {error}\nPartial output is not a completed acquisition.\n')


if __name__ == '__main__':
    main()
