import type { JobStatus } from "@render-server/shared";

import { Badge } from "@/components/ui/badge";

const STATUS_META: Record<JobStatus, { label: string; variant: "success" | "warning" | "info" | "destructive" | "muted" | "secondary" }> = {
  QUEUED: { label: "Queued", variant: "secondary" },
  PREPARING: { label: "Preparing", variant: "info" },
  RENDERING: { label: "Rendering", variant: "info" },
  ENCODING: { label: "Encoding", variant: "warning" },
  COMPLETED: { label: "Completed", variant: "success" },
  FAILED: { label: "Failed", variant: "destructive" },
  CANCELLED: { label: "Cancelled", variant: "muted" },
};

export function StatusBadge({ status }: { status: JobStatus }) {
  const meta = STATUS_META[status] ?? { label: status, variant: "muted" as const };
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}
