import { Queue } from "bullmq";
import { redisConnection } from "../config/redis.config.js";

export const fileDeleteQueue = new Queue("file-delete", {
  connection: redisConnection,
});
