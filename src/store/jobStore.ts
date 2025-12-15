import { v4 as uuidv4 } from "uuid";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { listJobs } from "@/api/client";
import type { Job, JobStatus, JobStatusUpdate } from "@/api/types";

export interface JobState {
  id: string;
  status: JobStatus;
  progress: number;
  original_filename: string;
  original_size: number;
  original_width?: number;
  original_height?: number;
  compressed_size?: number;
  compressed_width?: number;
  compressed_height?: number;
  reduction_percent?: number;
  error_message?: string;
  // Client-side tracking for upload progress (0-100 of upload phase)
  uploadProgress?: number;
}

interface JobStore {
  // Job state map (jobId -> JobState)
  jobs: Record<string, JobState>;

  // Current session ID
  sessionId: string | null;

  // Actions
  setJob: (jobId: string, state: JobState) => void;
  setJobs: (jobs: Job[]) => void;
  updateJob: (jobId: string, update: Partial<JobState>) => void;
  updateJobFromWS: (jobId: string, update: JobStatusUpdate) => void;
  removeJob: (jobId: string) => void;
  clearJobs: () => void;

  // Session management
  initSessionAsync: () => Promise<string>;

  // Helpers
  hasActiveJobs: () => boolean;
  getActiveJobIds: () => string[];
}

export const useJobStore = create<JobStore>()(
  persist(
    (set, get) => ({
      jobs: {},
      sessionId: null,

      setJob: (jobId, state) =>
        set((s) => ({
          jobs: { ...s.jobs, [jobId]: state },
        })),

      setJobs: (jobs) =>
        set((s) => {
          const newJobs = { ...s.jobs };
          for (const job of jobs) {
            newJobs[job.id] = {
              id: job.id,
              status: job.status,
              progress: job.progress,
              original_filename: job.original_filename,
              original_size: job.original_size,
              original_width: job.original_width,
              original_height: job.original_height,
              compressed_size: job.compressed_size,
              compressed_width: job.compressed_width,
              compressed_height: job.compressed_height,
              reduction_percent: job.reduction_percent,
              error_message: job.error_message,
            };
          }
          return { jobs: newJobs };
        }),

      updateJob: (jobId, update) =>
        set((s) => {
          const existingJob = s.jobs[jobId];
          if (!existingJob) return s;
          return {
            jobs: {
              ...s.jobs,
              [jobId]: { ...existingJob, ...update },
            },
          };
        }),

      updateJobFromWS: (jobId, update) =>
        set((s) => {
          const existingJob = s.jobs[jobId];
          if (!existingJob) return s;
          return {
            jobs: {
              ...s.jobs,
              [jobId]: {
                ...existingJob,
                status: update.status,
                progress: update.progress,
                compressed_size:
                  update.compressed_size ?? existingJob.compressed_size,
                compressed_width:
                  update.compressed_width ?? existingJob.compressed_width,
                compressed_height:
                  update.compressed_height ?? existingJob.compressed_height,
                reduction_percent:
                  update.reduction_percent ?? existingJob.reduction_percent,
                error_message:
                  update.error_message ?? existingJob.error_message,
              },
            },
          };
        }),

      removeJob: (jobId) =>
        set((s) => {
          const { [jobId]: _, ...rest } = s.jobs;
          return { jobs: rest };
        }),

      clearJobs: () => set({ jobs: {} }),

      initSessionAsync: async () => {
        const state = get();

        // If we have a persisted session, check server for active jobs
        if (state.sessionId) {
          try {
            const { jobs } = await listJobs({
              session_id: state.sessionId,
              status: ["uploading", "queued", "processing"],
            });

            if (jobs.length > 0) {
              // Populate store with active jobs and keep session
              const jobsMap: Record<string, JobState> = {};
              for (const job of jobs) {
                jobsMap[job.id] = {
                  id: job.id,
                  status: job.status,
                  progress: job.progress,
                  original_filename: job.original_filename,
                  original_size: job.original_size,
                  original_width: job.original_width,
                  original_height: job.original_height,
                  compressed_size: job.compressed_size,
                  compressed_width: job.compressed_width,
                  compressed_height: job.compressed_height,
                  reduction_percent: job.reduction_percent,
                  error_message: job.error_message,
                };
              }
              set({ jobs: jobsMap });
              return state.sessionId;
            }
          } catch (err) {
            console.error("[JobStore] Failed to fetch session jobs:", err);
          }
        }

        // No active jobs or no session, create new session
        const newSessionId = uuidv4();
        set({ sessionId: newSessionId, jobs: {} });
        return newSessionId;
      },

      hasActiveJobs: () => {
        const jobs = Object.values(get().jobs);
        return jobs.some(
          (job) =>
            job.status === "uploading" ||
            job.status === "queued" ||
            job.status === "processing",
        );
      },

      getActiveJobIds: () => {
        const jobs = Object.values(get().jobs);
        return jobs
          .filter(
            (job) =>
              job.status === "uploading" ||
              job.status === "queued" ||
              job.status === "processing",
          )
          .map((job) => job.id);
      },
    }),
    {
      name: "gif-compressor-jobs",
      partialize: (state) => ({
        sessionId: state.sessionId,
        // Don't persist job data - it will be fetched fresh from server
      }),
    },
  ),
);

// Selector hooks for common use cases
export const useJob = (jobId: string): JobState | undefined => {
  return useJobStore((state) => state.jobs[jobId]);
};

export const useSessionId = (): string | null => {
  return useJobStore((state) => state.sessionId);
};

export const useHasActiveJobs = (): boolean => {
  return useJobStore((state) => state.hasActiveJobs());
};
