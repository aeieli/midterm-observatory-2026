"""Deterministic, append-only D1 input generation and integrity verification."""
import argparse
import base64
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHUNK_BYTES = 32 * 1024
DATA_PATHS = ['data/' + name + '.json' for name in
              ['seats', 'evidence', 'powers', 'leadership', 'senate_profiles', 'house_profiles']]
DATA_PATHS += ['locales/' + name + '.json' for name in ['catalog', 'en', 'fr', 'es', 'ja']]


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def digest(data):
    return hashlib.sha256(data).hexdigest()


def literal(value):
    if value is None:
        return 'NULL'
    if isinstance(value, int):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def insert(table, columns, values):
    statement = f"INSERT OR IGNORE INTO {table} ({','.join(columns)}) VALUES ({','.join(map(literal, values))});"
    if len(statement.encode()) >= 100_000:
        raise ValueError('Generated SQL exceeds the D1 single-statement size limit')
    return statement


def build(root=ROOT, source_commit=None):
    root = Path(root)
    source_commit = source_commit or subprocess.check_output(
        ['git', '-C', str(root), 'rev-parse', 'HEAD'], text=True).strip()
    if not re.fullmatch(r'[0-9a-f]{40,64}', source_commit):
        raise ValueError('Use the actual reviewed Git commit as source provenance')
    documents, refs, dates = {}, {}, {}

    def document(raw):
        if len(raw) > 16 * 1024 * 1024:
            raise ValueError('Split documents larger than the bounded 16 MiB read API limit')
        key = digest(raw)
        documents[key] = raw
        return key

    for path in DATA_PATHS:
        raw = (root / 'dist' / path).read_bytes()
        parsed = json.loads(raw)
        refs[path] = document(raw)
        dates[path] = {key: parsed.get(key) for key in ['asOf', 'verifiedAt'] if parsed.get(key)} if isinstance(parsed, dict) else {}

    evidence = json.loads(documents[refs['data/evidence.json']])
    events = []
    for collection, date_type in [('history', 'observation_date'), ('ratingChanges', 'publisher_event_date'),
                                  ('polls', 'publication_date'), ('news', 'publication_date')]:
        for record in evidence.get(collection, []):
            event_date = record.get('publishedAt') if collection == 'polls' else record.get('date')
            # Never infer publication or observation dates from import time or fieldwork dates.
            if not event_date:
                continue
            if not re.match(r'^\d{4}-\d{2}-\d{2}(?:T.*)?$', event_date):
                raise ValueError('Invalid original evidence date')
            event_date = event_date[:10]
            kind = record.get('kind', collection)
            source = record.get('source', '')
            entity = canonical({key: record.get(key) for key in
                                ['id', 'chamber', 'state', 'district', 'provider', 'source', 'kind']})
            payload = {'recordType': kind, 'dateType': date_type, 'eventDate': event_date,
                       'entityKey': digest(entity.encode()), 'record': record}
            event_raw = canonical(payload).encode()
            if len(event_raw) > 64 * 1024:
                raise ValueError('A historical event exceeds the bounded history API record size')
            event_id = document(event_raw)
            events.append({'id': event_id, 'entity': payload['entityKey'], 'kind': kind,
                           'date': event_date, 'date_type': date_type, 'source': source})

    manifest = {'schemaVersion': 1, 'sourceCommit': source_commit, 'documents': refs,
                'evidenceTimes': dates, 'historyEventIds': sorted({event['id'] for event in events}),
                'coverage': {'fullSnapshot': 'Only the actual imported file set; not reconstructed for past dates.',
                             'historicalObservations': 'Original evidence dates and provenance notes are preserved. Historical observations are not complete chamber snapshots.'}}
    snapshot_id = digest(canonical(manifest).encode())
    statements = []
    for key, raw in sorted(documents.items()):
        chunks = [raw[i:i + CHUNK_BYTES] for i in range(0, len(raw), CHUNK_BYTES)] or [b'']
        statements.append(insert('documents', ['hash', 'byte_length', 'chunk_count'], [key, len(raw), len(chunks)]))
        for index, chunk in enumerate(chunks):
            statements.append(insert('document_chunks', ['document_hash', 'chunk_index', 'body_base64'],
                                     [key, index, base64.b64encode(chunk).decode('ascii')]))
    statements.append(insert('snapshots', ['id', 'source_commit', 'manifest_json'],
                             [snapshot_id, source_commit, canonical(manifest)]))
    for path, key in sorted(refs.items()):
        statements.append(insert('snapshot_documents', ['snapshot_id', 'path', 'document_hash'], [snapshot_id, path, key]))
    for event in events:
        statements.append(insert('history_events', ['id', 'entity_key', 'kind', 'event_date', 'date_type', 'source'],
                                 [event['id'], event['entity'], event['kind'], event['date'], event['date_type'], event['source']]))
        statements.append(insert('snapshot_events', ['snapshot_id', 'event_id'], [snapshot_id, event['id']]))
    return {'id': snapshot_id, 'manifest': manifest, 'documents': documents,
            'events': events, 'statements': statements}


