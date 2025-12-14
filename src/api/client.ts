import type {
  Job,
  JobFilters,
  ListJobsResponse,
  JobCounts,
  QueueConfig,
  UploadResponse,
  CompressionOptions,
} from "./types";

const API_BASE = "/api";

class ApiError extends Error {
  public status: number;
  public data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let data;
    try {
      data = await response.json();
    } catch {
      data = { message: response.statusText };
    }
    throw new ApiError(
      data.error || data.message || `API Error: ${response.status}`,
      response.status,
      data,
    );
  }

  return response.json();
}

// Jobs API
export async function listJobs(
  filters: JobFilters = {},
): Promise<ListJobsResponse> {
  const params = new URLSearchParams();

  if (filters.status && filters.status !== "all")
    params.set("status", filters.status);
  if (filters.filename) params.set("filename", filters.filename);
  if (filters.start_date) params.set("start_date", filters.start_date);
  if (filters.end_date) params.set("end_date", filters.end_date);
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.offset) params.set("offset", String(filters.offset));

  const query = params.toString();
  return fetchApi<ListJobsResponse>(`/jobs${query ? `?${query}` : ""}`);
}

export async function getJob(id: string): Promise<Job> {
  return fetchApi<Job>(`/jobs/${id}`);
}

export async function deleteJob(id: string): Promise<void> {
  await fetchApi(`/jobs/${id}`, { method: "DELETE" });
}

export async function retryJob(id: string): Promise<Job> {
  return fetchApi<Job>(`/jobs/${id}/retry`, { method: "POST" });
}

export async function getJobCounts(): Promise<JobCounts> {
  return fetchApi<JobCounts>("/jobs/counts");
}

// Upload API
export async function uploadFiles(
  files: File[],
  globalOptions: CompressionOptions,
  perFileOptions?: Record<string, CompressionOptions>,
): Promise<UploadResponse> {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append("files", file);
  });

  formData.append("options", JSON.stringify(globalOptions));

  if (perFileOptions && Object.keys(perFileOptions).length > 0) {
    formData.append("perFileOptions", JSON.stringify(perFileOptions));
  }

  const response = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const data = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new ApiError(data.error || "Upload failed", response.status, data);
  }

  return response.json();
}

// Queue API
export async function getQueueConfig(): Promise<QueueConfig> {
  return fetchApi<QueueConfig>("/queue/config");
}

export async function setQueueConcurrency(
  concurrency: number,
): Promise<QueueConfig> {
  return fetchApi<QueueConfig>("/queue/config", {
    method: "PUT",
    body: JSON.stringify({ concurrency }),
  });
}

// Download URLs
export function getDownloadUrl(jobId: string): string {
  return `${API_BASE}/download/${jobId}`;
}

export function getOriginalUrl(jobId: string): string {
  return `${API_BASE}/download/${jobId}/original`;
}

export function getZipDownloadUrl(jobIds: string[]): string {
  return `${API_BASE}/download/zip/archive?ids=${jobIds.join(",")}`;
}

export { ApiError };
