import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

import { SCHEMA } from "./schema.js";
import type { Job, JobRow, JobFilters, CompressionOptions } from "../types.js";

const DATABASE_PATH = process.env.DATABASE_PATH || "./data/gif-compressor.db";

// Ensure directory exists
const dbDir = path.dirname(DATABASE_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DATABASE_PATH);
db.pragma("journal_mode = WAL");

// Initialize schema
db.exec(SCHEMA);

function rowToJob(row: JobRow): Job {
  return {
    id: row.id,
    status: row.status as Job["status"],
    progress: row.progress,
    original_filename: row.original_filename,
    original_size: row.original_size,
    original_path: row.original_path,
    original_width: row.original_width ?? undefined,
    original_height: row.original_height ?? undefined,
    options: JSON.parse(row.options) as CompressionOptions,
    compressed_path: row.compressed_path ?? undefined,
    compressed_size: row.compressed_size ?? undefined,
    compressed_width: row.compressed_width ?? undefined,
    compressed_height: row.compressed_height ?? undefined,
    reduction_percent: row.reduction_percent ?? undefined,
    created_at: row.created_at,
    started_at: row.started_at ?? undefined,
    completed_at: row.completed_at ?? undefined,
    expires_at: row.expires_at ?? undefined,
    error_message: row.error_message ?? undefined,
  };
}

export function createJob(
  id: string,
  filename: string,
  size: number,
  filePath: string,
  options: CompressionOptions,
  width?: number,
  height?: number,
  expiresAt?: string,
): Job {
  const stmt = db.prepare(`
    INSERT INTO jobs (id, original_filename, original_size, original_path, original_width, original_height, options, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    filename,
    size,
    filePath,
    width ?? null,
    height ?? null,
    JSON.stringify(options),
    expiresAt ?? null,
  );

  return getJob(id)!;
}

export function getJob(id: string): Job | null {
  const stmt = db.prepare("SELECT * FROM jobs WHERE id = ?");
  const row = stmt.get(id) as JobRow | undefined;
  return row ? rowToJob(row) : null;
}

export function updateJob(id: string, updates: Partial<JobRow>): void {
  const fields = Object.keys(updates);
  if (fields.length === 0) return;

  const setClause = fields.map((f) => `${f} = ?`).join(", ");
  const values = fields.map((f) => updates[f as keyof typeof updates]);

  const stmt = db.prepare(`UPDATE jobs SET ${setClause} WHERE id = ?`);
  stmt.run(...values, id);
}

export function deleteJob(id: string): boolean {
  const stmt = db.prepare("DELETE FROM jobs WHERE id = ?");
  const result = stmt.run(id);
  return result.changes > 0;
}

export function listJobs(filters: JobFilters = {}): {
  jobs: Job[];
  total: number;
} {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.status && filters.status !== "all") {
    conditions.push("status = ?");
    params.push(filters.status);
  }

  if (filters.filename) {
    conditions.push("original_filename LIKE ?");
    params.push(`%${filters.filename}%`);
  }

  if (filters.start_date) {
    conditions.push("created_at >= ?");
    params.push(filters.start_date);
  }

  if (filters.end_date) {
    conditions.push("created_at <= ?");
    params.push(filters.end_date);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Get total count
  const countStmt = db.prepare(
    `SELECT COUNT(*) as count FROM jobs ${whereClause}`,
  );
  const { count: total } = countStmt.get(...params) as { count: number };

  // Get paginated results
  const limit = filters.limit || 20;
  const offset = filters.offset || 0;

  const stmt = db.prepare(`
    SELECT * FROM jobs ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);

  const rows = stmt.all(...params, limit, offset) as JobRow[];

  return {
    jobs: rows.map(rowToJob),
    total,
  };
}

export function getJobCounts(): Record<string, number> {
  const stmt = db.prepare(`
    SELECT
      COUNT(*) as all_count,
      SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued,
      SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM jobs
  `);

  const row = stmt.get() as Record<string, number>;

  return {
    all: row.all_count,
    queued: row.queued,
    processing: row.processing,
    completed: row.completed,
    failed: row.failed,
  };
}

export function getExpiredJobs(): Job[] {
  const stmt = db.prepare(`
    SELECT * FROM jobs
    WHERE expires_at IS NOT NULL AND expires_at < datetime('now')
  `);

  const rows = stmt.all() as JobRow[];
  return rows.map(rowToJob);
}

export function getQueuedJobs(): Job[] {
  const stmt = db.prepare(
    `SELECT * FROM jobs WHERE status = 'queued' ORDER BY created_at ASC`,
  );
  const rows = stmt.all() as JobRow[];
  return rows.map(rowToJob);
}

export { db };
