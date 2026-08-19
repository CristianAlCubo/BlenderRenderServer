import type {
  ComputeMode,
  JobStatus,
  LogLevel,
  OutputType,
  RenderMode,
  WorkerStatus,
} from "./enums.js";

export interface Job {
  id: string;
  originalFilename: string;
  projectPath: string;
  blendFilePath: string | null;
  status: JobStatus;
  progress: number;
  currentFrame: number;
  totalFrames: number;
  renderEngine: string;
  computeMode: ComputeMode | null;
  renderMode: RenderMode;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  createdBy: string | null;
  workerId: string | null;
}

export interface JobOutput {
  id: string;
  jobId: string;
  type: OutputType;
  filename: string;
  path: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface JobLogEntry {
  id: string;
  jobId: string;
  level: LogLevel;
  message: string;
  createdAt: string;
}

export interface WorkerInfo {
  id: string;
  name: string;
  status: WorkerStatus;
  computeMode: ComputeMode;
  blenderVersion: string | null;
  lastHeartbeat: string;
  currentJobId: string | null;
  capabilities: string[];
}

export interface SystemStatus {
  cpu: { usagePercent: number; cores: number; model: string };
  memory: { totalBytes: number; usedBytes: number; freeBytes: number };
  disk: { totalBytes: number; freeBytes: number; mount: string };
  gpu: GpuStatus | null;
  uptimeSeconds: number;
}

export interface GpuStatus {
  name: string;
  vramTotalBytes: number;
  vramUsedBytes: number;
  utilizationPercent: number;
  computeMode: "CUDA" | "OPTIX" | null;
}

export interface CreateJobInput {
  uploadId: string;
  renderMode?: RenderMode;
  computeMode?: ComputeMode;
}

export interface JobListQuery {
  status?: JobStatus;
  limit?: number;
  offset?: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
