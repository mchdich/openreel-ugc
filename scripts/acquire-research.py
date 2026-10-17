#!/usr/bin/env python3
"""Prepare an optional CC-BY-NC-4.0 TikTok research archive. Original code: MIT.

No media downloads. Use verified local metadata, or explicitly --download missing
pinned metadata. The data license remains separate from this program's license.
"""
import argparse
import datetime as dt
import hashlib
import json
import math
import pathlib
import re
import sys
import time
import urllib.request

REPO = 'lingbow/tiktok-video-engagement-200k'
REVISION = 'ef0da889e05dea58754bc0ce2d0e2ed6b697fdf2'
PUBLISHED = '2026-09-05T22:23:34.000Z'
LICENSE = 'CC-BY-NC-4.0'
LICENSE_URL = 'https://creativecommons.org/licenses/by-nc/4.0/'
SOURCE = f'https://huggingface.co/datasets/{REPO}/tree/{REVISION}'
BASE = f'https://huggingface.co/datasets/{REPO}/resolve/{REVISION}'
CARD_SHA256 = '4da4ec399f99031ea27fbe56d79eb85a479f6b6adc36c3e1de9642cc80044b5a'
FILES = {
    'videos.parquet': {'bytes': 106922687, 'sha256': '368a9c92a700fa9968bbfc40d8fda3c5a2921d24f17fb88e673e48d9bbb5a853'},
    'engagement_daily.parquet': {'bytes': 26288243, 'sha256': '746e98af1c06ebf041251b34505b13f54bb18374a4fb61a0f39fc15731697f82'},
    'creator_daily.parquet': {'bytes': 2322214, 'sha256': 'e41423dd49770a67c692c0b3ef6c0b7770c8e1206a423a5d2776a3552686d4d9'},
}
CITATION = {'title': 'When Does Trend-Following Pay Off? Evidence from Trending Content and Hashtag Use',
            'authors': ['Wensi Zhang', 'Ying Xie', 'Lingbo Wang'], 'year': 2026,
            'url': 'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7371418'}
ATTRIBUTION = (f'TikTok Creator and Video Engagement (200K), {REPO}, revision {REVISION}.\n'
               f'Data: {LICENSE}, {LICENSE_URL}\nSource: {SOURCE}\n'
               f'Citation: {CITATION["title"]}; Wensi Zhang, Ying Xie, Lingbo Wang (2026). {CITATION["url"]}\n'
               'Changes: selected first eligible unique video IDs; joined latest known archival engagement and creator snapshots; '
               'normalized metadata fields and created a search/import export. Upstream summaries remain model-derived.\n'
               'No endorsement or warranties. No video/audio media included. Preserve publisher notices and license. '
               'MIT program code does not relicense the data. Noncommercial use only under the dataset license.\n')


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open('rb') as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def verify_file(path, expected):
    if path.stat().st_size != expected['bytes'] or sha256_file(path) != expected['sha256']:
        raise RuntimeError(f'Size/SHA-256 mismatch for {path.name}; refusing to replace or silently redownload it')
    return {'file': path.name, 'bytes': expected['bytes'], 'sha256': expected['sha256'], 'url': BASE + '/' + path.name}


def download_file(path, expected):
    partial = path.with_suffix(path.suffix + '.partial')
    total, digest = 0, hashlib.sha256()
    with urllib.request.urlopen(BASE + '/' + path.name, timeout=60) as response, partial.open('wb') as output:
        if response.status != 200:
            raise RuntimeError(f'Unexpected metadata HTTP status {response.status}')
        declared = response.headers.get('Content-Length')
        if declared is not None and int(declared) > expected['bytes']:
            raise RuntimeError('Metadata response exceeds pinned size')
        while True:
            chunk = response.read(min(1024 * 1024, expected['bytes'] - total + 1))
            if not chunk:
                break
            total += len(chunk)
            if total > expected['bytes']:
                raise RuntimeError('Metadata body exceeds pinned size')
            digest.update(chunk)
            output.write(chunk)
    if total != expected['bytes'] or digest.hexdigest() != expected['sha256']:
        raise RuntimeError(f'Downloaded metadata SHA-256 mismatch: {path.name}')
    partial.rename(path)
    return dt.datetime.now(dt.timezone.utc).isoformat().replace('+00:00', 'Z')


