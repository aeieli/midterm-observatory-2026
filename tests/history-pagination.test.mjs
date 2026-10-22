import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import worker from '../src/worker.js';

test('compound cursors visit every same-day event once across pages and preserve filter scope', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0001_snapshots.sql', import.meta.url), 'utf8'));
  const oldId = 'a'.repeat(64), currentId = 'b'.repeat(64);
  for (const [id, source] of [[oldId, 'a'], [currentId, 'b']]) sqlite.prepare('INSERT INTO snapshots(id,source_commit,manifest_json,verified_at,published_at) VALUES (?,?,?,?,?)').run(id, source.repeat(40), '{}', 'verified', 'published');
  const expected = [];
  for (let index = 0; index < 237; index++) {
    const eventDate = index === 236 ? '2026-10-21' : '2026-10-22';
    const raw = Buffer.from(JSON.stringify({ recordType: 'fixture', dateType: 'observation_date', eventDate, record: { index } }));
    const id = createHash('sha256').update(raw).digest('hex');
    sqlite.prepare('INSERT INTO documents VALUES (?,?,?)').run(id, raw.length, 1);
    sqlite.prepare('INSERT INTO document_chunks VALUES (?,?,?)').run(id, 0, raw.toString('base64'));
    sqlite.prepare('INSERT INTO history_events VALUES (?,?,?,?,?,?)').run(id, 'entity-' + index, 'fixture', eventDate, 'observation_date', 'https://example.test');
    sqlite.prepare('INSERT INTO snapshot_events VALUES (?,?)').run(index < 119 ? oldId : currentId, id);
    expected.push({ id, date: eventDate, sequence: index < 119 ? 1 : 2 });
  }
  expected.sort((a, b) => b.date.localeCompare(a.date) || b.sequence - a.sequence || a.id.localeCompare(b.id));
  const DB = { prepare(sql) {
    const statement = sqlite.prepare(sql);
    const bound = params => ({ bind: (...values) => bound(values), first: async () => statement.get(...params) ?? null, all: async () => ({ results: statement.all(...params) }) });
    return bound([]);
  } };
  const received = [];
  let cursor = null, firstCursor, pages = 0;
  do {
    const url = new URL('https://local.test/api/history');
    url.searchParams.set('snapshot', currentId);
    url.searchParams.set('kind', 'fixture');
    url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('cursor', cursor);
    const response = await worker.fetch(new Request(url), { DB });
    assert.equal(response.status, 200);
    const body = await response.json();
    received.push(...body.events.map(event => event.id));
    cursor = body.nextCursor;
    firstCursor ??= cursor;
    assert.ok(++pages < 10);
  } while (cursor);
  assert.equal(pages, 3);
  assert.deepEqual(received, expected.map(event => event.id));
  assert.equal(new Set(received).size, 237);
  for (const query of [
    `snapshot=${oldId}&kind=fixture&cursor=${firstCursor}`,
    `snapshot=${currentId}&kind=different&cursor=${firstCursor}`,
    `snapshot=${currentId}&kind=fixture&cursor=invalid`,
  ]) assert.equal((await worker.fetch(new Request('https://local.test/api/history?' + query), { DB })).status, 400);
  sqlite.close();
});
