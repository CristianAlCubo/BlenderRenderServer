import { z } from "zod";

import { COMPUTE_MODES, JOB_STATUSES, RENDER_MODES } from "./enums.js";

export const jobStatusSchema = z.enum(JOB_STATUSES);
export const computeModeSchema = z.enum(COMPUTE_MODES);
export const renderModeSchema = z.enum(RENDER_MODES);

export const createJobBodySchema = z.object({
  uploadId: z.string().min(1),
  renderMode: renderModeSchema.optional(),
  computeMode: computeModeSchema.optional(),
});

export const listJobsQuerySchema = z.object({
  status: jobStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const jobParamsSchema = z.object({
  id: z.string().min(1),
});

export const createJobResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
  originalFilename: z.string(),
  progress: z.number(),
  createdAt: z.string(),
});

export type CreateJobBody = z.infer<typeof createJobBodySchema>;
export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>;
export type JobParams = z.infer<typeof jobParamsSchema>;
