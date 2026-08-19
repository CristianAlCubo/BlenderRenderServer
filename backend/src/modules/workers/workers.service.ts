import { WorkersRepository, type Db } from "@render-server/db";

export class WorkersService {
  private repo: WorkersRepository;

  constructor(db: Db) {
    this.repo = new WorkersRepository(db);
  }

  async list() {
    const workers = await this.repo.list();
    return workers.map((w) => ({
      id: w.id,
      name: w.name,
      status: w.status,
      computeMode: w.computeMode,
      blenderVersion: w.blenderVersion,
      lastHeartbeat: w.lastHeartbeat,
      currentJobId: w.currentJobId,
      capabilities: JSON.parse(w.capabilities || "[]") as string[],
    }));
  }

  async markStale(staleBefore: string): Promise<void> {
    await this.repo.markOffline(staleBefore);
  }
}
