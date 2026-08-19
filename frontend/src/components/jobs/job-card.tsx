import { Link } from "react-router-dom";
import { Cpu, Clock, Film } from "lucide-react";

import type { JobWithExtras } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "./status-badge";
import { formatDuration, timeAgo } from "@/lib/utils";

export function JobCard({ job }: { job: JobWithExtras }) {
  const isActive = ["QUEUED", "PREPARING", "RENDERING", "ENCODING"].includes(job.status);
  const duration = job.startedAt
    ? Date.now() - new Date(job.startedAt).getTime()
    : 0;

  return (
    <Link to={`/jobs/${job.id}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{job.originalFilename}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">#{job.id.slice(0, 8)}</p>
            </div>
            <StatusBadge status={job.status} />
          </div>

          {isActive && (
            <div className="mt-3">
              <Progress value={job.progress} />
              <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {job.status === "RENDERING" || job.status === "ENCODING"
                    ? `Frame ${job.currentFrame} / ${job.totalFrames || "?"}`
                    : job.queuePosition
                      ? `Position #${job.queuePosition}`
                      : "Waiting"}
                </span>
                <span>{Math.round(job.progress)}%</span>
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Cpu className="h-3 w-3" />
              {job.computeMode ?? job.renderMode}
            </span>
            <span className="inline-flex items-center gap-1">
              <Film className="h-3 w-3" />
              {job.totalFrames ? `${job.totalFrames} frames` : "—"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {isActive && job.startedAt ? formatDuration(duration) : timeAgo(job.createdAt)}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
