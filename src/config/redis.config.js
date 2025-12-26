import IORedis from "ioredis";
import envConfig from "./env.js";

export const redis = new IORedis(envConfig.REDIS_URL);

export const bullRedis = {
  url: envConfig.REDIS_URL,
  maxRetriesPerRequest: null,
};
