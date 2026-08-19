import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    originalFilename: text("original_filename").notNull(),
    projectPath: text("project_path").notNull(),
    blendFilePath: text("blend_file_path"),
    status: text("status").notNull().default("QUEUED"),
    progress: real("progress").notNull().default(0),
    currentFrame: integer("current_frame").notNull().default(0),
    totalFrames: integer("total_frames").notNull().default(0),
    renderEngine: text("render_engine").notNull().default("blender"),
    computeMode: text("compute_mode"),
    renderMode: text("render_mode").notNull().default("CPU"),
    createdAt: text("created_at").notNull(),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    errorMessage: text("error_message"),
    createdBy: text("created_by"),
    workerId: text("worker_id"),
  },
  (table) => ({
    statusIdx: index("jobs_status_idx").on(table.status),
    createdAtIdx: index("jobs_created_at_idx").on(table.createdAt),
  }),
);

export const jobOutputs = sqliteTable(
  "job_outputs",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    filename: text("filename").notNull(),
    path: text("path").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull().default(0),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    jobIdIdx: index("job_outputs_job_id_idx").on(table.jobId),
  }),
);

export const jobLogs = sqliteTable(
  "job_logs",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    level: text("level").notNull().default("INFO"),
    message: text("message").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    jobIdIdx: index("job_logs_job_id_idx").on(table.jobId),
  }),
);

export const workers = sqliteTable(
  "workers",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    status: text("status").notNull().default("ONLINE"),
    computeMode: text("compute_mode").notNull().default("CPU"),
    blenderVersion: text("blender_version"),
    lastHeartbeat: text("last_heartbeat").notNull(),
    currentJobId: text("current_job_id"),
    capabilities: text("capabilities").notNull().default("[]"),
  },
  (table) => ({
    statusIdx: index("workers_status_idx").on(table.status),
  }),
);

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type JobOutput = typeof jobOutputs.$inferSelect;
export type NewJobOutput = typeof jobOutputs.$inferInsert;
export type JobLog = typeof jobLogs.$inferSelect;
export type NewJobLog = typeof jobLogs.$inferInsert;
export type Worker = typeof workers.$inferSelect;
export type NewWorker = typeof workers.$inferInsert;
