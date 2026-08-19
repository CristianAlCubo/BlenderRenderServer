import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().default("production"),
  DATABASE_URL: z.string().default("/data/database/app.db"),
  REDIS_URL: z.string().default("redis://blender-redis:6379"),
  DATA_DIR: z.string().default("/data"),
  BLENDER_PATH: z.string().default("/opt/blender/blender"),
  FFMPEG_PATH: z.string().default("/usr/bin/ffmpeg"),
  MAX_CONCURRENT_RENDERS: z.coerce.number().int().positive().default(1),
  DEFAULT_RENDER_MODE: z.enum(["CPU", "GPU"]).default("CPU"),
  JOB_RETRY_ATTEMPTS: z.coerce.number().int().min(0).default(3),
  WORKER_NAME: z.string().default("render-server-01"),
});

export type WorkerConfig = {
  nodeEnv: string;
  databaseUrl: string;
  redisUrl: string;
  dataDir: string;
  blenderPath: string;
  ffmpegPath: string;
  maxConcurrentRenders: number;
  defaultRenderMode: "CPU" | "GPU";
  jobRetryAttempts: number;
  workerName: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const parsed = envSchema.parse(env);
  return {
    nodeEnv: parsed.NODE_ENV,
    databaseUrl: parsed.DATABASE_URL,
    redisUrl: parsed.REDIS_URL,
    dataDir: parsed.DATA_DIR,
    blenderPath: parsed.BLENDER_PATH,
    ffmpegPath: parsed.FFMPEG_PATH,
    maxConcurrentRenders: parsed.MAX_CONCURRENT_RENDERS,
    defaultRenderMode: parsed.DEFAULT_RENDER_MODE,
    jobRetryAttempts: parsed.JOB_RETRY_ATTEMPTS,
    workerName: parsed.WORKER_NAME,
  };
}
