import { Plus } from "lucide-react";
import { useState, useCallback } from "react";

import { createJobsBatch, uploadJobFile } from "@/api/client";
import { JobList } from "@/components/jobs/JobList";
import { GlobalSettings } from "@/components/settings/GlobalSettings";
import { QueueSettings } from "@/components/settings/QueueSettings";
import { Button } from "@/components/ui/button";
import { DropZone } from "@/components/upload/DropZone";
import { FileList } from "@/components/upload/FileList";
import { setPreviewUrl } from "@/lib/previewCache";
import { useJobStore, useSessionId, useHasActiveJobs } from "@/store/jobStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUploadStore } from "@/store/uploadStore";

export function HomePage() {
  const { files, clearFiles, getFileOptions } = useUploadStore();
  const { globalOptions } = useSettingsStore();
  const setJob = useJobStore((state) => state.setJob);
  const updateJob = useJobStore((state) => state.updateJob);
  const jobs = useJobStore((state) => state.jobs);
  const sessionId = useSessionId();
  const hasActiveJobs = useHasActiveJobs();

  const [isCompressing, setIsCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUploadArea, setShowUploadArea] = useState(true);

  // Check if we have any jobs for the current session
  const hasSessionJobs = Object.keys(jobs).length > 0;
  const allJobsComplete = hasSessionJobs && !hasActiveJobs;

  // Maybe remove in the future
  void allJobsComplete;

  // Hide upload area when compression starts, show it again when all jobs complete
  // and user has no pending files
  const shouldShowUploadArea = showUploadArea || files.length > 0;

  const handleCompressMore = useCallback(() => {
    setShowUploadArea(true);
  }, []);

  const handleCompress = useCallback(async () => {
    if (files.length === 0) return;

    setError(null);
    setIsCompressing(true);
    setShowUploadArea(false);

    try {
      // Build batch create request using existing session ID
      const batchRequest = {
        files: files.map((f) => ({
          filename: f.file.name,
          size: f.file.size,
          options: getFileOptions(f.id) || globalOptions,
        })),
        sessionId: sessionId!,
      };

      // Create all jobs at once
      const response = await createJobsBatch(batchRequest);

      // Initialize jobs in the store with "uploading" status
      // Transfer preview URLs to cache before clearing files
      response.jobs.forEach((job, index) => {
        const pendingFile = files[index];
        // Store the preview URL in cache so JobCard can use it
        setPreviewUrl(job.id, pendingFile.preview);
        setJob(job.id, {
          id: job.id,
          status: "uploading",
          progress: 0,
          original_filename: job.filename,
          original_size: pendingFile.file.size,
          uploadProgress: 0,
        });
      });

      // Clear pending files (they're now jobs) - don't revoke URLs, they're in previewCache
      clearFiles(false);

      // Upload files sequentially
      for (let i = 0; i < response.jobs.length; i++) {
        const job = response.jobs[i];
        const pendingFile = files[i];

        try {
          await uploadJobFile(job.id, pendingFile.file, (progress) => {
            // Update upload progress in store (0-25% range)
            const scaledProgress = Math.round(progress * 0.25);
            updateJob(job.id, {
              progress: scaledProgress,
              uploadProgress: progress,
            });
          });
          // Upload complete - job status will be updated via WebSocket to "queued"
        } catch (uploadError) {
          console.error(`Failed to upload ${job.filename}:`, uploadError);
          updateJob(job.id, {
            status: "failed",
            error_message:
              uploadError instanceof Error
                ? uploadError.message
                : "Upload failed",
          });
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start compression",
      );
    } finally {
      setIsCompressing(false);
    }
  }, [
    files,
    globalOptions,
    sessionId,
    setJob,
    updateJob,
    clearFiles,
    getFileOptions,
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">GIF Compressor</h1>
          <p className="text-muted-foreground">
            Compress your GIF files locally with full control over quality and
            size
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left column - Upload/Jobs area */}
          <div className="lg:col-span-2 space-y-4">
            {/* File provisioning UI - show when appropriate */}
            {shouldShowUploadArea && (
              <>
                <DropZone />
                <FileList
                  onCompress={handleCompress}
                  isCompressing={isCompressing}
                />

                {error && (
                  <div className="p-4 bg-destructive/10 text-destructive rounded-lg text-sm">
                    {error}
                  </div>
                )}
              </>
            )}

            {/* Job list for current session - always show when there are jobs */}
            {hasSessionJobs && sessionId && (
              <JobList
                sessionId={sessionId}
                showFilters={false}
                showBulkActions={true}
                perPage={-1}
              />
            )}

            {/* Show compress more button when upload area is hidden */}
            {!shouldShowUploadArea && (
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                onClick={handleCompressMore}
              >
                <Plus className="h-5 w-5 mr-2" />
                Compress More GIFs
              </Button>
            )}
          </div>

          {/* Right column - Settings */}
          <div className="space-y-4">
            <GlobalSettings />
            <QueueSettings />
          </div>
        </div>
      </div>
    </div>
  );
}
