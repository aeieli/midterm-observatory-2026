-- Additive only. Never replace an existing database or delete historical observations.
CREATE TABLE IF NOT EXISTS documents (
  hash TEXT PRIMARY KEY CHECK(length(hash) = 64),
  byte_length INTEGER NOT NULL CHECK(byte_length >= 0),
  chunk_count INTEGER NOT NULL CHECK(chunk_count > 0)
);
CREATE TABLE IF NOT EXISTS document_chunks (
  document_hash TEXT NOT NULL REFERENCES documents(hash),
  chunk_index INTEGER NOT NULL CHECK(chunk_index >= 0),
  body_base64 TEXT NOT NULL,
  PRIMARY KEY(document_hash, chunk_index)
);
CREATE TABLE IF NOT EXISTS snapshots (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE CHECK(length(id) = 64),
  source_commit TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  imported_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  verified_at TEXT,
  published_at TEXT
);
CREATE TABLE IF NOT EXISTS snapshot_documents (
  snapshot_id TEXT NOT NULL REFERENCES snapshots(id),
  path TEXT NOT NULL,
  document_hash TEXT NOT NULL REFERENCES documents(hash),
  PRIMARY KEY(snapshot_id, path)
);
CREATE TABLE IF NOT EXISTS history_events (
  id TEXT PRIMARY KEY REFERENCES documents(hash),
  entity_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  event_date TEXT NOT NULL,
  date_type TEXT NOT NULL,
  source TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS history_by_kind_date ON history_events(kind, event_date);
CREATE TABLE IF NOT EXISTS snapshot_events (
  snapshot_id TEXT NOT NULL REFERENCES snapshots(id),
  event_id TEXT NOT NULL REFERENCES history_events(id),
  PRIMARY KEY(snapshot_id, event_id)
);
CREATE TABLE IF NOT EXISTS publication (
  singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
  snapshot_id TEXT NOT NULL REFERENCES snapshots(id),
  activated_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS record_first_publication_insert AFTER INSERT ON publication
BEGIN
  UPDATE snapshots SET published_at=COALESCE(published_at,NEW.activated_at) WHERE id=NEW.snapshot_id;
END;
CREATE TRIGGER IF NOT EXISTS record_first_publication_update AFTER UPDATE ON publication
BEGIN
  UPDATE snapshots SET published_at=COALESCE(published_at,NEW.activated_at) WHERE id=NEW.snapshot_id;
END;
