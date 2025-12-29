import envConfig from "../config/env.js";
import { Worker } from "bullmq";
import mongoose from "mongoose";
import { createWorkerConnection } from "../config/redis.config.js"; // Use separate connection
import File from "../models/fileModel.js";
import { deleteObject } from "../service/s3Service.js";
import { connectDB } from "../db/connection.js";
import process from "node:process";

let worker;
let workerConnection;

// Initialize database connection
await connectDB();
console.log("Database connected");

// Create dedicated worker connection
workerConnection = createWorkerConnection();

workerConnection.on("connect", () => {
  console.log("Worker Redis connection established");
});

workerConnection.on("error", (err) => {
  console.error("Worker Redis connection error:", err);
});

const shutdown = async (signal) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  try {
    if (worker) {
      await worker.close();
      console.log("Worker closed");
    }
    if (workerConnection) {
      await workerConnection.quit();
      console.log("Worker Redis disconnected");
    }
    await mongoose.disconnect();
    console.log("Database disconnected");
  } catch (error) {
    console.error("Error during shutdown:", error);
  }
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

worker = new Worker(
  "file-delete",
  async (job) => {
    try {
      const { fileId, s3Key } = job.data;

      if (!fileId || !s3Key) {
        throw new Error("Missing fileId or s3Key in job data");
      }

      const file = await File.findById(fileId);

      if (!file) {
        return { status: "skipped", reason: "file not found" };
      }
      if (!file.deletedAt) {
        return { status: "skipped", reason: "no expiration" };
      }

      await deleteObject({
        bucketName: envConfig.AWS_BUCKET_NAME,
        key: file.s3Key,
      });

      await File.findByIdAndDelete(fileId);

      console.log(`✅ File ${fileId} deleted successfully`);
      return { status: "success", fileId, s3Key };
    } catch (error) {
      console.error(`❌ Error processing job ${job.id}:`, error);
      throw error;
    }
  },
  {
    connection: workerConnection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000,
    },
  },
);

worker.on("completed", (job) => {
  console.log(`✅ Job ${job.id} completed successfully`);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("❌ Worker error:", err);
});

worker.on("active", (job) => {
  console.log(`▶️  Job ${job.id} is now active`);
});

worker.on("stalled", (jobId) => {
  console.warn(`⚠️  Job ${jobId} has stalled`);
});

console.log("\n✅ Worker started successfully");
console.log("\n👀 Waiting for jobs...\n");
