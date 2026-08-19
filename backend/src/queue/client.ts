import { Queue } from "bullmq";

export const RENDER_QUEUE_NAME = "render";

export function createRenderQueue(redisUrl: string): Queue {
  return new Queue(RENDER_QUEUE_NAME, {
    connection: { url: redisUrl },
    defaultJobOptions: {
      removeOnComplete: 200,
      removeOnFail: 500,
    },
  });
}