def date_only(value):
    if value is None:
        return None
    value = value.isoformat() if isinstance(value, dt.date) else str(value)
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
        raise ValueError('invalidObservationDate')
    return dt.date.fromisoformat(value).isoformat()


def identity(value):
    result = str(value) if value is not None else ''
    if not re.fullmatch(r'\d{1,30}', result):
        raise ValueError('invalidIdentity')
    return result


def metric(value):
    return value if isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= 9007199254740991 else None


def text(value, maximum):
    value = '' if value is None else str(value).strip()
    if len(value.encode('utf-16-le')) // 2 > maximum:
        raise ValueError('textExceedsImportLimit')
    return value


def map_video(video, engagement, creator, ordinal, retrieved_at):
    vid, cid = identity(video.get('video_id')), identity(video.get('author_id'))
    if len(vid) < 9:
        raise ValueError('invalidVideoIdentity')
    raw_time = video.get('create_time')
    posted = raw_time.isoformat() if isinstance(raw_time, dt.datetime) else str(raw_time or '')
    try:
        parsed = dt.datetime.fromisoformat(posted)
        if parsed.year < 2014:
            raise ValueError()
    except ValueError:
        raise ValueError('invalidPostingDate') from None
    duration = video.get('duration')
    if isinstance(duration, bool) or not isinstance(duration, (int, float)) or not math.isfinite(duration) or duration <= 0:
        raise ValueError('invalidDuration')
    caption, transcript, description = text(video.get('desc'), 10000), text(video.get('transcript'), 50000), text(video.get('gpt_summary'), 50000)
    if not (caption or transcript or description):
        raise ValueError('noText')
    return {'id': 'tiktok-' + vid, 'handle': '', 'creatorId': cid,
            'url': f'https://www.tiktok.com/player/v1/{vid}', 'authorUrl': '',
            'caption': caption, 'transcript': transcript, 'visualDescription': description,
            'descriptionSource': 'upstream-model', 'hook': '', 'format': '', 'niche': '',
            'bio': '', 'school': '', 'location': '', 'email': '', 'postedAt': posted,
            'sourceType': 'lingbow-archival-dataset', 'fetchedAt': retrieved_at, 'demo': False,
            'followers': metric(creator.get('follower_count')),
            **{name: metric(engagement.get(raw)) for name, raw in [('views', 'play_count'), ('likes', 'like_count'), ('comments', 'comment_count'), ('shares', 'share_count')]},
            'archiveProvenance': {'dataset': REPO, 'revision': REVISION, 'license': LICENSE,
                                  'sourceUrl': SOURCE, 'archivePublishedAt': PUBLISHED,
                                  'videoId': vid, 'creatorId': cid, 'sourceRowOrdinal': ordinal,
                                  'postedAtRaw': str(raw_time), 'postedAtTimezone': None if parsed.tzinfo is None else str(parsed.tzinfo),
                                  'engagementObservedOn': date_only(engagement.get('date')),
                                  'creatorObservedOn': date_only(creator.get('date')),
                                  'transcriptSource': 'upstream-asr' if transcript else 'unavailable'}}


def latest_snapshots(rows, key, counts=None, label=None):
    latest = {}
    for row in rows:
        if counts is not None:
            counts[label] = counts.get(label, 0) + 1
        item, observed = identity(row[key]), date_only(row['date'])
        if observed is None:
            continue
        if item not in latest or observed > date_only(latest[item]['date']):
            latest[item] = row
    return latest


