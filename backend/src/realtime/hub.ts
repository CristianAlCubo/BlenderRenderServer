import type { WebSocket } from "ws";
import type { Redis } from "ioredis";
import type { RealtimeEvent } from "@render-server/shared";
import { REALTIME_CHANNEL } from "@render-server/shared";

export class RealtimeHub {
  private sockets = new Set<WebSocket>();

  constructor(
    private redisSub: Redis,
    private redisPub: Redis,
  ) {}

  addSocket(socket: WebSocket): void {
    this.sockets.add(socket);
    socket.on("close", () => this.sockets.delete(socket));
    socket.on("error", () => this.sockets.delete(socket));
  }

  private broadcastToSockets(event: RealtimeEvent): void {
    const data = JSON.stringify(event);
    for (const socket of this.sockets) {
      if (socket.readyState === socket.OPEN) {
        socket.send(data);
      }
    }
  }

  async publish(event: RealtimeEvent): Promise<void> {
    await this.publishTo(REALTIME_CHANNEL, JSON.stringify(event));
  }

  async publishTo(channel: string, message: string): Promise<void> {
    await this.redisPub.publish(channel, message);
  }

  async start(): Promise<void> {
    await this.redisSub.subscribe(REALTIME_CHANNEL);
    this.redisSub.on("message", (channel, message) => {
      if (channel !== REALTIME_CHANNEL) return;
      try {
        const event = JSON.parse(message) as RealtimeEvent;
        this.broadcastToSockets(event);
      } catch {
        // ignore malformed messages
      }
    });
  }

  async stop(): Promise<void> {
    await this.redisSub.unsubscribe(REALTIME_CHANNEL);
    for (const socket of this.sockets) {
      socket.close();
    }
    this.sockets.clear();
  }
}
