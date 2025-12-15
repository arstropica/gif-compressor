import { JobList } from "@/components/jobs/JobList";

export function HistoryPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Compression History</h1>
          <p className="text-muted-foreground">
            View and manage your completed compression jobs
          </p>
        </div>

        <JobList
          statusFilter={["completed", "failed"]}
          showFilters={true}
          showBulkActions={true}
          emptyMessage="No completed jobs yet. Start by compressing some GIFs!"
        />
      </div>
    </div>
  );
}
