import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Cpu, Loader2, XCircle } from "lucide-react";

import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState, PageHeader } from "@/components/ui/empty-state";
import { JobCard } from "@/components/jobs/job-card";

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-9 w-9 items-center justify-center rounded-md ${tone}`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const jobs = useQuery({ queryKey: ["jobs", "all"], queryFn: () => api.listJobs() });

  if (jobs.isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (jobs.isError) {
    return <ErrorState message="Could not load jobs" />;
  }

  const items = jobs.data?.items ?? [];
  const count = (status: string) => items.filter((j) => j.status === status).length;
  const active = items.filter((j) =>
    ["PREPARING", "RENDERING", "ENCODING"].includes(j.status),
  );
  const queued = items.filter((j) => j.status === "QUEUED");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your render farm"
        action={
          <Button onClick={() => navigate("/upload")}>New Job</Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Rendering"
          value={count("RENDERING") + count("ENCODING")}
          icon={<Loader2 className="h-4 w-4 animate-spin" />}
          tone="bg-blue-500/15 text-blue-500"
        />
        <StatCard
          label="Queued"
          value={count("QUEUED") + count("PREPARING")}
          icon={<Cpu className="h-4 w-4" />}
          tone="bg-muted text-muted-foreground"
        />
        <StatCard
          label="Completed"
          value={count("COMPLETED")}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="bg-emerald-500/15 text-emerald-500"
        />
        <StatCard
          label="Failed"
          value={count("FAILED")}
          icon={<XCircle className="h-4 w-4" />}
          tone="bg-destructive/15 text-destructive"
        />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
          Currently rendering
        </h2>
        {active.length === 0 ? (
          <EmptyState
            title="No active renders"
            description="Upload a .blend or .zip project to start rendering."
            action={
              <Button onClick={() => navigate("/upload")}>Upload project</Button>
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {active.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Up next</h2>
        {queued.length === 0 ? (
          <p className="text-sm text-muted-foreground">The queue is empty.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {queued.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
