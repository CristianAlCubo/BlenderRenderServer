import { and, eq, lt } from "drizzle-orm";

import type { Db } from "../client.js";
import { workers, type NewWorker } from "../schema.js";

export class WorkersRepository {
  constructor(private db: Db) {}

  async upsert(worker: NewWorker): Promise<void> {
    await this.db
      .insert(workers)
      .values(worker)
      .onConflictDoUpdate({
        target: workers.id,
        set: {
          name: worker.name,
          status: worker.status,
          computeMode: worker.computeMode,
          blenderVersion: worker.blenderVersion,
          lastHeartbeat: worker.lastHeartbeat,
          capabilities: worker.capabilities,
        },
      })
      .run();
  }

  async findById(id: string) {
    return this.db.select().from(workers).where(eq(workers.id, id)).get();
  }

  async list() {
    return this.db.select().from(workers).all();
  }

  async markOffline(staleBefore: string): Promise<void> {
    const rows = await this.db
      .select({ id: workers.id })
      .from(workers)
      .where(and(eq(workers.status, "ONLINE"), lt(workers.lastHeartbeat, staleBefore)))
      .all();

    for (const row of rows) {
      await this.db
        .update(workers)
        .set({ status: "OFFLINE" })
        .where(eq(workers.id, row.id))
        .run();
    }
  }

  async setCurrentJob(id: string, currentJobId: string | null): Promise<void> {
    await this.db
      .update(workers)
      .set({ currentJobId })
      .where(eq(workers.id, id))
      .run();
  }
}
