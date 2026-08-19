import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createDb,
  runMigrations,
  JobsRepository,
  OutputsRepository,
  LogsRepository,
  WorkersRepository,
} from "@render-server/db";
import { describe, expect, it, beforeEach, afterEach } from "vitest";

describe("repositories", () => {
  let dir: string;
  let jobs: JobsRepository;
  let outputs: OutputsRepository;
  let logs: LogsRepository;
  let workers: WorkersRepository;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "repo-test-"));
    const { db, raw } = createDb(join(dir, "app.db"));
    runMigrations(raw);
    jobs = new JobsRepository(db);
    outputs = new OutputsRepository(db);
    logs = new LogsRepository(db);
    workers = new WorkersRepository(db);
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const now = new Date().toISOString();

  it("creates and reads a job", async () => {
    await jobs.create({
      id: "j1",
      originalFilename: "scene.blend",
      projectPath: "/data/projects/j1",
      blendFilePath: "/data/projects/j1/scene.blend",
      status: "QUEUED",
      progress: 0,
      currentFrame: 0,
      totalFrames: 0,
      renderEngine: "blender",
      computeMode: null,
      renderMode: "CPU",
      createdAt: now,
    });
    const job = await jobs.findById("j1");
    expect(job?.originalFilename).toBe("scene.blend");
    expect(job?.status).toBe("QUEUED");
  });

  it("updates job state and returns it", async () => {
    await jobs.create({
      id: "j1",
      originalFilename: "scene.blend",
      projectPath: "/data/projects/j1",
      blendFilePath: null,
      status: "QUEUED",
      progress: 0,
      currentFrame: 0,
      totalFrames: 0,
      renderEngine: "blender",
      computeMode: null,
      renderMode: "CPU",
      createdAt: now,
    });
    await jobs.update("j1", { status: "COMPLETED", progress: 100 });
    const job = await jobs.findById("j1");
    expect(job?.status).toBe("COMPLETED");
    expect(job?.progress).toBe(100);
  });

  it("registers outputs and logs, then clears them on delete", async () => {
    await jobs.create({
      id: "j1",
      originalFilename: "scene.blend",
      projectPath: "/data/projects/j1",
      blendFilePath: null,
      status: "COMPLETED",
      progress: 100,
      currentFrame: 0,
      totalFrames: 1,
      renderEngine: "blender",
      computeMode: null,
      renderMode: "CPU",
      createdAt: now,
    });
    await outputs.create({
      id: "o1",
      jobId: "j1",
      type: "VIDEO",
      filename: "output.mp4",
      path: "/data/renders/j1/output.mp4",
      mimeType: "video/mp4",
      size: 1234,
      createdAt: now,
    });
    await logs.create({
      id: "l1",
      jobId: "j1",
      level: "INFO",
      message: "hello",
      createdAt: now,
    });

    const out = await outputs.listByJob("j1");
    const logList = await logs.listByJob("j1");
    expect(out).toHaveLength(1);
    expect(logList).toHaveLength(1);
    expect(out[0].type).toBe("VIDEO");

    await jobs.delete("j1");
    expect(await jobs.findById("j1")).toBeUndefined();
  });

  it("upserts worker registration and lists workers", async () => {
    await workers.upsert({
      id: "w1",
      name: "render-01",
      status: "ONLINE",
      computeMode: "CPU",
      blenderVersion: "4.3",
      lastHeartbeat: now,
      capabilities: "[\"CPU\"]",
    });
    await workers.upsert({
      id: "w1",
      name: "render-01",
      status: "ONLINE",
      computeMode: "CPU",
      blenderVersion: "5.1.2",
      lastHeartbeat: now,
      capabilities: "[\"CPU\"]",
    });
    await workers.setCurrentJob("w1", "j1");

    const list = await workers.list();
    expect(list).toHaveLength(1);
    expect(list[0].blenderVersion).toBe("5.1.2");
    expect(list[0].currentJobId).toBe("j1");
  });
});
