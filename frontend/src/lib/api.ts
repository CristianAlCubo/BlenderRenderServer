import type {
  Job,
  JobLogEntry,
  JobStatus,
  SystemStatus,
  WorkerInfo,
} from "@render-server/shared";

export interface JobWithExtras extends Job {
  queuePosition: number | null;
  outputs: Array<{
    id: string;
    jobId: string;
    type: "IMAGE" | "VIDEO";
    filename: string;
    path: string;
    mimeType: string;
    size: number;
    createdAt: string;
  }>;
}

export interface JobListResponse {
  items: JobWithExtras[];
  total: number;
}

export interface WorkerListResponse {
  items: WorkerInfo[];
}

export interface LogsResponse {
  items: JobLogEntry[];
}

export interface UploadResponse {
  uploadId: string;
  originalFilename: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body != null;
  const isForm = init?.body instanceof FormData;

  const headers = new Headers(init?.headers);
  if (hasBody && !isForm && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(path, { ...init, headers });

  if (!res.ok) {
    let code = "request_failed";
    let message: string | undefined;
    try {
      const body = await res.json();
      code = body.error ?? code;
      message = body.message;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, code, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  listJobs(status?: JobStatus, limit = 100, offset = 0): Promise<JobListResponse> {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    return request<JobListResponse>(`/api/jobs?${params.toString()}`);
  },

  getJob(id: string): Promise<JobWithExtras> {
    return request<JobWithExtras>(`/api/jobs/${id}`);
  },

  createJob(uploadId: string, renderMode?: "CPU" | "GPU", computeMode?: string) {
    return request<Job>(`/api/jobs`, {
      method: "POST",
      body: JSON.stringify({ uploadId, renderMode, computeMode }),
    });
  },

  cancelJob(id: string): Promise<{ ok: boolean }> {
    return request(`/api/jobs/${id}/cancel`, { method: "POST" });
  },

  retryJob(id: string): Promise<{ ok: boolean }> {
    return request(`/api/jobs/${id}/retry`, { method: "POST" });
  },

  deleteJob(id: string): Promise<void> {
    return request(`/api/jobs/${id}`, { method: "DELETE" });
  },

  getLogs(id: string): Promise<LogsResponse> {
    return request(`/api/jobs/${id}/logs`);
  },

  outputUrl(id: string): string {
    return `/api/jobs/${id}/output`;
  },

  uploadFile(file: File): Promise<UploadResponse> {
    const form = new FormData();
    form.append("file", file);
    return request<UploadResponse>(`/api/uploads`, { method: "POST", body: form });
  },

  listWorkers(): Promise<WorkerListResponse> {
    return request(`/api/workers`);
  },

  systemStatus(): Promise<SystemStatus> {
    return request(`/api/system/status`);
  },

  health(): Promise<{ status: string }> {
    return request(`/api/health`);
  },
};
