import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../dist/', import.meta.url);
const paths = ['data/seats.json', 'data/evidence.json', 'data/powers.json', 'data/leadership.json', 'data/senate_profiles.json', 'data/house_profiles.json', 'locales/catalog.json', 'locales/en.json', 'locales/fr.json', 'locales/es.json', 'locales/ja.json'];
const rawFiles = new Map(await Promise.all(paths.map(async path => [path, await fs.readFile(new URL(path, root))])));
const files = new Map([...rawFiles].map(([path, raw]) => [path, JSON.parse(raw)]));
const release = JSON.parse(await fs.readFile(new URL('static-manifest.json', root)));
const originalFetch = globalThis.fetch;

async function exercise(mode) {
  const calls = [], labels = [], id = 'a'.repeat(64);
  globalThis.document = { querySelector: () => ({ append: node => labels.push(node) }), createElement: () => ({}) };
  globalThis.fetch = async path => {
    calls.push(path);
    if (path === '/api/current') return mode.startsWith('static-') ? new Response('not found', { status: 404 }) : Response.json({ snapshotId: id, paths });
    if (path.startsWith('/api/history')) {
      return Response.json({ snapshotId: mode === 'mixed-history' ? 'b'.repeat(64) : id,
        events: files.get('data/evidence.json').history.map(record => ({ entityKey: 'one-source', eventDate: record.date, record })) });
    }
    if (path.startsWith('/api/documents/')) {
      const [name, query] = path.slice('/api/documents/'.length).split('?');
      assert.equal(query, `snapshot=${id}`);
      if (mode === 'partial-failure' && name === 'locales/fr.json') return new Response('unavailable', { status: 503 });
      const data = structuredClone(files.get(name));
      if (name === 'data/seats.json') data.asOf = 'API_TEST_VERSION';
      return Response.json(data);
    }
    if (path === 'static-manifest.json') {
      const manifest = structuredClone(release);
      if (mode === 'static-bad-manifest') manifest.files['data/seats.json'].sha256 = '0'.repeat(64);
      if (mode === 'static-missing-manifest') return new Response('not found', { status: 404 });
      return Response.json(manifest);
    }
    assert.ok(rawFiles.has(path));
    let raw = rawFiles.get(path);
    // Keep valid JSON, complete locale keys, and the SAME byte length. Only the hash detects this deployment mix.
    if (mode === 'static-mixed-version' && path === 'locales/fr.json') {
      const original = raw.toString('utf8');
      raw = Buffer.from(original.replace('données', 'Données'));
      assert.notDeepEqual(raw, rawFiles.get(path));
      assert.equal(raw.length, rawFiles.get(path).length);
    }
    return new Response(raw);
  };
  try {
    const loader = await import(`../dist/data-loader.js?case=${mode}`);
    if (['static-mixed-version', 'static-bad-manifest', 'static-missing-manifest'].includes(mode)) {
      await assert.rejects(loader.loadJSON('data/seats.json'));
      await assert.rejects(loader.loadJSON('locales/ja.json'));
      assert.equal(labels.length, 1);
      assert.match(labels[0].textContent, /Data verification failed/);
      assert.equal(labels[0].role, 'alert');
      assert.equal(calls.filter(path => path === 'static-manifest.json').length, 1);
      return;
    }
    const seats = await loader.loadJSON('data/seats.json');
    await loader.loadJSON('locales/ja.json');
    await assert.rejects(loader.loadJSON('private/config.json'));
    assert.equal(calls.filter(path => path === '/api/current').length, 1);
    if (mode === 'success') {
      assert.equal(seats.asOf, 'API_TEST_VERSION');
      assert.equal(calls.filter(path => paths.includes(path)).length, 0);
      assert.equal(calls.filter(path => path === 'static-manifest.json').length, 0);
      assert.match(labels[0].textContent, /D1/);
    } else {
      assert.equal(seats.asOf, files.get('data/seats.json').asOf);
      assert.deepEqual(new Set(calls.filter(path => paths.includes(path))), new Set(paths));
      assert.match(labels[0].textContent, /静态/);
      assert.equal(calls.filter(path => path === 'static-manifest.json').length, 1);
      assert.ok(calls.indexOf('static-manifest.json') < calls.findIndex(path => paths.includes(path)));
    }
  } finally { globalThis.fetch = originalFetch; delete globalThis.document; }
}

test('all data and languages use one pinned snapshot', () => exercise('success'));
test('one failed document switches the entire session to static data', () => exercise('partial-failure'));
test('a mismatched history snapshot also falls back as a unit', () => exercise('mixed-history'));
test('pure static hosting works with a complete hash-verified release', () => exercise('static-success'));
test('a same-length changed locale rejects the whole static release and displays an error', () => exercise('static-mixed-version'));
test('a modified manifest is rejected before loading data', () => exercise('static-bad-manifest'));
test('a missing manifest fails clearly without accepting unversioned data', () => exercise('static-missing-manifest'));
test('committed static manifest hashes exactly match all fallback files', () => {
  const expected = {};
  for (const path of [...paths].sort()) expected[path] = { bytes: rawFiles.get(path).length, sha256: createHash('sha256').update(rawFiles.get(path)).digest('hex') };
  assert.deepEqual(release.files, expected);
  assert.equal(release.manifestId, createHash('sha256').update(JSON.stringify(expected)).digest('hex'));
});
