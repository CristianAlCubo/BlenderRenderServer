import { useNavigate } from "react-router-dom";
import { Wifi, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useRealtime } from "@/hooks/use-realtime";
import { cn } from "@/lib/utils";

export function ConnectionStatus() {
  const { connected } = useRealtime();
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs font-medium",
        connected ? "text-emerald-500" : "text-amber-500",
      )}
    >
      {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      {connected ? "Live" : "Reconnecting"}
    </div>
  );
}

export function NewJobButton() {
  const navigate = useNavigate();
  return (
    <Button size="sm" onClick={() => navigate("/upload")}>
      New Job
    </Button>
  );
}
