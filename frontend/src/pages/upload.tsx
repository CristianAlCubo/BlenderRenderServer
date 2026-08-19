import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { UploadCloud, X } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const ACCEPTED = [".blend", ".zip"];

type Stage = "idle" | "uploading" | "validating" | "preparing" | "queued";

function uploadWithProgress(file: File, onProgress: (pct: number) => void): Promise<{ uploadId: string }> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/uploads");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        let code = "upload_failed";
        try {
          code = JSON.parse(xhr.responseText).error ?? code;
        } catch {
          // ignore
        }
        reject(new Error(code));
      }
    };
    xhr.onerror = () => reject(new Error("upload_failed"));
    xhr.send(form);
  });
}

export function UploadPage() {
  const navigate = useNavigate();
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<Stage>("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  const createJob = useMutation({
    mutationFn: (uploadId: string) => api.createJob(uploadId),
    onSuccess: (job) => {
      setStage("queued");
      toast.success("Job queued");
      navigate(`/jobs/${job.id}`);
    },
    onError: (err) => {
      setStage("idle");
      toast.error(err instanceof Error ? err.message : "Failed to create job");
    },
  });

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const f = Array.from(files)[0];
      if (!f) return;
      const ext = "." + f.name.split(".").pop()?.toLowerCase();
      if (!ACCEPTED.includes(ext)) {
        toast.error("Only .blend and .zip files are supported");
        return;
      }
      setFile(f);
      setProgress(0);
      setStage("uploading");
      try {
        const { uploadId } = await uploadWithProgress(f, setProgress);
        setStage("preparing");
        createJob.mutate(uploadId);
      } catch (err) {
        setStage("idle");
        toast.error(err instanceof Error ? err.message : "Upload failed");
      }
    },
    [createJob],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      void handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const stageLabel: Record<Stage, string> = {
    idle: "Drop a file to begin",
    uploading: `Uploading ${file?.name ?? ""}`,
    validating: "Validating",
    preparing: "Preparing project",
    queued: "Queued",
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">New render job</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a .blend file or a .zip containing your scene and assets.
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed py-16 transition-colors",
              dragging ? "border-primary bg-accent" : "border-muted-foreground/25 hover:bg-accent",
            )}
          >
            <UploadCloud className="h-10 w-10 text-muted-foreground" />
            <p className="mt-4 text-sm font-medium">{stageLabel[stage]}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Drag & drop or click to browse — .blend, .zip
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".blend,.zip"
              className="hidden"
              onChange={(e) => e.target.files && void handleFiles(e.target.files)}
            />
          </div>

          {stage !== "idle" && (
            <div className="mt-4">
              <Progress value={stage === "uploading" ? progress : stage === "queued" ? 100 : 60} />
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {stage === "uploading" ? `${progress}%` : stage === "queued" ? "Done" : "Processing"}
                </span>
                {file && (
                  <button
                    onClick={() => {
                      setFile(null);
                      setStage("idle");
                      setProgress(0);
                    }}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    <X className="h-3 w-3" /> {file.name}
                  </button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        Flow: Upload → Validate → Prepare → Queued. You'll be redirected to the job page when it
        enters the queue.
      </div>
    </div>
  );
}
