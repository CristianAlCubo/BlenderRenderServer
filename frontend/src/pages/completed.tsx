import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState, PageHeader } from "@/components/ui/empty-state";
import { JobCard } from "@/components/jobs/job-card";

export function CompletedPage() {
  const navigate = useNavigate();
  const jobs = useQuery({
    queryKey: ["jobs", "completed"],
    queryFn: () => api.listJobs("COMPLETED", 200, 0),
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Completed" description="Finished renders ready to preview or download" />

      {jobs.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : jobs.isError ? (
        <ErrorState message="Could not load completed jobs" />
      ) : (jobs.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title="Nothing completed yet"
          description="Completed renders will appear here."
          action={<Button onClick={() => navigate("/upload")}>Upload project</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {jobs.data!.items.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
