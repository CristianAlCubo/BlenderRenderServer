import { buildApp } from "./app.js";

async function main(): Promise<void> {
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "shutting down");
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    await app.listen({ port: app.config.port, host: "0.0.0.0" });
    void app.realtime.start().catch((err) => app.log.warn({ err }, "realtime subscription failed"));
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
