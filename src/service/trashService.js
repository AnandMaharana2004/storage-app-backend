import { fileDeleteQueue } from "../queue/fileDelete.queue.js";

export async function scheduleDelete(file, delayMs) {
  const job = await fileDeleteQueue.add(
    "delete-file",
    {
      fileId: file._id,
      s3Key: file.s3Key,
    },
    {
      jobId: file._id.toString(), // 👈 IMPORTANT
      delay: delayMs,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    },
  );

  return job.id;
}

export async function cancelDelete(jobId) {
  const job = await fileDeleteQueue.getJob(jobId);
  if (job) await job.remove();
}
