export const SCHEMA_TABLE = `
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  status TEXT NOT NULL DEFAULT 'uploading',
  progress INTEGER NOT NULL DEFAULT 0,
  original_filename TEXT NOT NULL,
  original_size INTEGER NOT NULL,
  original_path TEXT,
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
`;

export const SCHEMA_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_session_id ON jobs(session_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_expires_at ON jobs(expires_at);
`;

// Training samples for prediction model
export const SCHEMA_PREDICTION_SAMPLES = `
CREATE TABLE IF NOT EXISTS prediction_samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,

  -- Input features (from GifInfo)
  frames INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  file_size INTEGER NOT NULL,
  total_pixels INTEGER NOT NULL,

  -- Output features (after resize/frame-drop)
  target_width INTEGER NOT NULL,
  target_height INTEGER NOT NULL,

  -- Compression options
  compression_level INTEGER NOT NULL,
  drop_frames TEXT NOT NULL,
  reduce_colors INTEGER NOT NULL,
  number_of_colors INTEGER NOT NULL,
  optimize_transparency INTEGER NOT NULL,
  undo_optimizations INTEGER NOT NULL,

  -- Actual timing
  elapsed_ms REAL NOT NULL,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);
`;

// Residual corrections per feature/value (EMA)
export const SCHEMA_PREDICTION_RESIDUALS = `
CREATE TABLE IF NOT EXISTS prediction_residuals (
  feature_key TEXT PRIMARY KEY,
  ema REAL NOT NULL DEFAULT 0,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export const SCHEMA_PREDICTION_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_prediction_samples_created ON prediction_samples(created_at DESC);
`;
