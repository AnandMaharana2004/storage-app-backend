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
};

if (isNaN(envConfig.PORT)) {
  throw new Error("PORT must be a valid number");
}

Object.freeze(envConfig);

export default envConfig;