def export_records(rows, engagement, creators, destination, limit, retrieved_at, manifest):
    destination.mkdir(parents=True, exist_ok=False)
    started, seen, creator_ids, sample, digest = time.monotonic(), set(), set(), [], hashlib.sha256()
    counts, dates, metric_dates, profile_dates = {}, [], [], []
    total_bytes = 0
    partial = destination / 'records.partial.jsonl'
    with partial.open('wb') as output:
        for ordinal, video in enumerate(rows):
            counts['sourceVideosScanned'] = counts.get('sourceVideosScanned', 0) + 1
            vid = str(video.get('video_id') or '')
            if vid in seen:
                counts['duplicateVideoIds'] = counts.get('duplicateVideoIds', 0) + 1
                continue
            try:
                record = map_video(video, engagement.get(vid, {}), creators.get(str(video.get('author_id')), {}), ordinal, retrieved_at)
            except ValueError as error:
                counts[str(error)] = counts.get(str(error), 0) + 1
                continue
            encoded = (json.dumps(record, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n').encode('utf-8')
            total_bytes += len(encoded)
            if total_bytes > 2_000_000_000:
                raise RuntimeError('Prepared metadata exceeds 2 GB output budget')
            output.write(encoded)
            digest.update(encoded)
            seen.add(vid)
            creator_ids.add(record['creatorId'])
            dates.append(record['postedAt'])
            for key, value in [('indexedVideos', True), ('withCaption', bool(record['caption'])), ('withTranscript', bool(record['transcript'])), ('withVisualDescription', bool(record['visualDescription'])), ('withKnownViews', record['views'] is not None), ('withKnownFollowers', record['followers'] is not None)]:
                counts[key] = counts.get(key, 0) + int(value)
            evidence = record['archiveProvenance']
            if evidence['engagementObservedOn']:
                metric_dates.append(evidence['engagementObservedOn'])
            if evidence['creatorObservedOn']:
                profile_dates.append(evidence['creatorObservedOn'])
            if len(sample) < 20:
                sample.append(record)
            if len(seen) % 10000 == 0:
                print(f'Prepared {len(seen)} unique videos; {total_bytes} bytes', file=sys.stderr, flush=True)
            if len(seen) >= limit:
                break
    if not seen:
        raise RuntimeError('No eligible real archive records; export is incomplete')
    partial.rename(destination / 'records.jsonl')
    manifest = {**manifest, 'dataset': REPO, 'revision': REVISION, 'source': SOURCE,
                'dataLicense': LICENSE, 'licenseUrl': LICENSE_URL, 'citation': CITATION,
                'archivePublishedAt': PUBLISHED, 'metadataRetrievedAt': retrieved_at,
                'changesAndAttribution': ATTRIBUTION, 'selection': 'First eligible distinct video IDs in pinned Parquet row order; not representative.',
                'requestedLimit': limit, 'counts': counts, 'uniqueCreatorIds': len(creator_ids), 'knownUsernames': 0,
                'recordsJsonlBytes': total_bytes, 'recordsJsonlSha256': digest.hexdigest(),
                'postedAtMin': min(dates), 'postedAtMax': max(dates),
                'engagementObservedOnMin': min(metric_dates) if metric_dates else None,
                'engagementObservedOnMax': max(metric_dates) if metric_dates else None,
                'creatorObservedOnMin': min(profile_dates) if profile_dates else None,
                'creatorObservedOnMax': max(profile_dates) if profile_dates else None,
                'exportSeconds': round(time.monotonic() - started, 3), 'videoOrAudioDownloaded': False,
                'notes': 'No usernames/bios/contacts/schools/locations inferred. Upstream ASR and model summaries are not fresh observations. Raw naive posting timestamps retain unknown timezone.'}
    (destination / 'sample.json').write_text(json.dumps({'kind': 'real', 'source': SOURCE, 'records': sample}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (destination / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (destination / 'ATTRIBUTION.txt').write_text(ATTRIBUTION, encoding='utf-8')
    return manifest


def parquet_rows(path, columns, batch_size=32768):
    import pyarrow.parquet as pq
    parquet = pq.ParquetFile(path)
    for batch in parquet.iter_batches(batch_size=batch_size, columns=columns, use_threads=False):
        yield from batch.to_pylist()


def acquire(args):
    try:
        import pyarrow.parquet as pq
    except ImportError:
        raise RuntimeError('Install optional dependency from scripts/requirements-data.txt') from None
    args.source_dir.mkdir(parents=True, exist_ok=True)
    receipts, downloaded, retrieved_at = [], 0, args.retrieved_at
    for name, expected in FILES.items():
        path = args.source_dir / name
        if not path.exists():
            if not args.download:
                raise RuntimeError(f'Missing {name}; provide cached metadata or explicitly --download')
            retrieved_at = download_file(path, expected)
            downloaded += expected['bytes']
        receipts.append(verify_file(path, expected))
    if not retrieved_at:
        raise RuntimeError('Cached metadata requires --retrieved-at with its actual original retrieval time; no platform observation date is inferred')
    parsed = dt.datetime.fromisoformat(retrieved_at.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('--retrieved-at must include its timezone')
    cards = [args.source_dir / 'publisher-README.md']
    if args.attribution_dir:
        cards += [args.attribution_dir / 'lingbow--tiktok-video-engagement-200k-README.md', args.attribution_dir / 'publisher-README.md']
    card = next((path.read_bytes() for path in cards if path.is_file()), None)
    if card is None and args.download:
        with urllib.request.urlopen(BASE + '/README.md', timeout=60) as response:
            card = response.read(65537)
        if len(card) > 65536:
            raise RuntimeError('Publisher card exceeds 64 KiB metadata budget')
        downloaded += len(card)
        (args.source_dir / 'publisher-README.md').write_bytes(card)
    if card is None or hashlib.sha256(card).hexdigest() != CARD_SHA256:
        raise RuntimeError('Provide the pinned publisher card (--attribution-dir or explicit --download); SHA-256 must match')
    manifest = {'rawMetadataFiles': receipts, 'rawMetadataDirectory': str(args.source_dir.resolve()),
                'rawMetadataBytes': sum(item['bytes'] for item in receipts), 'networkBytesThisRun': downloaded,
                'publisherCardSha256': CARD_SHA256, 'upstreamParquetVideoRows': pq.ParquetFile(args.source_dir / 'videos.parquet').metadata.num_rows,
                'rawSourceFilesRetained': True, 'snapshotRowsScanned': {}}
    started = time.monotonic()
    snapshots = manifest['snapshotRowsScanned']
    engagement = latest_snapshots(parquet_rows(args.source_dir / 'engagement_daily.parquet', ['video_id', 'date', 'play_count', 'like_count', 'comment_count', 'share_count']), 'video_id', snapshots, 'engagement')
    creators = latest_snapshots(parquet_rows(args.source_dir / 'creator_daily.parquet', ['author_id', 'date', 'follower_count']), 'author_id', snapshots, 'creator')
    manifest['snapshotPreparationSeconds'] = round(time.monotonic() - started, 3)
    rows = parquet_rows(args.source_dir / 'videos.parquet', ['video_id', 'author_id', 'create_time', 'duration', 'desc', 'transcript', 'gpt_summary'], batch_size=1000)
    result = export_records(rows, engagement, creators, args.output, args.limit, retrieved_at, manifest)
    (args.output / 'publisher-README.md').write_bytes(card)
    print(json.dumps(result, ensure_ascii=False, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=pathlib.Path, required=True, help='Directory containing three original pinned metadata Parquets')
    parser.add_argument('--output', type=pathlib.Path, required=True, help='New export directory; never your application database')
    parser.add_argument('--attribution-dir', type=pathlib.Path, help='Directory containing the original pinned publisher card')
    parser.add_argument('--retrieved-at', help='Actual original metadata retrieval ISO timestamp with timezone, required for cached inputs')
    parser.add_argument('--download', action='store_true', help='Explicitly download missing pinned metadata/card only, at most 136 MB; never redownload mismatched cache')
    parser.add_argument('--limit', type=int, default=150000, help='Maximum distinct real videos (default 150000)')
    args = parser.parse_args()
    if not 1 <= args.limit <= 209543:
        parser.error('--limit must be 1..209543')
    if args.output.exists():
        parser.error('--output must be a new directory')
    try:
        acquire(args)
    except (OSError, RuntimeError, ValueError) as error:
        parser.exit(1, f'Research preparation failed: {error}\nPartial exports are not complete and must not be imported.\n')


if __name__ == '__main__':
    main()
