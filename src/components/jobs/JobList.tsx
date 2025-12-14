import { Download, Loader2 } from "lucide-react";
import { useEffect, useRef, useCallback } from "react";

import { getZipDownloadUrl } from "@/api/client";
import { Button } from "@/components/ui/button";
import { useJobs } from "@/hooks/useJobs";
import { useJobsStore } from "@/store/jobsStore";

import { JobCard } from "./JobCard";
import { JobFilters } from "./JobFilters";

export function JobList() {
  const {
    statusFilter,
    filenameFilter,
    selectedJobIds,
    toggleJobSelected,
    selectAllJobs,
    deselectAllJobs,
  } = useJobsStore();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useJobs({
    status: statusFilter,
    filename: filenameFilter || undefined,
    limit: 20,
  });

  // Flatten pages into single array
  const jobs = data?.pages.flatMap((page) => page.jobs) || [];
  const completedJobs = jobs.filter((j) => j.status === "completed");
  const completedJobIds = completedJobs.map((j) => j.id);

  // Infinite scroll
  const loaderRef = useRef<HTMLDivElement>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      rootMargin: "100px",
    });

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [handleObserver]);

  // Selection helpers
  const selectedCount = selectedJobIds.size;
  const allSelected =
    selectedCount > 0 && selectedCount === completedJobIds.length;

  const handleSelectAll = () => {
    if (allSelected) {
      deselectAllJobs();
    } else {
      selectAllJobs(completedJobIds);
    }
  };

  const handleDownloadSelected = () => {
    const ids = Array.from(selectedJobIds);
    if (ids.length > 0) {
      window.location.href = getZipDownloadUrl(ids);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12 text-destructive">
        Failed to load jobs. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <JobFilters />

      {/* Bulk actions */}
      {completedJobs.length > 0 && (
        <div className="flex items-center gap-3 py-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={handleSelectAll}
              className="h-4 w-4 rounded border-gray-300"
            />
            Select all completed ({completedJobs.length})
          </label>

          {selectedCount > 0 && (
            <Button size="sm" onClick={handleDownloadSelected}>
              <Download className="h-4 w-4 mr-1" />
              Download {selectedCount} as ZIP
            </Button>
          )}
        </div>
      )}

      {/* Job list */}
      {jobs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No jobs found. Upload some GIFs to get started!
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              selected={selectedJobIds.has(job.id)}
              onToggleSelect={
                job.status === "completed"
                  ? () => toggleJobSelected(job.id)
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {/* Infinite scroll loader */}
      <div ref={loaderRef} className="py-4 text-center">
        {isFetchingNextPage && (
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        )}
        {!hasNextPage && jobs.length > 0 && (
          <p className="text-sm text-muted-foreground">No more jobs</p>
        )}
      </div>
    </div>
  );
}
