import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import Redis from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import type { AppConfig } from "../config/index.js";

const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const BLENDER = process.env.BLENDER_PATH ?? "/usr/bin/blender";
const FFMPEG = process.env.FFMPEG_PATH ?? "/usr/bin/ffmpeg";
const WORKER_DIST = resolve(__dirname, "../../../worker/dist/index.js");

async function redisAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const r = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy: () => null,
    });
    const timer = setTimeout(() => {
      r.disconnect();
      resolve(false);
    }, 3000);
    r.on("error", () => {});
    r.connect()
      .then(() => {
        clearTimeout(timer);
        r.disconnect();
        resolve(true);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(false);
      });
  });
}

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}`)),
    );
  });
}

describe("end-to-end render pipeline", () => {
  let dir: string;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let worker: ChildProcess | null = null;
  let baseUrl: string;
  let skip = false;

  beforeAll(async () => {
    const deps = await redisAvailable();
    const hasBlender = existsSync(BLENDER);
    const hasFfmpeg = existsSync(FFMPEG);
    const hasWorkerDist = existsSync(WORKER_DIST);

    if (!deps || !hasBlender || !hasFfmpeg || !hasWorkerDist) {
      skip = true;
      return;
    }

    dir = mkdtempSync(join(tmpdir(), "e2e-"));
    const config: AppConfig = {
      nodeEnv: "test",
      port: 0,
      databaseUrl: join(dir, "app.db"),
      redisUrl: REDIS_URL,
      dataDir: dir,
      blenderPath: BLENDER,
      ffmpegPath: FFMPEG,
      maxUploadSize: 10 * 1024 ** 3,
      maxConcurrentRenders: 1,
      defaultRenderMode: "CPU",
      jobRetryAttempts: 3,
      wsPath: "/api/ws",
      corsOrigin: false,
    };

    app = await buildApp({ config });
    await app.listen({ port: 0, host: "127.0.0.1" });
    void app.realtime.start().catch(() => {});
    const address = app.server.address();
    const port = typeof address === "object" && address ? address.port : 3000;
    baseUrl = `http://127.0.0.1:${port}`;

    worker = spawn("node", [WORKER_DIST], {
      env: {
        ...process.env,
        DATABASE_URL: join(dir, "app.db"),
        REDIS_URL,
        DATA_DIR: dir,
        BLENDER_PATH: BLENDER,
        FFMPEG_PATH: FFMPEG,
        WORKER_NAME: "e2e-worker",
      },
      stdio: "ignore",
    });
    await new Promise((r) => setTimeout(r, 1500));
  }, 60000);

  afterAll(async () => {
    if (worker) {
      worker.kill("SIGTERM");
      setTimeout(() => {
        if (worker && !worker.killed) worker.kill("SIGKILL");
      }, 3000);
    }
    if (app) await app.close();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("runs upload → render → encode → download", async () => {
    if (skip) {
      console.warn("e2e skipped: redis/blender/ffmpeg/worker dist not available");
      return;
    }

    // 1. Generate a tiny test .blend
    const blendPath = join(dir, "test.blend");
    await run(BLENDER, [
      "-b",
      "--python-expr",
      `import bpy; bpy.ops.mesh.primitive_cube_add(); bpy.context.scene.frame_start=1; bpy.context.scene.frame_end=2; bpy.context.scene.render.fps=24; bpy.context.scene.render.resolution_x=160; bpy.context.scene.render.resolution_y=90; bpy.ops.wm.save_as_mainfile(filepath='${blendPath}')`,
    ]);

    // 2. Upload
    const form = new FormData();
    form.append("file", new Blob([await (await import("node:fs/promises")).readFile(blendPath)]), "test.blend");
    const uploadRes = await fetch(`${baseUrl}/api/uploads`, { method: "POST", body: form });
    expect(uploadRes.status).toBe(201);
    const { uploadId } = (await uploadRes.json()) as { uploadId: string };

    // 3. Create job
    const jobRes = await fetch(`${baseUrl}/api/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadId }),
    });
    expect(jobRes.status).toBe(201);
    const job = (await jobRes.json()) as { id: string };
    expect(job.id).toBeTruthy();

    // 4. Poll until terminal state
    let finalStatus = "";
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      const res = await fetch(`${baseUrl}/api/jobs/${job.id}`);
      const data = (await res.json()) as { status: string };
      finalStatus = data.status;
      if (["COMPLETED", "FAILED", "CANCELLED"].includes(finalStatus)) break;
      await new Promise((r) => setTimeout(r, 2000));
    }

    expect(finalStatus).toBe("COMPLETED");

    // 5. Download output
    const outRes = await fetch(`${baseUrl}/api/jobs/${job.id}/output`);
    expect(outRes.status).toBe(200);
    const body = await outRes.arrayBuffer();
    expect(body.byteLength).toBeGreaterThan(0);
  }, 180000);
});
