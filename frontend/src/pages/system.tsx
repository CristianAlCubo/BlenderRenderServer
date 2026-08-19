import { useQuery } from "@tanstack/react-query";
import { Cpu, HardDrive, MemoryStick } from "lucide-react";

import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, PageHeader } from "@/components/ui/empty-state";
import { formatBytes, formatDuration } from "@/lib/utils";

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function SystemPage() {
  const status = useQuery({ queryKey: ["system"], queryFn: () => api.systemStatus(), refetchInterval: 5000 });

  if (status.isLoading) return <Skeleton className="h-40" />;
  if (status.isError) return <ErrorState message="Could not load system status" />;

  const s = status.data!;
  const usedRam = s.memory.totalBytes - s.memory.freeBytes;

  return (
    <div className="space-y-4">
      <PageHeader title="System" description="Host and render resources" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Metric
          icon={<Cpu className="h-4 w-4" />}
          label={`CPU · ${s.cpu.cores} cores`}
          value={`${s.cpu.usagePercent}%`}
        />
        <Metric
          icon={<MemoryStick className="h-4 w-4" />}
          label="RAM"
          value={`${formatBytes(usedRam)} / ${formatBytes(s.memory.totalBytes)}`}
        />
        <Metric
          icon={<HardDrive className="h-4 w-4" />}
          label={`Disk · ${s.disk.mount || "/"}`}
          value={`${formatBytes(s.disk.freeBytes)} free`}
        />
        <Metric
          icon={<Cpu className="h-4 w-4" />}
          label="Uptime"
          value={formatDuration(s.uptimeSeconds * 1000)}
        />
      </div>

      {s.gpu && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">GPU</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Device</p>
              <p className="text-sm font-medium">{s.gpu.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">VRAM</p>
              <p className="text-sm font-medium">
                {formatBytes(s.gpu.vramUsedBytes)} / {formatBytes(s.gpu.vramTotalBytes)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Utilization</p>
              <p className="text-sm font-medium">{s.gpu.utilizationPercent}%</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
