import type { FastifyInstance } from "fastify";

export async function websocketRoutes(app: FastifyInstance): Promise<void> {
  app.get(app.config.wsPath, { websocket: true }, (socket) => {
    app.realtime.addSocket(socket);
  });
}
