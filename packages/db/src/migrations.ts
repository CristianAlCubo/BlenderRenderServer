export const migrations: Array<{ name: string; sql: string }> = [
  {
    name: "0001_init",
    sql: `
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  original_filename TEXT NOT NULL,
  project_path TEXT NOT NULL,
  blend_file_path TEXT,
  status TEXT NOT NULL DEFAULT 'QUEUED',
  progress REAL NOT NULL DEFAULT 0,
  current_frame INTEGER NOT NULL DEFAULT 0,
  total_frames INTEGER NOT NULL DEFAULT 0,
  render_engine TEXT NOT NULL DEFAULT 'blender',
  compute_mode TEXT,
  render_mode TEXT NOT NULL DEFAULT 'CPU',
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  error_message TEXT,
  created_by TEXT,
  worker_id TEXT
);

CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs (status);
CREATE INDEX IF NOT EXISTS jobs_created_at_idx ON jobs (created_at);

CREATE TABLE IF NOT EXISTS job_outputs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  filename TEXT NOT NULL,
  path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS job_outputs_job_id_idx ON job_outputs (job_id);

CREATE TABLE IF NOT EXISTS job_logs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'INFO',
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS job_logs_job_id_idx ON job_logs (job_id);

CREATE TABLE IF NOT EXISTS workers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ONLINE',
  compute_mode TEXT NOT NULL DEFAULT 'CPU',
  blender_version TEXT,
  last_heartbeat TEXT NOT NULL,
  current_job_id TEXT,
  capabilities TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS workers_status_idx ON workers (status);
`,
  },
];
