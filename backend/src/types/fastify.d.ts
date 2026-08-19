import type { Redis } from "ioredis";
import type { Queue } from "bullmq";

import type { Db } from "@render-server/db";
import type { AppConfig } from "../config/index.js";
import type { RealtimeHub } from "../realtime/hub.js";
import type { StoragePaths } from "../storage/paths.js";

declare module "fastify" {
  interface FastifyInstance {
    config: AppConfig;
    db: Db;
    redis: Redis;
    redisSub: Redis;
    queue: Queue;
    realtime: RealtimeHub;
    storage: StoragePaths;
    jobsService: import("../modules/jobs/jobs.service.js").JobsService;
    uploadsService: import("../modules/uploads/uploads.service.js").UploadsService;
    workersService: import("../modules/workers/workers.service.js").WorkersService;
  }
}