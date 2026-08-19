import type { FastifyInstance } from "fastify";
import si from "systeminformation";

import type { SystemStatus } from "@render-server/shared";

async function collectStatus(): Promise<SystemStatus> {
  let cpu = { usagePercent: 0, cores: 0, model: "" };
  let memory = { totalBytes: 0, usedBytes: 0, freeBytes: 0 };
  let disk = { totalBytes: 0, freeBytes: 0, mount: "" };
  let gpu: SystemStatus["gpu"] = null;
  let uptimeSeconds = 0;

  try {
    const [cpuLoad, cpuInfo, mem, fs, time, gfx] = await Promise.all([
      si.currentLoad(),
      si.cpu(),
      si.mem(),
      si.fsSize(),
      si.time(),
      si.graphics().catch(() => ({ controllers: [] })),
    ]);

    cpu = {
      usagePercent: Math.round(cpuLoad.currentLoad),
      cores: cpuInfo.cores,
      model: `${cpuInfo.manufacturer} ${cpuInfo.brand}`.trim(),
    };
    memory = {
      totalBytes: mem.total,
      usedBytes: mem.used,
      freeBytes: mem.free,
    };
    if (fs[0]) {
      disk = {
        totalBytes: fs[0].size,
        freeBytes: fs[0].available,
        mount: fs[0].mount,
      };
    }
    uptimeSeconds = time.uptime;

    const nvidia = gfx.controllers?.find(
      (c: any) => c.vendor?.toLowerCase().includes("nvidia"),
    );
    if (nvidia) {
      gpu = {
        name: `${nvidia.vendor} ${nvidia.model}`.trim(),
        vramTotalBytes: (nvidia.vram ?? 0) * 1024 * 1024,
        vramUsedBytes: 0,
        utilizationPercent: Math.round(nvidia.utilizationGpu ?? 0),
        computeMode: null,
      };
    }
  } catch {
    // fall through with defaults; monitoring is best-effort
  }

  return { cpu, memory, disk, gpu, uptimeSeconds };
}

export async function systemRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/health", async () => {
    return { status: "ok", uptime: process.uptime() };
  });

  app.get("/api/ready", async (_request, reply) => {
    const checks: Record<string, boolean> = {
      sqlite: true,
      redis: false,
    };

    try {
      await app.redis.ping();
      checks.redis = true;
    } catch {
      checks.redis = false;
    }

    const ready = Object.values(checks).every(Boolean);
    return reply.code(ready ? 200 : 503).send({ ready, checks });
  });

  app.get("/api/system/status", async () => {
    return collectStatus();
  });
}
