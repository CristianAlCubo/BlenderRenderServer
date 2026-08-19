import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { dirname, basename } from "node:path";
import { mkdirSync, statSync } from "node:fs";

import { Worker } from "bullmq";
import { Redis } from "ioredis";

import {
  createDb,
  runMigrations,
  JobsRepository,
  LogsRepository,
  OutputsRepository,
  WorkersRepository,
} from "@render-server/db";
import type {
  RenderJobData,
  RenderResult,
  RealtimeEvent,
} from "@render-server/shared";
import { CANCEL_CHANNEL, REALTIME_CHANNEL } from "@render-server/shared";

import { loadConfig } from "./config.js";
import { BlenderRenderEngine, CancelError } from "./render-engine/blender.engine.js";
import { detectCompute } from "./compute.js";
import { EventPublisher, makeEvent } from "./realtime.js";

const RENDER_QUEUE_NAME = "render";
const HEARTBEAT_MS = 10_000;

class CancelSignalError extends Error {}

async function main(): Promise<void> {
  const config = loadConfig();

  // Database
  mkdirSync(dirname(config.databaseUrl), { recursive: true });
  const { db, raw } = createDb(config.databaseUrl);
  runMigrations(raw);

  const jobs = new JobsRepository(db);
  const logs = new LogsRepository(db);
  const outputs = new OutputsRepository(db);
  const workers = new WorkersRepository(db);

  // Redis
  const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
  const redisSub = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
  const publisher = new EventPublisher(redis);

  // Identity & capabilities (stable ID so a worker reuses its row across restarts)
  const workerId = config.workerName || hostname();
  const workerName = config.workerName || hostname();
  const compute = await detectCompute(config.blenderPath);
  const defaultMode =
    compute.computeModes.includes("NVIDIA_CUDA") || compute.computeModes.includes("NVIDIA_OPTIX")
      ? compute.computeModes.includes("NVIDIA_OPTIX")
        ? "NVIDIA_OPTIX"
        : "NVIDIA_CUDA"
      : "CPU";

  const engine = new BlenderRenderEngine(config.blenderPath);

  const registerOutput = async (jobId: string, result: RenderResult) => {
    for (const path of result.outputPaths) {
      const isVideo = result.outputType === "VIDEO";
      let size = 0;
      try {
        size = statSync(path).size;
      } catch {
        size = 0;
      }
      await outputs.create({
        id: randomUUID(),
        jobId,
        type: result.outputType,
        filename: basename(path),
        path,
        mimeType: isVideo ? "video/mp4" : "image/png",
        size,
        createdAt: new Date().toISOString(),
      });
    }
  };

  const logLine = (jobId: string, level: string, message: string) => {
    logs.create({
      id: randomUUID(),
      jobId,
      level,
      message,
      createdAt: new Date().toISOString(),
    });
    publisher.publish(
      makeEvent("job.log", { jobId, level, message }),
    );
  };

  const setStatus = async (jobId: string, patch: Record<string, unknown>) => {
    await jobs.update(jobId, patch);
  };

  const activeSignals = new Map<string, AbortController>();

  // Register worker + heartbeat
  const heartbeat = async () => {
    await workers.upsert({
      id: workerId,
      name: workerName,
      status: "ONLINE",
      computeMode: defaultMode,
      blenderVersion: compute.blenderVersion,
      lastHeartbeat: new Date().toISOString(),
      capabilities: JSON.stringify(compute.computeModes),
    });
  };

  await heartbeat();
  await publisher.publish(
    makeEvent("worker.online", { workerId, name: workerName, computeMode: defaultMode }),
  );

  const heartbeatTimer = setInterval(() => void heartbeat(), HEARTBEAT_MS);

  // Cancel signal subscription (non-blocking)
  void redisSub.subscribe(CANCEL_CHANNEL).catch(() => {
    console.warn("[worker] failed to subscribe to cancel channel");
  });
  redisSub.on("message", (channel, message) => {
    if (channel !== CANCEL_CHANNEL) return;
    try {
      const { jobId } = JSON.parse(message) as { jobId: string };
      const signal = activeSignals.get(jobId);
      if (signal) signal.abort();
    } catch {
      // ignore
    }
  });

  // BullMQ worker
  const bullWorker = new Worker<RenderJobData>(
    RENDER_QUEUE_NAME,
    async (job) => {
      const data = job.data;
      const jobId = data.jobId;

      const existing = await jobs.findById(jobId);
      if (!existing || existing.status === "CANCELLED") {
        throw new CancelSignalError();
      }

      const framesDir = `${config.dataDir}/renders/${jobId}/frames`;
      const renderDir = `${config.dataDir}/renders/${jobId}`;
      const logFilePath = `${config.dataDir}/projects/${jobId}/logs/render.log`;
      mkdirSync(framesDir, { recursive: true });
      mkdirSync(dirname(logFilePath), { recursive: true });

      const controller = new AbortController();
      activeSignals.set(jobId, controller);

      await setStatus(jobId, {
        status: "PREPARING",
        workerId,
        startedAt: new Date().toISOString(),
      });
      await workers.setCurrentJob(workerId, jobId);

      try {
        await setStatus(jobId, { status: "RENDERING" });
        await publisher.publish(makeEvent("job.started", { jobId }));

        const result: RenderResult = await engine.render(data, {
          blenderPath: config.blenderPath,
          ffmpegPath: config.ffmpegPath,
          framesDir,
          renderDir,
          logFilePath,
          computeMode: data.renderMode === "GPU" ? (data.computeMode ?? defaultMode) : "CPU",
          signal: controller.signal,
          onProgress: (info) => {
            void setStatus(jobId, {
              progress: info.progress,
              currentFrame: info.currentFrame,
              totalFrames: info.totalFrames,
            });
            void publisher.publish(
              makeEvent("job.progress", {
                jobId,
                progress: info.progress,
                currentFrame: info.currentFrame,
                totalFrames: info.totalFrames,
              }),
            );
          },
          onLog: (level, message) => {
            void logLine(jobId, level, message);
          },
          onEncoding: () => {
            void setStatus(jobId, { status: "ENCODING" });
            void publisher.publish(makeEvent("job.encoding", { jobId }));
          },
        });

        await registerOutput(jobId, result);
        await setStatus(jobId, {
          status: "COMPLETED",
          progress: 100,
          completedAt: new Date().toISOString(),
          errorMessage: null,
        });
        await publisher.publish(makeEvent("job.completed", { jobId }));
        return result;
      } catch (err) {
        if (
          err instanceof CancelError ||
          err instanceof CancelSignalError ||
          controller.signal.aborted
        ) {
          await setStatus(jobId, {
            status: "CANCELLED",
            completedAt: new Date().toISOString(),
          });
          await publisher.publish(makeEvent("job.cancelled", { jobId }));
          return { cancelled: true };
        }
        const message = err instanceof Error ? err.message : "render_failed";
        await logLine(jobId, "ERROR", message);
        throw err;
      } finally {
        activeSignals.delete(jobId);
        await workers.setCurrentJob(workerId, null);
      }
    },
    {
      connection: { url: config.redisUrl },
      concurrency: config.maxConcurrentRenders,
    },
  );

  bullWorker.on("failed", async (job, err) => {
    const jobId = (job?.data as RenderJobData | undefined)?.jobId;
    if (!jobId) return;
    const message = err instanceof Error ? err.message : "render_failed";
    await setStatus(jobId, {
      status: "FAILED",
      errorMessage: message,
      completedAt: new Date().toISOString(),
    });
    await publisher.publish(makeEvent("job.failed", { jobId }));
    await logLine(jobId, "ERROR", `Job failed: ${message}`);
  });

  const shutdown = async () => {
    clearInterval(heartbeatTimer);
    await publisher.publish(
      makeEvent("worker.offline", { workerId, name: workerName, computeMode: defaultMode }),
    );
    await bullWorker.close();
    await redisSub.unsubscribe(CANCEL_CHANNEL);
    await redis.quit();
    await redisSub.quit();
    raw.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  console.log(
    `[worker] ${workerName} online (${defaultMode}, concurrency=${config.maxConcurrentRenders})`,
  );
}

void main();
