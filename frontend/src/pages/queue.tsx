import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import type { JobStatus } from "@render-server/shared";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState, PageHeader } from "@/components/ui/empty-state";
import { JobCard } from "@/components/jobs/job-card";
import { cn } from "@/lib/utils";

const FILTERS: Array<{ value: JobStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "QUEUED", label: "Queued" },
  { value: "PREPARING", label: "Preparing" },
  { value: "RENDERING", label: "Rendering" },
  { value: "ENCODING", label: "Encoding" },
  { value: "COMPLETED", label: "Completed" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export function QueuePage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<JobStatus | "ALL">("ALL");
  const jobs = useQuery({
    queryKey: ["jobs", "list", filter],
    queryFn: () =>
      api.listJobs(filter === "ALL" ? undefined : filter, 200, 0),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Queue"
        description="All render jobs and their current status"
        action={
          <Button onClick={() => navigate("/upload")}>New Job</Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {jobs.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : jobs.isError ? (
        <ErrorState message="Could not load the queue" />
      ) : (jobs.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title="No jobs found"
          description="Upload a project to see it here."
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
