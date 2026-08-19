import { mkdirSync } from "node:fs";
import { join, resolve, sep } from "node:path";

export class StoragePaths {
  readonly dataDir: string;
  readonly databaseDir: string;
  readonly projectsDir: string;
  readonly rendersDir: string;

  constructor(dataDir: string) {
    this.dataDir = resolve(dataDir);
    this.databaseDir = join(this.dataDir, "database");
    this.projectsDir = join(this.dataDir, "projects");
    this.rendersDir = join(this.dataDir, "renders");
  }

  ensureBase(): void {
    mkdirSync(this.databaseDir, { recursive: true });
    mkdirSync(this.projectsDir, { recursive: true });
    mkdirSync(this.rendersDir, { recursive: true });
  }

  projectDir(jobId: string): string {
    const dir = join(this.projectsDir, jobId);
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  projectAssetsDir(jobId: string): string {
    const dir = join(this.projectsDir, jobId, "assets");
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  projectLogsDir(jobId: string): string {
    const dir = join(this.projectsDir, jobId, "logs");
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  renderDir(jobId: string): string {
    const dir = join(this.rendersDir, jobId);
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  framesDir(jobId: string): string {
    const dir = join(this.rendersDir, jobId, "frames");
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  renderLogPath(jobId: string): string {
    return join(this.projectLogsDir(jobId), "render.log");
  }

  isWithin(dir: string, candidate: string): boolean {
    const resolvedDir = resolve(dir) + sep;
    const resolvedCandidate = resolve(candidate);
    return resolvedCandidate === resolve(dir) || resolvedCandidate.startsWith(resolvedDir);
  }
}
