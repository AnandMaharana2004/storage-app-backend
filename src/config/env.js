import process from "process";
const requiredVars = ["MONGO_URI", "PORT", "NODE_ENV"];

const missing = requiredVars.filter((v) => !process.env[v]);
if (missing.length > 0) {
  throw new Error(`Missing env vars: ${missing.join(", ")}`);
}

const envConfig = {
  MONGO_URI: process.env.MONGO_URI,
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",
  COOKIE_SECRET: process.env.COOKIE_SECRET,
  FRONTEND_URL: process.env.FRONTEND_URL,
  AWS_REGION: process.env.AWS_REGION,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME,
};

if (isNaN(envConfig.PORT)) {
  throw new Error("PORT must be a valid number");
}

Object.freeze(envConfig);

export default envConfig;