def verify(plan, query):
    """Read back every byte before permitting activation. query returns dictionaries."""
    snapshot = query('SELECT manifest_json FROM snapshots WHERE id=' + literal(plan['id']))
    if len(snapshot) != 1 or snapshot[0]['manifest_json'] != canonical(plan['manifest']):
        raise ValueError('Snapshot manifest missing or inconsistent; current publication is unchanged')
    refs = query('SELECT path, document_hash FROM snapshot_documents WHERE snapshot_id=' + literal(plan['id']))
    if {row['path']: row['document_hash'] for row in refs} != plan['manifest']['documents']:
        raise ValueError('Snapshot references are incomplete')
    for key, expected in plan['documents'].items():
        rows = query('SELECT d.byte_length,d.chunk_count,c.chunk_index,c.body_base64 FROM documents d LEFT JOIN document_chunks c ON c.document_hash=d.hash WHERE d.hash=' + literal(key) + ' ORDER BY c.chunk_index')
        if not rows or len(rows) != rows[0]['chunk_count'] or [row['chunk_index'] for row in rows] != list(range(len(rows))):
            raise ValueError('Missing or out-of-order document chunks')
        raw = b''.join(base64.b64decode(row['body_base64'], validate=True) for row in rows)
        if len(raw) != rows[0]['byte_length'] or digest(raw) != key or raw != expected:
            raise ValueError('Document integrity verification failed')
    event_rows = query('SELECT e.* FROM history_events e JOIN snapshot_events s ON s.event_id=e.id WHERE s.snapshot_id=' + literal(plan['id']))
    if sorted(row['id'] for row in event_rows) != plan['manifest']['historyEventIds']:
        raise ValueError('Historical event references are incomplete')
    for event in plan['events']:
        expected = dict(zip(['id', 'entity_key', 'kind', 'event_date', 'date_type', 'source'],
                            [event['id'], event['entity'], event['kind'], event['date'], event['date_type'], event['source']]))
        if expected not in event_rows:
            raise ValueError('Historical event index does not match its immutable document')


def activation_sql(plan):
    # One SQL statement atomically switches the pointer, only for a verified snapshot.
    return ("INSERT INTO publication(singleton,snapshot_id,activated_at) SELECT 1,id,strftime('%Y-%m-%dT%H:%M:%fZ','now') "
            'FROM snapshots WHERE id=' + literal(plan['id']) + ' AND verified_at IS NOT NULL '
            'AND sequence >= COALESCE((SELECT s.sequence FROM publication p JOIN snapshots s ON s.id=p.snapshot_id WHERE p.singleton=1),0) '
            "ON CONFLICT(singleton) DO UPDATE SET snapshot_id=excluded.snapshot_id,activated_at=excluded.activated_at WHERE publication.snapshot_id<>excluded.snapshot_id;")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', default='.wrangler/import')
    parser.add_argument('--source-commit')
    args = parser.parse_args()
    plan = build(source_commit=args.source_commit)
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    (output / 'stage.sql').write_text('\n'.join(plan['statements']) + '\n', encoding='utf-8')
    (output / 'manifest.json').write_text(canonical({'id': plan['id'], **plan['manifest']}) + '\n', encoding='utf-8')
    print(f"Prepared snapshot {plan['id']}: {len(plan['manifest']['documents'])} versioned files; {len(plan['events'])} original historical records. No database modified.")
