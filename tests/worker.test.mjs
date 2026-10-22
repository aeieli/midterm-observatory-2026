import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import worker, { assembleDocument } from '../src/worker.js';

test('byte chunks reconstruct Unicode and documents larger than a D1 row', async () => {
  const raw = Buffer.from("中🗳️ O'Reilly ".repeat(170000));
  assert.ok(raw.length > 2_000_000);
  const rows = [];
  for (let i = 0; i < raw.length; i += 32768) rows.push({ chunk_index: rows.length, body_base64: raw.subarray(i, i + 32768).toString('base64') });
  const hash = createHash('sha256').update(raw).digest('hex');
  assert.deepEqual(Buffer.from(await assembleDocument(rows, hash, raw.length, rows.length)), raw);
  await assert.rejects(assembleDocument(rows.slice(1), hash, raw.length, rows.length));
  await assert.rejects(assembleDocument([...rows].reverse(), hash, raw.length, rows.length));
  await assert.rejects(assembleDocument(rows, '0'.repeat(64), raw.length, rows.length));
});

test('API rejects writes, unknown paths, arbitrary SQL, and missing snapshot IDs', async () => {
  let calls = 0;
  const env = { DB: { prepare() { calls++; throw Error('PRIVATE_INTERNAL_DETAILS'); } } };
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    const response = await worker.fetch(new Request('https://local.test/api/current', { method }), env);
    assert.equal(response.status, 405);
  }
  for (const path of ['/api/sql?query=DROP%20TABLE%20documents', '/api/documents/secrets.json']) {
    assert.equal((await worker.fetch(new Request('https://local.test' + path), env)).status, 404);
  }
  assert.equal((await worker.fetch(new Request('https://local.test/api/seats'), env)).status, 400);
  assert.equal(calls, 0);
  const response = await worker.fetch(new Request('https://local.test/api/current'), env);
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes('PRIVATE_INTERNAL_DETAILS'));
});

test('HEAD is bodyless and static assets pass through unchanged', async () => {
  const response = await worker.fetch(new Request('https://local.test/api/current', { method: 'HEAD' }), {});
  assert.equal(response.status, 503);
  assert.equal(await response.text(), '');
  const asset = new Response('unchanged asset');
  assert.equal(await worker.fetch(new Request('https://local.test/app.js'), { ASSETS: { fetch: () => asset } }), asset);
});
