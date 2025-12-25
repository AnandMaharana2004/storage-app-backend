import { Queue } from "bullmq";
import { redis } from "../config/redis.config.js";

export const fileDeleteQueue = new Queue("file-delete", {
  connection: redis,
});
