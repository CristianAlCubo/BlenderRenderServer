import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { z } from "zod";

function parseSize(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const m = value.trim().toUpperCase().match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)?$/);
  if (!m) return fallback;
  const num = Number(m[1]);
  const unit = m[2] ?? "B";
  const mult: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 ** 2,
    GB: 1024 ** 3,
    TB: 1024 ** 4,
  };
  return Math.floor(num * (mult[unit] ?? 1));
}

const envSchema = z.object({
  NODE_ENV: z.string().default("production"),
  BACKEND_PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().default("/data/database/app.db"),
  REDIS_URL: z.string().default("redis://blender-redis:6379"),
  DATA_DIR: z.string().default("/data"),
  BLENDER_PATH: z.string().default("/opt/blender/blender"),
  FFMPEG_PATH: z.string().default("/usr/bin/ffmpeg"),
  MAX_UPLOAD_SIZE: z.string().default("10GB"),
  MAX_CONCURRENT_RENDERS: z.coerce.number().int().positive().default(1),
  DEFAULT_RENDER_MODE: z.enum(["CPU", "GPU"]).default("CPU"),
  JOB_RETRY_ATTEMPTS: z.coerce.number().int().min(0).default(3),
  WS_PATH: z.string().default("/api/ws"),
  CORS_ORIGIN: z.string().default(""),
});

export type AppConfig = {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  redisUrl: string;
  dataDir: string;
  blenderPath: string;
  ffmpegPath: string;
  maxUploadSize: number;
  maxConcurrentRenders: number;
  defaultRenderMode: "CPU" | "GPU";
  jobRetryAttempts: number;
  wsPath: string;
  corsOrigin: string | false;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);

  const dataDir = resolve(parsed.DATA_DIR);

  if (!existsSync(dataDir)) {
    // Created lazily by storage module; resolving early keeps paths stable.
  }

  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.BACKEND_PORT,
    databaseUrl: parsed.DATABASE_URL.startsWith("/")
      ? parsed.DATABASE_URL
      : resolve(dataDir, parsed.DATABASE_URL),
    redisUrl: parsed.REDIS_URL,
    dataDir,
    blenderPath: parsed.BLENDER_PATH,
    ffmpegPath: parsed.FFMPEG_PATH,
    maxUploadSize: parseSize(parsed.MAX_UPLOAD_SIZE, 10 * 1024 ** 3),
    maxConcurrentRenders: parsed.MAX_CONCURRENT_RENDERS,
    defaultRenderMode: parsed.DEFAULT_RENDER_MODE,
    jobRetryAttempts: parsed.JOB_RETRY_ATTEMPTS,
    wsPath: parsed.WS_PATH,
    corsOrigin: parsed.CORS_ORIGIN ? parsed.CORS_ORIGIN : false,
  };
}
