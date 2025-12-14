export const SCHEMA = `
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'queued',
  progress INTEGER NOT NULL DEFAULT 0,
  original_filename TEXT NOT NULL,
  original_size INTEGER NOT NULL,
  original_path TEXT NOT NULL,
  original_width INTEGER,
  original_height INTEGER,
  options TEXT NOT NULL,
  compressed_path TEXT,
  compressed_size INTEGER,
  compressed_width INTEGER,
  compressed_height INTEGER,
  reduction_percent REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,
  expires_at TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_expires_at ON jobs(expires_at);
`;
