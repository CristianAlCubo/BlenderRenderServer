import type { Redis } from "ioredis";
import type { RealtimeEvent } from "@render-server/shared";
import { REALTIME_CHANNEL } from "@render-server/shared";

export class EventPublisher {
  constructor(private redis: Redis) {}

  async publish(event: RealtimeEvent): Promise<void> {
    await this.redis.publish(REALTIME_CHANNEL, JSON.stringify(event));
  }
}

export function makeEvent(
  type: RealtimeEvent["type"],
  payload: unknown,
): RealtimeEvent {
  return { type, payload, timestamp: new Date().toISOString() };
}
