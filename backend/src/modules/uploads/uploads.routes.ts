import type { FastifyInstance } from "fastify";

import { UploadError } from "./uploads.service.js";

export async function uploadsRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/uploads", async (request, reply) => {
    let file;
    try {
      file = await request.file();
    } catch (err) {
      request.log.error({ err }, "failed to read upload");
      return reply.code(400).send({ error: "upload_failed" });
    }

    if (!file) {
      return reply.code(400).send({ error: "no_file_provided" });
    }

    try {
      const meta = await app.uploadsService.saveUpload(file);
      return reply.code(201).send({
        uploadId: meta.uploadId,
        originalFilename: meta.originalFilename,
      });
    } catch (err) {
      if (err instanceof UploadError) {
        return reply.code(err.statusCode).send({ error: err.code });
      }
      request.log.error({ err }, "upload failed");
      return reply.code(400).send({ error: "upload_failed" });
    }
  });
}
