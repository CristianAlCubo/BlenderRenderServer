import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { existsSync } from "node:fs";

import {
  JobsRepository,
  LogsRepository,
  OutputsRepository,
  WorkersRepository,
  type Db,
} from "@render-server/db";
import type {
  Job,
  JobOutput,
  JobLogEntry,
  LogLevel,
  OutputType,
} from "@render-server/shared";
import { CANCEL_CHANNEL } from "@render-server/shared";
import type { Queue } from "bullmq";

import type { AppConfig } from "../../config/index.js";
import type { RealtimeHub } from "../../realtime/hub.js";
import type { StoragePaths } from "../../storage/paths.js";
import { RENDER_QUEUE_NAME } from "../../queue/client.js";

export interface CreateJobParams {
  uploadId: string;
  originalFilename: string;
  projectPath: string;
  blendFilePath: string;
  renderMode: "CPU" | "GPU";
  computeMode: string | null;
}

export interface JobWithExtras extends Job {
  queuePosition: number | null;
  outputs: JobOutput[];
}

export class JobsService {
  private jobs: JobsRepository;
  private logs: LogsRepository;
  private outputs: OutputsRepository;
  private workers: WorkersRepository;

  constructor(
    db: Db,
    private config: AppConfig,
    private queue: Queue,
    private realtime: RealtimeHub,
    private storage: StoragePaths,
  ) {
    this.jobs = new JobsRepository(db);
    this.logs = new LogsRepository(db);
    this.outputs = new OutputsRepository(db);
    this.workers = new WorkersRepository(db);
  }

  private now(): string {
    return new Date().toISOString();
  }

  async createJob(params: CreateJobParams): Promise<Job> {
    const id = randomUUID();
    const job = await this.jobs.create({
      id,
      originalFilename: params.originalFilename,
      projectPath: params.projectPath,
      blendFilePath: params.blendFilePath,
      status: "QUEUED",
      progress: 0,
      currentFrame: 0,
      totalFrames: 0,
      renderEngine: "blender",
      computeMode: params.computeMode,
      renderMode: params.renderMode,
      createdAt: this.now(),
      startedAt: null,
      completedAt: null,
      errorMessage: null,
      createdBy: null,
      workerId: null,
    });

    await this.realtime.publish({
      type: "job.created",
      payload: { jobId: id },
      timestamp: this.now(),
    });

    await this.enqueue(job.id);

    return job as unknown as Job;
  }

  async enqueue(jobId: string): Promise<void> {
    const job = await this.jobs.findById(jobId);
    if (!job) throw new Error("Job not found");

    await this.queue.add(
      RENDER_QUEUE_NAME,
      {
        jobId: job.id,
        originalFilename: job.originalFilename,
        projectPath: job.projectPath,
        blendFilePath: job.blendFilePath,
        renderMode: job.renderMode as "CPU" | "GPU",
        computeMode: job.computeMode,
        outputType: this.inferOutputType(job),
        renderEngine: job.renderEngine,
      },
      {
        attempts: this.config.jobRetryAttempts,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 200,
        removeOnFail: 500,
      },
    );

    await this.realtime.publish({
      type: "job.queued",
      payload: { jobId },
      timestamp: this.now(),
    });
  }

  private inferOutputType(job: { status: string }): "IMAGE" | "VIDEO" {
    // Default to IMAGE unless project is an animation; refined by worker once
    // Blender metadata is known. Kept simple: single-frame renders produce IMAGE.
    return "IMAGE";
  }

  async list(options: { status?: string; limit: number; offset: number }) {
    const { items, total } = await this.jobs.list(options);
    const withExtras: JobWithExtras[] = [];
    for (const job of items) {
      const outputs = await this.outputs.listByJob(job.id);
      const position =
        job.status === "QUEUED" ? await this.jobs.queuePosition(job.id) : null;
      withExtras.push({ ...job, queuePosition: position, outputs } as JobWithExtras);
    }
    return { items: withExtras, total };
  }

  async get(jobId: string): Promise<JobWithExtras | null> {
    const job = await this.jobs.findById(jobId);
    if (!job) return null;
    const outputs = await this.outputs.listByJob(jobId);
    const position = job.status === "QUEUED" ? await this.jobs.queuePosition(jobId) : null;
    return { ...job, queuePosition: position, outputs } as JobWithExtras;
  }

  async cancel(jobId: string): Promise<{ ok: boolean; reason?: string }> {
    const job = await this.jobs.findById(jobId);
    if (!job) return { ok: false, reason: "not_found" };
    if (["COMPLETED", "FAILED", "CANCELLED"].includes(job.status)) {
      return { ok: false, reason: "terminal_state" };
    }

    // Remove queued BullMQ jobs
    await this.removeQueuedJob(jobId);

    // Signal an active worker to stop the running process
    await this.realtime.publishTo(CANCEL_CHANNEL, JSON.stringify({ jobId }));

    // Persist cancellation; worker also observes the cancelled flag.
    await this.jobs.update(jobId, {
      status: "CANCELLED",
      completedAt: this.now(),
    });

    await this.realtime.publish({
      type: "job.cancelled",
      payload: { jobId },
      timestamp: this.now(),
    });

    return { ok: true };
  }

  private async removeQueuedJob(jobId: string): Promise<void> {
    try {
      const jobs = await this.queue.getJobs(["waiting", "delayed", "paused"]);
      for (const j of jobs) {
        if (j.data?.jobId === jobId) {
          await j.remove();
        }
      }
    } catch {
      // Best effort
    }
  }

  async retry(jobId: string): Promise<{ ok: boolean; reason?: string }> {
    const job = await this.jobs.findById(jobId);
    if (!job) return { ok: false, reason: "not_found" };
    if (!["FAILED", "CANCELLED"].includes(job.status)) {
      return { ok: false, reason: "not_retryable" };
    }

    await this.jobs.update(jobId, {
      status: "QUEUED",
      progress: 0,
      currentFrame: 0,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
    });

    await this.outputs.deleteByJob(jobId);
    await this.enqueue(jobId);
    return { ok: true };
  }

  async getLogs(jobId: string): Promise<JobLogEntry[]> {
    const job = await this.jobs.findById(jobId);
    if (!job) return [];
    const logs = await this.logs.listByJob(jobId, { limit: 2000 });
    return logs.reverse().map((l) => ({
      id: l.id,
      jobId: l.jobId,
      level: l.level as LogLevel,
      message: l.message,
      createdAt: l.createdAt,
    }));
  }

  async getOutput(jobId: string): Promise<{ output: JobOutput; job: Job } | null> {
    const job = await this.jobs.findById(jobId);
    if (!job) return null;
    if (job.status !== "COMPLETED") return null;
    const output = await this.outputs.findPrimary(jobId);
    if (!output) return null;
    if (!existsSync(output.path)) return null;
    return {
      output: { ...output, type: output.type as OutputType } as JobOutput,
      job: job as Job,
    };
  }

  async delete(jobId: string): Promise<boolean> {
    const job = await this.jobs.findById(jobId);
    if (!job) return false;

    await this.removeQueuedJob(jobId);
    await this.jobs.delete(jobId);

    await rm(this.storage.projectDir(jobId), { recursive: true, force: true }).catch(() => {});
    await rm(this.storage.renderDir(jobId), { recursive: true, force: true }).catch(() => {});
    return true;
  }

  async transition(jobId: string, patch: Partial<Job>): Promise<void> {
    await this.jobs.update(jobId, patch);
  }

  async setWorker(jobId: string, workerId: string | null): Promise<void> {
    await this.jobs.update(jobId, { workerId });
  }
}
