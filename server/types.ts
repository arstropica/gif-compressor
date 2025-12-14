export type JobStatus = "queued" | "processing" | "completed" | "failed";

export interface CompressionOptions {
  compression_level: number;
  drop_frames: "none" | "n2" | "n3" | "n4";
  reduce_colors: boolean;
  number_of_colors: number;
  optimize_transparency: boolean;
  undo_optimizations: boolean;
  resize_enabled: boolean;
  target_width: number | null;
  target_height: number | null;
}

export interface Job {
  id: string;
  status: JobStatus;
  progress: number;
  original_filename: string;
  original_size: number;
  original_path: string;
  original_width?: number;
  original_height?: number;
  options: CompressionOptions;
  compressed_path?: string;
  compressed_size?: number;
  compressed_width?: number;
  compressed_height?: number;
  reduction_percent?: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  expires_at?: string;
  error_message?: string;
}

export interface JobRow {
  id: string;
  status: string;
  progress: number;
  original_filename: string;
  original_size: number;
  original_path: string;
  original_width: number | null;
  original_height: number | null;
  options: string; // JSON string
  compressed_path: string | null;
  compressed_size: number | null;
  compressed_width: number | null;
  compressed_height: number | null;
  reduction_percent: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  error_message: string | null;
}

export interface JobFilters {
  status?: JobStatus | "all";
  filename?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface CompressResult {
  path: string;
  size: number;
  width: number;
  height: number;
}

export interface WSMessage {
  type: "CONNECTED" | "JOB_STATUS_UPDATE" | "QUEUE_UPDATE" | "PONG";
  jobId?: string;
  data?: unknown;
}

export interface JobStatusUpdate {
  status: JobStatus;
  progress: number;
  compressed_size?: number;
  compressed_width?: number;
  compressed_height?: number;
  reduction_percent?: number;
  error_message?: string;
}
