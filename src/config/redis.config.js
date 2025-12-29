import IORedis from "ioredis";
import envConfig from "./env.js";

// Redis connection configuration
const redisConfig = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  reconnectOnError: (err) => {
    console.error("Redis connection error:", err);
    return true;
  },
};

// Create separate connections for Queue and Worker
// BullMQ requires different connection instances
export const redisConnection = new IORedis(envConfig.REDIS_URL, redisConfig);

// Create a duplicate connection function for workers
export const createWorkerConnection = () => {
  return new IORedis(envConfig.REDIS_URL, redisConfig);
};

// Handle connection events for main connection
redisConnection.on("error", (err) => {
  console.error("Redis Queue connection error:", err);
});

redisConnection.on("connect", () => {
  console.log("Redis Queue connected successfully");
});
