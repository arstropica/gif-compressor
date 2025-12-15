export type JobStatus =
  | "uploading"
  | "queued"
  | "processing"
  | "completed"
  | "failed";

export interface CompressionOptions {
  compression_level: number; // 1-200, default 75
  drop_frames: "none" | "n2" | "n3" | "n4";
  reduce_colors: boolean;
  number_of_colors: number; // 2-256
  optimize_transparency: boolean;
  undo_optimizations: boolean;
  resize_enabled: boolean;
  target_width: number | null;
  target_height: number | null;
}

export const DEFAULT_COMPRESSION_OPTIONS: CompressionOptions = {
  compression_level: 75,
  drop_frames: "none",
  reduce_colors: false,
  number_of_colors: 256,
  optimize_transparency: true,
  undo_optimizations: false,
  resize_enabled: false,
  target_width: null,
  target_height: null,
};

export interface Job {
  id: string;
  session_id?: string;
  status: JobStatus;
  progress: number;
  original_filename: string;
  original_size: number;
  original_width?: number;
  original_height?: number;
  options: CompressionOptions;
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

export interface JobFilters {
  status?: JobStatus | JobStatus[] | "all";
  session_id?: string;
  filename?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface ListJobsResponse {
  jobs: Job[];
  total: number;
  limit: number;
  offset: number;
}

export interface JobCounts {
  all: number;
  uploading: number;
  queued: number;
  processing: number;
  completed: number;
  failed: number;
}

export interface QueueConfig {
  concurrency: number;
  active: number;
  pending: number;
}

export interface UploadResponse {
  jobs: Array<{
    id: string;
    filename: string;
  }>;
}

export interface BatchCreateRequest {
  files: Array<{
    filename: string;
    size: number;
    options: CompressionOptions;
  }>;
  sessionId: string;
}

export interface BatchCreateResponse {
  jobs: Array<{
    id: string;
    filename: string;
  }>;
  sessionId: string;
}

export interface WSMessage {
  type: "CONNECTED" | "JOB_STATUS_UPDATE" | "QUEUE_UPDATE" | "PONG";
  jobId?: string;
  data?: JobStatusUpdate | QueueConfig;
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
