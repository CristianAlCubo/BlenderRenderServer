import { desc, eq, sql } from "drizzle-orm";

import type { Db } from "../client.js";
import { jobs, type Job, type NewJob } from "../schema.js";

export class JobsRepository {
  constructor(private db: Db) {}

  async create(job: NewJob): Promise<Job> {
    await this.db.insert(jobs).values(job).run();
    return (await this.db.select().from(jobs).where(eq(jobs.id, job.id)).get())!;
  }

  async findById(id: string): Promise<Job | undefined> {
    return this.db.select().from(jobs).where(eq(jobs.id, id)).get();
  }

  async list(options: { status?: string; limit: number; offset: number }) {
    const where = options.status ? sql`${jobs.status} = ${options.status}` : undefined;
    const conditions = where ? [where] : [];

    const rows = this.db
      .select()
      .from(jobs)
      .where(...(conditions as [any]))
      .orderBy(desc(jobs.createdAt))
      .limit(options.limit)
      .offset(options.offset)
      .all();

    const countRow = this.db
      .select({ count: sql<number>`count(*)` })
      .from(jobs)
      .where(...(conditions as [any]))
      .get();

    return { items: rows, total: Number(countRow?.count ?? 0) };
  }

  async update(id: string, patch: Partial<Omit<NewJob, "id">>): Promise<void> {
    await this.db.update(jobs).set(patch).where(eq(jobs.id, id)).run();
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(jobs).where(eq(jobs.id, id)).run();
  }

  async countByStatus(status: string): Promise<number> {
    const row = this.db
      .select({ count: sql<number>`count(*)` })
      .from(jobs)
      .where(eq(jobs.status, status))
      .get();
    return Number(row?.count ?? 0);
  }

  async queuePosition(id: string): Promise<number | null> {
    const job = await this.findById(id);
    if (!job) return null;
    if (job.status !== "QUEUED") return null;
    const row = this.db
      .select({ count: sql<number>`count(*)` })
      .from(jobs)
      .where(
        sql`${jobs.status} = 'QUEUED' AND ${jobs.createdAt} <= ${job.createdAt}`,
      )
      .get();
    return Number(row?.count ?? 0);
  }
}
