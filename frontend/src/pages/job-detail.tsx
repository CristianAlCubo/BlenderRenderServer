import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Cpu,
  Download,
  Film,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/jobs/status-badge";
import { ErrorState } from "@/components/ui/empty-state";
import { formatBytes, formatDate, formatDuration } from "@/lib/utils";

const ACTIVE = ["QUEUED", "PREPARING", "RENDERING", "ENCODING"];

function Terminal({ lines }: { lines: Array<{ level: string; message: string; createdAt: string }> }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [lines.length]);

  return (
    <div
      ref={ref}
      className="h-64 overflow-y-auto rounded-md border border-border bg-surface-sunken p-3 font-mono text-xs leading-relaxed"
    >
      {lines.length === 0 ? (
        <p className="text-muted-foreground">No logs yet.</p>
      ) : (
        lines.map((line, i) => {
          const time = new Date(line.createdAt).toLocaleTimeString();
          const color =
            line.level === "ERROR"
              ? "text-destructive"
              : line.level === "WARN"
                ? "text-warning"
                : "text-foreground/80";
          return (
            <div key={i} className={color}>
              <span className="text-muted-foreground">[{time}]</span> {line.message}
            </div>
          );
        })
      )}
    </div>
  );
}

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const jobQuery = useQuery({
    queryKey: ["job", id],
    queryFn: () => api.getJob(id!),
    enabled: !!id,
  });

  const isActive = jobQuery.data ? ACTIVE.includes(jobQuery.data.status) : false;

  const logsQuery = useQuery({
    queryKey: ["logs", id],
    queryFn: () => api.getLogs(id!),
    enabled: !!id,
    refetchInterval: isActive ? 1500 : false,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["job", id] });
    void queryClient.invalidateQueries({ queryKey: ["jobs"] });
  };

  const cancel = useMutation({
    mutationFn: () => api.cancelJob(id!),
    onSuccess: () => {
      toast.success("Job cancelled");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to cancel"),
  });

  const retry = useMutation({
    mutationFn: () => api.retryJob(id!),
    onSuccess: () => {
      toast.success("Job re-queued");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to retry"),
  });

  const remove = useMutation({
    mutationFn: () => api.deleteJob(id!),
    onSuccess: () => {
      toast.success("Job deleted");
      navigate("/");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete"),
  });

  if (jobQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (jobQuery.isError || !jobQuery.data) {
    return <ErrorState message="Job not found" />;
  }

  const job = jobQuery.data;
  const output = job.outputs[0];
  const started = job.startedAt ? new Date(job.startedAt).getTime() : null;
  const completed = job.completedAt ? new Date(job.completedAt).getTime() : null;
  const elapsed = started ? Date.now() - started : 0;
  const eta =
    started && job.progress > 0 && isActive
      ? (elapsed / job.progress) * (100 - job.progress)
      : null;
  const renderTime = started && completed ? completed - started : null;

  const canDownload = job.status === "COMPLETED" && output;
  const canPreview = canDownload;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="truncate text-lg font-semibold">{job.originalFilename}</h1>
        <StatusBadge status={job.status} />
      </div>

      <div className="flex flex-wrap gap-2">
        {ACTIVE.includes(job.status) && (
          <Button variant="outline" size="sm" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
            <XCircle className="h-4 w-4" /> Cancel
          </Button>
        )}
        {["FAILED", "CANCELLED"].includes(job.status) && (
          <Button variant="outline" size="sm" onClick={() => retry.mutate()} disabled={retry.isPending}>
            <RotateCcw className="h-4 w-4" /> Retry
          </Button>
        )}
        {canDownload && (
          <a href={api.outputUrl(job.id)} download>
            <Button size="sm">
              <Download className="h-4 w-4" /> Download
            </Button>
          </a>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={remove.isPending}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this job?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete &quot;{job.originalFilename}&quot; and its
                rendered output. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => remove.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Render</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Progress value={job.progress} />
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {job.status === "RENDERING" || job.status === "ENCODING"
                    ? `Frame ${job.currentFrame} / ${job.totalFrames || "?"}`
                    : `${Math.round(job.progress)}%`}
                </span>
                {job.queuePosition && job.status === "QUEUED" && (
                  <span>Queue position #{job.queuePosition}</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <Meta label="Compute" value={job.computeMode ?? job.renderMode} />
              <Meta label="Frames" value={job.totalFrames ? String(job.totalFrames) : "—"} />
              {isActive ? (
                <>
                  <Meta label="Elapsed" value={started ? formatDuration(elapsed) : "—"} />
                  <Meta label="ETA" value={eta ? formatDuration(eta) : "—"} />
                </>
              ) : (
                <Meta
                  label="Render time"
                  value={renderTime ? formatDuration(renderTime) : "—"}
                />
              )}
              <Meta label="Created" value={formatDate(job.createdAt)} />
              <Meta label="Completed" value={formatDate(job.completedAt)} />
            </div>

            {job.errorMessage && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {job.errorMessage}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {canPreview ? (
              output.type === "VIDEO" ? (
                <video controls src={api.outputUrl(job.id)} className="w-full rounded-md" />
              ) : (
                <img
                  src={api.outputUrl(job.id)}
                  alt={output.filename}
                  className="w-full rounded-md"
                />
              )
            ) : (
              <div className="flex h-48 items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">
                Preview available when rendering completes
              </div>
            )}
            {output && (
              <p className="mt-2 text-xs text-muted-foreground">
                {output.filename} · {formatBytes(output.size)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Film className="h-4 w-4" /> Render log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logsQuery.isLoading ? (
            <Skeleton className="h-64" />
          ) : (
            <Terminal lines={logsQuery.data?.items ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium">{value}</p>
    </div>
  );
}
