-- Initial schema for Scribe sync server
-- This migration creates the core tables for user, device, note, and change tracking

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  api_key_hash TEXT NOT NULL,       -- PBKDF2 hash
  created_at INTEGER DEFAULT (unixepoch() * 1000),
  storage_used_bytes INTEGER DEFAULT 0,
  note_count INTEGER DEFAULT 0
);

-- Devices per user
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT,
  created_at INTEGER DEFAULT (unixepoch() * 1000),
  last_seen_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);

-- Notes storage
CREATE TABLE IF NOT EXISTS notes (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  content_hash TEXT NOT NULL,
  content TEXT NOT NULL,              -- Full JSON note
  note_type TEXT,                     -- 'person' | 'daily' | 'meeting' | etc.
  created_at INTEGER DEFAULT (unixepoch() * 1000),
  updated_at INTEGER DEFAULT (unixepoch() * 1000),
  deleted_at INTEGER,                 -- Soft delete (tombstone)
  PRIMARY KEY (id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_deleted ON notes(user_id, deleted_at);

-- Change log for efficient pull queries
CREATE TABLE IF NOT EXISTS change_log (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note_id TEXT NOT NULL,
  device_id TEXT REFERENCES devices(id),
  operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  version INTEGER NOT NULL,
  content_hash TEXT,
  created_at INTEGER DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_change_log_user_seq ON change_log(user_id, sequence);
