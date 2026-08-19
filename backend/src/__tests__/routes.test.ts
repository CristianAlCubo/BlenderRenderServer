import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, afterEach } from "vitest";

import { buildApp, type AppDeps } from "../app.js";
import type { AppConfig } from "../config/index.js";

let dirs: string[] = [];

function makeConfig(): AppConfig {
  const dir = mkdtempSync(join(tmpdir(), "routes-test-"));
  dirs.push(dir);
  return {
    nodeEnv: "test",
    port: 3000,
    databaseUrl: join(dir, "app.db"),
    redisUrl: "redis://127.0.0.1:1",
    dataDir: dir,
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

function makeDeps(): Partial<AppDeps> {
  const redis = {
    ping: async () => "PONG",
    quit: async () => {},
    publish: async () => 0,
    subscribe: async () => {},
    unsubscribe: async () => {},
    on: () => {},
  } as never;
  const queue = {
    add: async () => ({ id: "1" }),
    getJobs: async () => [],
    close: async () => {},
  } as never;
  const realtime = {
    publish: async () => {},
    publishTo: async () => {},
    start: async () => {},
    stop: async () => {},
    addSocket: () => {},
  } as never;

  return { redis, redisSub: redis, redisPub: redis, queue, realtime };
}

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs = [];
});

describe("Fastify routes", () => {
  it("serves /api/health without external dependencies", async () => {
    const app = await buildApp({ config: makeConfig(), deps: makeDeps() });
    try {
      const res = await app.inject({ method: "GET", url: "/api/health" });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe("ok");
    } finally {
      await app.close();
    }
  });

  it("returns 404 for unknown routes with a JSON body", async () => {
    const app = await buildApp({ config: makeConfig(), deps: makeDeps() });
    try {
      const res = await app.inject({ method: "GET", url: "/api/nope" });
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe("not_found");
    } finally {
      await app.close();
    }
  });

  it("rejects an invalid create-job body with 400", async () => {
    const app = await buildApp({ config: makeConfig(), deps: makeDeps() });
    try {
      const res = await app.inject({
        method: "POST",
        url: "/api/jobs",
        payload: {},
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("validation_error");
    } finally {
      await app.close();
    }
  });

  it("returns 404 when creating a job from a missing upload", async () => {
    const app = await buildApp({ config: makeConfig(), deps: makeDeps() });
    try {
      const res = await app.inject({
        method: "POST",
        url: "/api/jobs",
        payload: { uploadId: "does-not-exist" },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe("upload_not_found");
    } finally {
      await app.close();
    }
  });

  it("returns an empty worker list", async () => {
    const app = await buildApp({ config: makeConfig(), deps: makeDeps() });
    try {
      const res = await app.inject({ method: "GET", url: "/api/workers" });
      expect(res.statusCode).toBe(200);
      expect(res.json().items).toEqual([]);
    } finally {
      await app.close();
    }
  });
});
