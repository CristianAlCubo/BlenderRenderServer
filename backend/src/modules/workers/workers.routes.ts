import type { FastifyInstance } from "fastify";

export async function workersRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/workers", async () => {
    return { items: await app.workersService.list() };
  });
}
