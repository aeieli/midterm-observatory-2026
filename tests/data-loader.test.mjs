import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const root = new URL('../dist/', import.meta.url);
const paths = ['data/seats.json', 'data/evidence.json', 'data/powers.json', 'data/leadership.json', 'data/senate_profiles.json', 'data/house_profiles.json', 'locales/catalog.json', 'locales/en.json', 'locales/fr.json', 'locales/es.json', 'locales/ja.json'];
const files = new Map(await Promise.all(paths.map(async path => [path, JSON.parse(await fs.readFile(new URL(path, root), 'utf8'))])));
const originalFetch = globalThis.fetch;

async function exercise(mode) {
  const calls = [], labels = [], id = 'a'.repeat(64);
  globalThis.document = { querySelector: () => ({ append: node => labels.push(node.textContent) }), createElement: () => ({}) };
  globalThis.fetch = async path => {
    calls.push(path);
    if (path === '/api/current') return Response.json({ snapshotId: id, paths });
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
    assert.ok(files.has(path));
    return Response.json(files.get(path));
  };
  try {
    const loader = await import(`../dist/data-loader.js?case=${mode}`);
    const seats = await loader.loadJSON('data/seats.json');
    await loader.loadJSON('locales/ja.json');
    await assert.rejects(loader.loadJSON('private/config.json'));
    assert.equal(calls.filter(path => path === '/api/current').length, 1);
    if (mode === 'success') {
      assert.equal(seats.asOf, 'API_TEST_VERSION');
      assert.equal(calls.filter(path => paths.includes(path)).length, 0);
      assert.match(labels[0], /D1/);
    } else {
      assert.equal(seats.asOf, files.get('data/seats.json').asOf);
      assert.deepEqual(new Set(calls.filter(path => paths.includes(path))), new Set(paths));
      assert.match(labels[0], /静态/);
    }
  } finally { globalThis.fetch = originalFetch; delete globalThis.document; }
}

test('all data and languages use one pinned snapshot', () => exercise('success'));
test('one failed document switches the entire session to static data', () => exercise('partial-failure'));
test('a mismatched history snapshot also falls back as a unit', () => exercise('mixed-history'));
