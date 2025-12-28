import { Worker } from "bullmq";
import mongoose from "mongoose";
import { bullRedis } from "../config/redis.config.js";
import File from "../models/fileModel.js";
import { deleteObject } from "../service/s3Service.js";
import { connectDB } from "../db/connection.js";
import envConfig from "../config/env.js";
import process from "node:process";
await connectDB();

const shutdown = async (signal) => {
  console.log(`Received ${signal}. Shutting down...`);
  await mongoose.disconnect();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

const s3Bucket = envConfig.AWS_BUCKET_NAME;

new Worker(
  "file-delete",
  async (job) => {
    const { fileId, s3Key } = job.data;

    const file = await File.findById(fileId);
    if (!file || !file.expiresAt) return;

    await deleteObject(s3Bucket, s3Key);
    await File.findByIdAndDelete(fileId);

    console.log("File deleted successfully");
  },
  {
    connection: bullRedis,
    concurrency: 5,
  },
);

console.log("Worker started successfully");
