import type { JobStatus } from "@/api/types";
import { Badge } from "@/components/ui/badge";

interface JobStatusBadgeProps {
  status: JobStatus;
}

export function JobStatusBadge({ status }: JobStatusBadgeProps) {
  switch (status) {
    case "queued":
      return <Badge variant="secondary">Queued</Badge>;
    case "processing":
      return <Badge variant="default">Processing</Badge>;
    case "completed":
      return <Badge variant="success">Completed</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
