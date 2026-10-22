const PATHS = new Set([
  'data/seats.json', 'data/evidence.json', 'data/powers.json', 'data/leadership.json',
  'data/senate_profiles.json', 'data/house_profiles.json', 'locales/catalog.json',
  'locales/en.json', 'locales/fr.json', 'locales/es.json', 'locales/ja.json',
]);
const MAX_DOCUMENT_BYTES = 16 * 1024 * 1024;
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});

export async function assembleDocument(rows, expectedHash, length, count) {
  if (!Number.isInteger(length) || length < 0 || length > MAX_DOCUMENT_BYTES || rows.length !== count) throw Error('Invalid document size');
  const output = new Uint8Array(length);
  let offset = 0;
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (row.chunk_index !== index) throw Error('Invalid chunk sequence');
    const decoded = atob(row.body_base64);
    if (decoded.length > 32768 || offset + decoded.length > length) throw Error('Invalid chunk length');
    for (let j = 0; j < decoded.length; j++) output[offset++] = decoded.charCodeAt(j);
  }
  if (offset !== length) throw Error('Incomplete document');
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', output)), b => b.toString(16).padStart(2, '0')).join('');
  if (hash !== expectedHash) throw Error('Document hash mismatch');
  return output;
}

async function snapshot(db, id) {
  return db.prepare('SELECT * FROM snapshots WHERE id = ? AND verified_at IS NOT NULL AND published_at IS NOT NULL').bind(id).first();
}

async function document(db, revision, path) {
  const metadata = await db.prepare('SELECT d.* FROM snapshot_documents s JOIN documents d ON d.hash = s.document_hash WHERE s.snapshot_id = ? AND s.path = ?').bind(revision.id, path).first();
  if (!metadata) throw Error('Incomplete snapshot');
  const rows = await db.prepare('SELECT chunk_index,body_base64 FROM document_chunks WHERE document_hash = ? ORDER BY chunk_index').bind(metadata.hash).all();
  const bytes = await assembleDocument(rows.results, metadata.hash, metadata.byte_length, metadata.chunk_count);
  return new Response(bytes, { headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=31536000, immutable',
    ETag: `"${metadata.hash}"`, 'X-Snapshot-ID': revision.id, 'X-Content-Type-Options': 'nosniff',
  } });
}

async function history(db, revision, url) {
  const limitText = url.searchParams.get('limit') ?? '50';
  if (!/^\d+$/.test(limitText) || Number(limitText) < 1 || Number(limitText) > 100) return json({ error: 'limit must be between 1 and 100' }, 400);
  const before = url.searchParams.get('before') ?? '9999-12-31';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(before)) return json({ error: 'before must be YYYY-MM-DD' }, 400);
  const kind = url.searchParams.get('kind') ?? '';
  if (kind && !/^[a-zA-Z0-9_-]{1,64}$/.test(kind)) return json({ error: 'Invalid record kind' }, 400);
  const result = await db.prepare(`WITH selected AS (
    SELECT e.*, MAX(s.sequence) AS seen_sequence, MIN(s.imported_at) AS first_imported_at
    FROM history_events e JOIN snapshot_events se ON se.event_id=e.id JOIN snapshots s ON s.id=se.snapshot_id
    WHERE s.published_at IS NOT NULL AND s.sequence<=? AND e.event_date<? AND (?='' OR e.kind=?)
    GROUP BY e.id ORDER BY e.event_date DESC,seen_sequence DESC,e.id LIMIT ?
  ) SELECT e.*,d.byte_length,d.chunk_count,c.chunk_index,c.body_base64
    FROM selected e JOIN documents d ON d.hash=e.id JOIN document_chunks c ON c.document_hash=e.id
    ORDER BY e.event_date DESC,e.seen_sequence DESC,e.id,c.chunk_index`).bind(revision.sequence, before, kind, kind, Number(limitText)).all();
  const grouped = new Map();
  for (const row of result.results) {
    if (!grouped.has(row.id)) grouped.set(row.id, []);
    grouped.get(row.id).push(row);
  }
  const events = [];
  for (const [id, rows] of grouped) {
    const bytes = await assembleDocument(rows, id, rows[0].byte_length, rows[0].chunk_count);
    events.push({ id, firstImportedAt: rows[0].first_imported_at, ...JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) });
  }
  const first = await db.prepare('SELECT MIN(imported_at) AS began FROM snapshots WHERE published_at IS NOT NULL AND sequence<=?').bind(revision.sequence).first();
  return json({ snapshotId: revision.id, events, limit: Number(limitText),
    coverage: { completeSnapshotsBegin: first?.began ?? null,
      historicalRecords: 'Dated observations and publisher events only. Earlier observation dates do not imply complete historical chamber or profile snapshots.',
      dateMeaning: 'eventDate follows dateType; poll fieldStart/fieldEnd and source publishedAt remain in record. firstImportedAt is storage time, not fieldwork or publication time.',
      pagination: 'Use before=YYYY-MM-DD to read earlier dates; changed versions of an observation remain separate records.' } });
}

async function api(request, env, url) {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  if (!env.DB) return json({ error: 'data_unavailable', message: 'No published database snapshot is available. Static files remain available.' }, 503);
  if (url.pathname === '/api/current') {
    const current = await env.DB.prepare('SELECT s.*,p.activated_at FROM publication p JOIN snapshots s ON s.id=p.snapshot_id WHERE p.singleton=1 AND s.verified_at IS NOT NULL').first();
    if (!current) return json({ error: 'snapshot_not_published' }, 503);
    const manifest = JSON.parse(current.manifest_json);
    return json({ snapshotId: current.id, sourceCommit: current.source_commit, importedAt: current.imported_at,
      publishedAt: current.activated_at, evidenceTimes: manifest.evidenceTimes, paths: Object.keys(manifest.documents), coverage: manifest.coverage });
  }
  let path = null;
  if (url.pathname === '/api/seats') path = 'data/seats.json';
  else if (url.pathname.startsWith('/api/documents/')) path = url.pathname.slice('/api/documents/'.length);
  else if (url.pathname !== '/api/history') return json({ error: 'not_found' }, 404);
  if (path !== null && !PATHS.has(path)) return json({ error: 'not_found' }, 404);
  const id = url.searchParams.get('snapshot') ?? '';
  if (!/^[0-9a-f]{64}$/.test(id)) return json({ error: 'A valid snapshot ID from /api/current is required' }, 400);
  const revision = await snapshot(env.DB, id);
  if (!revision) return json({ error: 'snapshot_not_found' }, 404);
  return path ? document(env.DB, revision, path) : history(env.DB, revision, url);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    let response;
    try { response = await api(request, env, url); }
    catch { response = json({ error: 'data_unavailable', message: 'The requested snapshot could not be verified. Static files remain available.' }, 503); }
    return request.method === 'HEAD' ? new Response(null, { status: response.status, headers: response.headers }) : response;
  },
};
