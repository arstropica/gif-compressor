import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useJobCounts } from "@/hooks/useJobs";
import { useJobsStore } from "@/store/jobsStore";

export function JobFilters() {
  const {
    statusFilter,
    filenameFilter,
    setStatusFilter,
    setFilenameFilter,
    clearFilters,
  } = useJobsStore();

  const { data: counts } = useJobCounts();

  const hasFilters = statusFilter !== "all" || filenameFilter !== "";

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Status filter */}
      <Select
        value={statusFilter}
        onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All ({counts?.all || 0})</SelectItem>
          <SelectItem value="queued">Queued ({counts?.queued || 0})</SelectItem>
          <SelectItem value="processing">
            Processing ({counts?.processing || 0})
          </SelectItem>
          <SelectItem value="completed">
            Completed ({counts?.completed || 0})
          </SelectItem>
          <SelectItem value="failed">Failed ({counts?.failed || 0})</SelectItem>
        </SelectContent>
      </Select>

      {/* Filename search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by filename..."
          value={filenameFilter}
          onChange={(e) => setFilenameFilter(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Clear filters */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
