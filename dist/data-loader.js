// Load one complete revision for all data and languages. A failure falls back as a unit.
const paths = [
  'data/seats.json', 'data/evidence.json', 'data/powers.json', 'data/leadership.json',
  'data/senate_profiles.json', 'data/house_profiles.json', 'locales/catalog.json',
  'locales/en.json', 'locales/fr.json', 'locales/es.json', 'locales/ja.json',
];
let session;

async function bytesFetch(path, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(path, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw Error(`Data request failed: ${response.status}`);
    return await response.arrayBuffer();
  } finally { clearTimeout(timer); }
}

const decodeJSON = bytes => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
const jsonFetch = async (path, timeout) => decodeJSON(await bytesFetch(path, timeout));
const sha256 = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
const integrityErrors = {
  zh: '数据校验失败：请刷新后重试；未加载混合版本数据。',
  en: 'Data verification failed. Refresh to retry; mixed-version data was not loaded.',
  fr: 'La vérification des données a échoué. Actualisez pour réessayer ; aucune donnée de versions différentes n’a été chargée.',
  es: 'No se pudieron verificar los datos. Actualiza para reintentar; no se cargaron datos de distintas versiones.',
  ja: 'データの検証に失敗しました。再読み込みしてください。異なるバージョンのデータは読み込んでいません。',
};

function showMode(mode) {
  const target = document.querySelector('.date-box');
  if (!target) return;
  const label = document.createElement('small');
  label.id = 'data-source-status';
  if (mode === 'error') {
    let lang = 'en';
    try { lang = localStorage.getItem('midterm-language') || 'en'; } catch { /* Storage may be unavailable. */ }
    label.textContent = integrityErrors[lang] || integrityErrors.en;
    label.role = 'alert';
  } else label.textContent = mode === 'd1' ? '数据来源：D1 已发布快照' : '数据来源：静态文件快照（API 未启用或暂不可用）';
  target.append(label);
}

async function staticSnapshot() {
  // Pin one manifest before fetching any file. A deployment crossing these requests must fail closed.
  const manifest = await jsonFetch('static-manifest.json');
  if (manifest.schemaVersion !== 1 || !/^[0-9a-f]{64}$/.test(manifest.manifestId) ||
      !manifest.files || Object.keys(manifest.files).length !== paths.length) throw Error('Invalid static release manifest');
  const expected = {};
  for (const path of [...paths].sort()) {
    const item = manifest.files[path];
    if (!item || !Number.isSafeInteger(item.bytes) || item.bytes < 0 || item.bytes > 16 * 1024 * 1024 ||
        !/^[0-9a-f]{64}$/.test(item.sha256)) throw Error('Incomplete static release manifest');
    expected[path] = { bytes: item.bytes, sha256: item.sha256 };
  }
  if (await sha256(new TextEncoder().encode(JSON.stringify(expected))) !== manifest.manifestId) throw Error('Static manifest hash mismatch');
  const entries = await Promise.all(paths.map(async path => {
    const raw = await bytesFetch(path);
    if (raw.byteLength !== expected[path].bytes || await sha256(raw) !== expected[path].sha256) throw Error('Static release changed during loading');
    return [path, decodeJSON(raw)];
  }));
  const data = new Map(entries);
  checkLanguages(data);
  return data;
}

function checkLanguages(data) {
  const catalog = data.get('locales/catalog.json');
  if (!Array.isArray(catalog)) throw Error('Invalid translation catalog');
  for (const lang of ['en', 'fr', 'es', 'ja']) {
    const translated = data.get(`locales/${lang}.json`);
    if (catalog.some(item => typeof translated?.[item.id] !== 'string' || !translated[item.id].trim())) throw Error('Incomplete translation snapshot');
  }
}

async function start() {
  try {
    const current = await jsonFetch('/api/current', 4000);
    if (!/^[0-9a-f]{64}$/.test(current.snapshotId) || paths.some(path => !current.paths?.includes(path))) throw Error('Incomplete API snapshot');
    const entries = await Promise.all(paths.map(async path => [path, await jsonFetch(`/api/documents/${path}?snapshot=${current.snapshotId}`)]));
    const data = new Map(entries);
    checkLanguages(data);
    const history = await jsonFetch(`/api/history?snapshot=${current.snapshotId}&kind=generic-ballot-snapshot&limit=100`);
    if (history.snapshotId !== current.snapshotId || !Array.isArray(history.events)) throw Error('Inconsistent historical snapshot');
    const observations = new Map();
    for (const event of history.events) {
      const key = `${event.entityKey}:${event.eventDate}`;
      if (!observations.has(key)) observations.set(key, event.record);
    }
    data.get('data/evidence.json').history = [...observations.values()].sort((a, b) => a.date.localeCompare(b.date));
    showMode('d1');
    return data;
  } catch {
    try {
      const data = await staticSnapshot();
      showMode('static');
      return data;
    } catch (error) {
      showMode('error');
      throw error;
    }
  }
}

export async function loadJSON(path) {
  if (!paths.includes(path)) throw Error('Unknown public dataset');
  session ??= start();
  return structuredClone((await session).get(path));
}
