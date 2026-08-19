import { useQuery } from "@tanstack/react-query";
import { Cpu } from "lucide-react";

import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState, PageHeader } from "@/components/ui/empty-state";
import { timeAgo } from "@/lib/utils";

export function WorkersPage() {
  const workers = useQuery({ queryKey: ["workers"], queryFn: () => api.listWorkers() });

  return (
    <div className="space-y-4">
      <PageHeader title="Workers" description="Render workers consuming the queue" />

      {workers.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : workers.isError ? (
        <ErrorState message="Could not load workers" />
      ) : (workers.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="No workers online" description="Workers appear here once they connect." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {workers.data!.items.map((w) => (
            <Card key={w.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{w.name}</span>
                  </div>
                  <Badge variant={w.status === "ONLINE" ? "success" : "muted"}>
                    {w.status}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Compute: {w.computeMode}</span>
                  <span>Blender {w.blenderVersion ?? "—"}</span>
                  <span>Heartbeat {timeAgo(w.lastHeartbeat)}</span>
                  {w.currentJobId && <span>Job #{w.currentJobId.slice(0, 8)}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
