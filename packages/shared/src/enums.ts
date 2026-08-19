export const JOB_STATUSES = [
  "QUEUED",
  "PREPARING",
  "RENDERING",
  "ENCODING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const COMPUTE_MODES = ["CPU", "NVIDIA_CUDA", "NVIDIA_OPTIX"] as const;

export type ComputeMode = (typeof COMPUTE_MODES)[number];

export const OUTPUT_TYPES = ["IMAGE", "VIDEO"] as const;

export type OutputType = (typeof OUTPUT_TYPES)[number];

export const WORKER_STATUSES = ["ONLINE", "OFFLINE"] as const;

export type WorkerStatus = (typeof WORKER_STATUSES)[number];

export const RENDER_MODES = ["CPU", "GPU"] as const;

export type RenderMode = (typeof RENDER_MODES)[number];

export const LOG_LEVELS = ["DEBUG", "INFO", "WARN", "ERROR"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export const TERMINAL_STATES: JobStatus[] = ["COMPLETED", "FAILED", "CANCELLED"];

export const ACTIVE_STATES: JobStatus[] = ["QUEUED", "PREPARING", "RENDERING", "ENCODING"];
