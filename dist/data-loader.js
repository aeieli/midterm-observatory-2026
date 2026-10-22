// Load one complete revision for all data and languages. A failure falls back as a unit.
const paths = [
  'data/seats.json', 'data/evidence.json', 'data/powers.json', 'data/leadership.json',
  'data/senate_profiles.json', 'data/house_profiles.json', 'locales/catalog.json',
  'locales/en.json', 'locales/fr.json', 'locales/es.json', 'locales/ja.json',
];
let session;

async function jsonFetch(path, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(path, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw Error(`Data request failed: ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timer); }
}

function showMode(mode) {
  const target = document.querySelector('.date-box');
  if (!target) return;
  const label = document.createElement('small');
  label.id = 'data-source-status';
  label.textContent = mode === 'd1' ? '数据来源：D1 已发布快照' : '数据来源：静态文件快照（API 未启用或暂不可用）';
  target.append(label);
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
    const data = new Map(await Promise.all(paths.map(async path => [path, await jsonFetch(path)])));
    checkLanguages(data);
    showMode('static');
    return data;
  }
}

export async function loadJSON(path) {
  if (!paths.includes(path)) throw Error('Unknown public dataset');
  session ??= start();
  return structuredClone((await session).get(path));
}
