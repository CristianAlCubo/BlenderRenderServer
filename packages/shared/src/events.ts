export type JobEventType =
  | "job.created"
  | "job.queued"
  | "job.started"
  | "job.progress"
  | "job.log"
  | "job.encoding"
  | "job.completed"
  | "job.failed"
  | "job.cancelled";

export type WorkerEventType = "worker.online" | "worker.offline";

export type RealtimeEventType = JobEventType | WorkerEventType;

export interface RealtimeEvent<T = unknown> {
  type: RealtimeEventType;
  payload: T;
  timestamp: string;
}

export interface JobProgressPayload {
  jobId: string;
  progress: number;
  currentFrame: number;
  totalFrames: number;
}

export interface JobLogPayload {
  jobId: string;
  level: string;
  message: string;
}

export interface JobEventPayload {
  jobId: string;
}

export interface WorkerEventPayload {
  workerId: string;
  name: string;
  computeMode: string;
}

export const REALTIME_CHANNEL = "render-server:events";

export const CANCEL_CHANNEL = "render-server:cancel";
