import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDb, runMigrations } from "@render-server/db";
import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { JobsService } from "../modules/jobs/jobs.service.js";
import { StoragePaths } from "../storage/paths.js";
import type { AppConfig } from "../config/index.js";

function makeConfig(dataDir: string): AppConfig {
  return {
    nodeEnv: "test",
    port: 3000,
    databaseUrl: join(dataDir, "app.db"),
    redisUrl: "redis://localhost:6379",
    dataDir,
    blenderPath: "/usr/bin/blender",
    ffmpegPath: "/usr/bin/ffmpeg",
    maxUploadSize: 10 * 1024 ** 3,
    maxConcurrentRenders: 1,
    defaultRenderMode: "CPU",
    jobRetryAttempts: 3,
    wsPath: "/api/ws",
    corsOrigin: false,
  };
}

function makeMockQueue() {
  const added: Array<{ name: string; data: unknown; opts: unknown }> = [];
  return {
    added,
    add: async (name: string, data: unknown, opts: unknown) => {
      added.push({ name, data, opts });
      return { id: "queue-job-1" };
    },
    getJobs: async () => [],
    close: async () => {},
  };
}

describe("JobsService", () => {
  let dir: string;
  let service: JobsService;
  let queue: ReturnType<typeof makeMockQueue>;
  let published: Array<{ type: string }>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "jobs-test-"));
    const { db, raw } = createDb(join(dir, "app.db"));
    runMigrations(raw);
    const config = makeConfig(dir);
    const storage = new StoragePaths(dir);
    storage.ensureBase();
    queue = makeMockQueue();
    published = [];
    const realtime = {
      publish: async (e: { type: string }) => {
        published.push(e);
      },
      publishTo: async () => {},
    };
    service = new JobsService(db, config, queue as never, realtime as never, storage);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates a job, persists it, and enqueues it", async () => {
    const job = await service.createJob({
      uploadId: "upload-1",
      originalFilename: "scene.blend",
      projectPath: join(dir, "projects/upload-1"),
      blendFilePath: join(dir, "projects/upload-1/scene.blend"),
      renderMode: "CPU",
      computeMode: null,
    });

    expect(job.id).toBeTruthy();
    expect(job.status).toBe("QUEUED");
    expect(queue.added).toHaveLength(1);
    expect(queue.added[0].name).toBe("render");
    expect(published.map((p) => p.type)).toContain("job.created");
    expect(published.map((p) => p.type)).toContain("job.queued");
  });

  it("lists jobs and computes queue position for queued jobs", async () => {
    const a = await service.createJob({
      uploadId: "u1",
      originalFilename: "a.blend",
      projectPath: join(dir, "a"),
      blendFilePath: join(dir, "a/a.blend"),
      renderMode: "CPU",
      computeMode: null,
    });
    const b = await service.createJob({
      uploadId: "u2",
      originalFilename: "b.blend",
      projectPath: join(dir, "b"),
      blendFilePath: join(dir, "b/b.blend"),
      renderMode: "CPU",
      computeMode: null,
    });

    const { items, total } = await service.list({ limit: 10, offset: 0 });
    expect(total).toBe(2);
    const jobA = items.find((i) => i.id === a.id)!;
    const jobB = items.find((i) => i.id === b.id)!;
    expect(jobA.queuePosition).toBe(1);
    expect(jobB.queuePosition).toBe(2);
  });

  it("cancels a queued job and transitions state", async () => {
    const job = await service.createJob({
      uploadId: "u1",
      originalFilename: "a.blend",
      projectPath: join(dir, "a"),
      blendFilePath: join(dir, "a/a.blend"),
      renderMode: "CPU",
      computeMode: null,
    });

    const result = await service.cancel(job.id);
    expect(result.ok).toBe(true);

    const fetched = await service.get(job.id);
    expect(fetched?.status).toBe("CANCELLED");
    expect(published.map((p) => p.type)).toContain("job.cancelled");
  });

  it("rejects cancelling a completed job", async () => {
    const job = await service.createJob({
      uploadId: "u1",
      originalFilename: "a.blend",
      projectPath: join(dir, "a"),
      blendFilePath: join(dir, "a/a.blend"),
      renderMode: "CPU",
      computeMode: null,
    });
    await service.transition(job.id, { status: "COMPLETED" });

    const result = await service.cancel(job.id);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("terminal_state");
  });

  it("retries a failed job, resetting state and re-enqueueing", async () => {
    const job = await service.createJob({
      uploadId: "u1",
      originalFilename: "a.blend",
      projectPath: join(dir, "a"),
      blendFilePath: join(dir, "a/a.blend"),
      renderMode: "CPU",
      computeMode: null,
    });
    await service.transition(job.id, { status: "FAILED", errorMessage: "boom" });

    const result = await service.retry(job.id);
    expect(result.ok).toBe(true);

    const fetched = await service.get(job.id);
    expect(fetched?.status).toBe("QUEUED");
    expect(fetched?.errorMessage).toBeNull();
    expect(queue.added).toHaveLength(2);
  });

  it("rejects retrying a non-failed job", async () => {
    const job = await service.createJob({
      uploadId: "u1",
      originalFilename: "a.blend",
      projectPath: join(dir, "a"),
      blendFilePath: join(dir, "a/a.blend"),
      renderMode: "CPU",
      computeMode: null,
    });

    const result = await service.retry(job.id);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("not_retryable");
  });

  it("returns null output for non-completed jobs", async () => {
    const job = await service.createJob({
      uploadId: "u1",
      originalFilename: "a.blend",
      projectPath: join(dir, "a"),
      blendFilePath: join(dir, "a/a.blend"),
      renderMode: "CPU",
      computeMode: null,
    });

    expect(await service.getOutput(job.id)).toBeNull();
  });
});
