import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import websocket from "@fastify/websocket";
import { Redis } from "ioredis";
import type { Queue } from "bullmq";

import { createDb, runMigrations } from "@render-server/db";

import { loadConfig, type AppConfig } from "./config/index.js";
import { createRenderQueue } from "./queue/client.js";
import { RealtimeHub } from "./realtime/hub.js";
import { StoragePaths } from "./storage/paths.js";
import { JobsService } from "./modules/jobs/jobs.service.js";
import { UploadsService } from "./modules/uploads/uploads.service.js";
import { WorkersService } from "./modules/workers/workers.service.js";
import { jobsRoutes } from "./modules/jobs/jobs.routes.js";
import { uploadsRoutes } from "./modules/uploads/uploads.routes.js";
import { workersRoutes } from "./modules/workers/workers.routes.js";
import { systemRoutes } from "./modules/system/system.routes.js";
import { websocketRoutes } from "./realtime/ws.js";

const WORKER_STALE_MS = 60_000;

export interface AppDeps {
  redis: Redis;
  redisSub: Redis;
  redisPub: Redis;
  queue: Queue;
  realtime: RealtimeHub;
}

export interface BuildAppOptions {
  config?: AppConfig;
  deps?: Partial<AppDeps>;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();

  // Storage
  const storage = new StoragePaths(config.dataDir);
  storage.ensureBase();

  // Database
  mkdirSync(dirname(config.databaseUrl), { recursive: true });
  const { db, raw } = createDb(config.databaseUrl);
  runMigrations(raw);

  // Redis (separate connections for pub/sub vs commands)
  const redis = options.deps?.redis ?? new Redis(config.redisUrl, { maxRetriesPerRequest: null });
  const redisSub = options.deps?.redisSub ?? new Redis(config.redisUrl, { maxRetriesPerRequest: null });
  const redisPub = options.deps?.redisPub ?? new Redis(config.redisUrl, { maxRetriesPerRequest: null });

  // Queue
  const queue = options.deps?.queue ?? createRenderQueue(config.redisUrl);

  // Realtime
  const realtime = options.deps?.realtime ?? new RealtimeHub(redisSub, redisPub);

  // Services
  const jobsService = new JobsService(db, config, queue, realtime, storage);
  const uploadsService = new UploadsService(config, storage);
  const workersService = new WorkersService(db);

  const app = Fastify({
    logger: {
      level: config.nodeEnv === "development" ? "info" : "warn",
    },
    bodyLimit: config.maxUploadSize,
  });

  // Plugins
  if (config.corsOrigin) {
    await app.register(cors, {
      origin: config.corsOrigin,
      credentials: true,
    });
  }
  await app.register(websocket);
  await app.register(multipart, {
    limits: {
      fileSize: config.maxUploadSize,
      files: 1,
    },
  });

  // Decorators
  app.decorate("config", config);
  app.decorate("db", db);
  app.decorate("redis", redis);
  app.decorate("redisSub", redisSub);
  app.decorate("queue", queue);
  app.decorate("realtime", realtime);
  app.decorate("storage", storage);
  app.decorate("jobsService", jobsService);
  app.decorate("uploadsService", uploadsService);
  app.decorate("workersService", workersService);

  // Error handler
  app.setErrorHandler((err: any, request, reply) => {
    request.log.error({ err }, "unhandled error");
    if (err.validation) {
      return reply.code(400).send({
        error: "validation_error",
        message: err.message,
      });
    }
    const statusCode = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    return reply.code(statusCode).send({
      error: err.code ?? "internal_error",
      message: statusCode === 500 ? undefined : err.message,
    });
  });

  // Not-found handler
  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({ error: "not_found", path: request.url });
  });

  // Routes
  await app.register(systemRoutes);
  await app.register(jobsRoutes);
  await app.register(uploadsRoutes);
  await app.register(workersRoutes);
  await app.register(websocketRoutes);

  // Worker offline sweep
  const sweep = setInterval(async () => {
    try {
      const staleBefore = new Date(Date.now() - WORKER_STALE_MS).toISOString();
      const before = await workersService.list();
      await workersService.markStale(staleBefore);
      const after = await workersService.list();
      const goneOffline = before.filter(
        (w) => w.status === "ONLINE" && after.find((a) => a.id === w.id)?.status === "OFFLINE",
      );
      for (const w of goneOffline) {
        await realtime.publish({
          type: "worker.offline",
          payload: { workerId: w.id, name: w.name, computeMode: w.computeMode },
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      // best effort
    }
  }, 15_000);
  sweep.unref?.();

  // Realtime subscription is started by the server entrypoint (not at build time)
  // so the app can be built for tests without a live Redis connection.

  // Cleanup
  app.addHook("onClose", async () => {
    clearInterval(sweep);
    await Promise.allSettled([
      realtime.stop(),
      queue.close(),
      redis.quit(),
      redisSub.quit(),
      redisPub.quit(),
    ]);
    raw.close();
  });

  return app;
}
