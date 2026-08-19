import { desc, eq } from "drizzle-orm";

import type { Db } from "../client.js";
import { jobLogs, jobOutputs, type NewJobLog, type NewJobOutput } from "../schema.js";

export class OutputsRepository {
  constructor(private db: Db) {}

  async create(output: NewJobOutput): Promise<void> {
    await this.db.insert(jobOutputs).values(output).run();
  }

  async listByJob(jobId: string) {
    return this.db
      .select()
      .from(jobOutputs)
      .where(eq(jobOutputs.jobId, jobId))
      .orderBy(desc(jobOutputs.createdAt))
      .all();
  }

  async findPrimary(jobId: string) {
    return this.db
      .select()
      .from(jobOutputs)
      .where(eq(jobOutputs.jobId, jobId))
      .get();
  }

  async deleteByJob(jobId: string): Promise<void> {
    await this.db.delete(jobOutputs).where(eq(jobOutputs.jobId, jobId)).run();
  }
}

export class LogsRepository {
  constructor(private db: Db) {}

  async create(log: NewJobLog): Promise<void> {
    await this.db.insert(jobLogs).values(log).run();
  }

  async listByJob(jobId: string, options: { limit?: number; after?: number } = {}) {
    const limit = options.limit ?? 1000;
    return this.db
      .select()
      .from(jobLogs)
      .where(eq(jobLogs.jobId, jobId))
      .orderBy(desc(jobLogs.createdAt))
      .limit(limit)
      .all();
  }

  async deleteByJob(jobId: string): Promise<void> {
    await this.db.delete(jobLogs).where(eq(jobLogs.jobId, jobId)).run();
  }
}
