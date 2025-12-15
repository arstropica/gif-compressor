import {
  Download,
  Trash2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";

import { getDownloadUrl, getOriginalUrl } from "@/api/client";
import type { Job } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDeleteJob, useRetryJob } from "@/hooks/useJobs";
import { formatBytes, formatRelativeTime, formatDimensions } from "@/lib/utils";
import { cn } from "@/lib/utils";

import { JobStatusBadge } from "./JobStatusBadge";
import SegmentedProgressBar from "../ui/segmentedprogressbar";

interface JobCardProps {
  job: Job;
  selected?: boolean;
  onToggleSelect?: () => void;
}

export function JobCard({ job, selected, onToggleSelect }: JobCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { mutate: deleteJob, isPending: isDeleting } = useDeleteJob();
  const { mutate: retryJob, isPending: isRetrying } = useRetryJob();

  const isActive = job.status === "queued" || job.status === "processing";
  const canDownload = job.status === "completed";
  const canRetry = job.status === "failed";
  const psegments = { 0: "teal", 25: "orange", 90: "blue" } as const;

  return (
    <Card
      className={cn("p-4 transition-colors", selected && "ring-2 ring-primary")}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox for selection */}
        {onToggleSelect && canDownload && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="mt-1 h-4 w-4 rounded border-gray-300"
          />
        )}

        {/* Preview thumbnail */}
        {canDownload && (
          <img
            src={getOriginalUrl(job.id)}
            alt={job.original_filename}
            className="w-16 h-16 object-cover rounded flex-shrink-0"
          />
        )}

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium truncate">
              {job.original_filename}
            </span>
            <JobStatusBadge status={job.status} />
          </div>

          {/* Progress bar for active jobs */}
          {isActive && (
            <div className="mb-2">
              <SegmentedProgressBar
                percent={job.progress}
                segments={psegments}
                className="h-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {job.progress}% complete
              </p>
            </div>
          )}

          {/* Stats row for completed jobs */}
          {job.status === "completed" && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{formatBytes(job.original_size)}</span>
              <span>→</span>
              <span className="text-green-600 font-medium">
                {formatBytes(job.compressed_size || 0)}
              </span>
              <span className="text-green-600 font-medium">
                -{job.reduction_percent?.toFixed(1)}%
              </span>
            </div>
          )}

          {/* Error message */}
          {job.status === "failed" && job.error_message && (
            <p className="text-sm text-destructive truncate">
              {job.error_message}
            </p>
          )}

          {/* Timestamp */}
          <p className="text-xs text-muted-foreground mt-1">
            {formatRelativeTime(job.created_at)}
          </p>

          {/* Expanded details */}
          {expanded && (
            <div className="mt-3 pt-3 border-t text-sm space-y-1">
              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <span>Original size:</span>
                <span>{formatBytes(job.original_size)}</span>

                {job.original_width && (
                  <>
                    <span>Original dimensions:</span>
                    <span>
                      {formatDimensions(
                        job.original_width,
                        job.original_height,
                      )}
                    </span>
                  </>
                )}

                {job.compressed_size && (
                  <>
                    <span>Compressed size:</span>
                    <span>{formatBytes(job.compressed_size)}</span>
                  </>
                )}

                {job.compressed_width && (
                  <>
                    <span>Compressed dimensions:</span>
                    <span>
                      {formatDimensions(
                        job.compressed_width,
                        job.compressed_height,
                      )}
                    </span>
                  </>
                )}

                <span>Compression level:</span>
                <span>{job.options.compression_level}</span>

                {job.options.drop_frames !== "none" && (
                  <>
                    <span>Frame dropping:</span>
                    <span>{job.options.drop_frames}</span>
                  </>
                )}

                {job.options.resize_enabled && (
                  <>
                    <span>Target size:</span>
                    <span>
                      {job.options.target_width} × {job.options.target_height}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>

          {canDownload && (
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <a href={getDownloadUrl(job.id)} download>
                <Download className="h-4 w-4" />
              </a>
            </Button>
          )}

          {canRetry && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => retryJob(job.id)}
              disabled={isRetrying}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => deleteJob(job.id)}
            disabled={isDeleting || isActive}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
