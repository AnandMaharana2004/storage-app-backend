import { Worker } from "bullmq";
import { bullRedis } from "../config/redis.config.js";
import File from "../models/fileModel.js";
import { deleteObject } from "../service/s3Service.js";
import { connectDB } from "../db/connection.js";
import envConfig from "../config/env.js";

await connectDB();
const s3Bucket = envConfig.AWS_BUCKET_NAME;

new Worker(
  "file-delete",
  async (job) => {
    const { fileId, s3Key } = job.data;

    const file = await File.findById(fileId);
    if (!file || !file.expiresAt) return;

    await deleteObject(s3Bucket, s3Key);
    await File.findByIdAndDelete(fileId);
    console.log(`fileId : ${fileId} and s3 key ${s3Key} deleted successfylly`);
  },
  {
    connection: bullRedis,
    concurrency: 5,
  },
);

console.log("Worker started successfully");
