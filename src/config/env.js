import process from "process";
import { Buffer } from "buffer";
const requiredVars = ["MONGO_URI", "PORT", "NODE_ENV"];

const missing = requiredVars.filter((v) => !process.env[v]);
if (missing.length > 0) {
  throw new Error(`Missing env vars: ${missing.join(", ")}`);
}

const PRIVATE_KEY = Buffer.from(
  process.env.CLOUDFRONT_PRIVATE_KEY_BASE64,
  "base64",
).toString("utf-8");

const envConfig = {
  MONGO_URI: process.env.MONGO_URI,
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",
  COOKIE_SECRET: process.env.COOKIE_SECRET,
  FRONTEND_URL1: process.env.FRONTEND_URL1,
  FRONTEND_URL2: process.env.FRONTEND_URL2,
  AWS_REGION: process.env.AWS_REGION,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME,
  AWS_CLOUDFRONT_PRIVATE_KEY: PRIVATE_KEY,
  CLOUDFRONT_DOMAIN: process.env.CLOUDFRONT_DOMAIN,
  CLOUDFRONT_KEY_PAIR_ID: process.env.CLOUDFRONT_KEY_PAIR_ID,
  CLOUDFRONT_DISTRIBUTION_ID: process.env.CLOUDFRONT_DISTRIBUTION_ID,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  REDIS_URL: process.env.REDIS_URL,
};

if (isNaN(envConfig.PORT)) {
  throw new Error("PORT must be a valid number");
}

Object.freeze(envConfig);

export default envConfig;
