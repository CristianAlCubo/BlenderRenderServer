import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";

import type { FastifyInstance } from "fastify";

import {
  createJobBodySchema,
  jobParamsSchema,
  jobResponseSchema,
  listJobsQuerySchema,
} from "./jobs.schema.js";

const errorResponseSchema = {
  type: "object",
  properties: {
    error: { type: "string" },
    message: { type: "string" },
  },
} as const;

export async function jobsRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/api/jobs",
    {
      schema: {
        body: createJobBodySchema,
        response: { 201: jobResponseSchema, 400: errorResponseSchema, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { uploadId, renderMode, computeMode } = request.body as {
        uploadId: string;
        renderMode?: "CPU" | "GPU";
        computeMode?: string;
      };

      const upload = await app.uploadsService.getUpload(uploadId);
      if (!upload) {
        return reply.code(404).send({ error: "upload_not_found" });
      }

      try {
        const prepared = await app.uploadsService.prepare(uploadId);
        const job = await app.jobsService.createJob({
          uploadId,
          originalFilename: prepared.originalFilename,
          projectPath: prepared.projectPath,
          blendFilePath: prepared.blendFilePath,
          renderMode: renderMode ?? app.config.defaultRenderMode,
          computeMode: computeMode ?? null,
        });

        return reply.code(201).send(job);
      } catch (err) {
        const message = err instanceof Error ? err.message : "preparation_failed";
        request.log.error({ err }, "job creation failed");
        return reply.code(400).send({ error: message });
      }
    },
  );

  app.get(
    "/api/jobs",
    { schema: { querystring: listJobsQuerySchema } },
    async (request) => {
      const query = request.query as { status?: string; limit?: number; offset?: number };
      const result = await app.jobsService.list({
        status: query.status,
        limit: query.limit ?? 100,
        offset: query.offset ?? 0,
      });
      return result;
    },
  );

  app.get(
    "/api/jobs/:id",
    { schema: { params: jobParamsSchema } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const job = await app.jobsService.get(id);
      if (!job) return reply.code(404).send({ error: "job_not_found" });
      return job;
    },
  );

  app.post(
    "/api/jobs/:id/cancel",
    { schema: { params: jobParamsSchema } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await app.jobsService.cancel(id);
      if (!result.ok) {
        const code = result.reason === "not_found" ? 404 : 409;
        return reply.code(code).send({ error: result.reason });
      }
      return { ok: true };
    },
  );

  app.post(
    "/api/jobs/:id/retry",
    { schema: { params: jobParamsSchema } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await app.jobsService.retry(id);
      if (!result.ok) {
        const code = result.reason === "not_found" ? 404 : 409;
        return reply.code(code).send({ error: result.reason });
      }
      return { ok: true };
    },
  );

  app.get(
    "/api/jobs/:id/logs",
    { schema: { params: jobParamsSchema } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const job = await app.jobsService.get(id);
      if (!job) return reply.code(404).send({ error: "job_not_found" });
      const logs = await app.jobsService.getLogs(id);
      return { items: logs };
    },
  );

  app.get(
    "/api/jobs/:id/output",
    { schema: { params: jobParamsSchema } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await app.jobsService.getOutput(id);
      if (!result) return reply.code(404).send({ error: "output_not_available" });

      const { output, job } = result;
      const fileStat = await stat(output.path);

      reply.header("Content-Type", output.mimeType);
      reply.header("Content-Length", fileStat.size);
      reply.header(
        "Content-Disposition",
        `inline; filename="${output.filename.replace(/"/g, "")}"`,
      );

      return reply.send(createReadStream(output.path));
    },
  );

  app.delete(
    "/api/jobs/:id",
    { schema: { params: jobParamsSchema } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const deleted = await app.jobsService.delete(id);
      if (!deleted) return reply.code(404).send({ error: "job_not_found" });
      return reply.code(204).send();
    },
  );
}
