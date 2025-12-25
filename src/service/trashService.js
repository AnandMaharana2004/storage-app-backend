import { fileDeleteQueue } from "../queue/fileDelete.queue.js";

export async function scheduleDelete(file, delayMs) {
  const job = await fileDeleteQueue.add(
    "delete-file",
    {
      fileId: file._id,
      s3Key: file.s3Key,
    },
    {
      delay: delayMs,
      jobId: `file-delete-${file._id}`,
      removeOnComplete: true,
    },
  );

  return job.id;
}

export async function cancelDelete(jobId) {
  const job = await fileDeleteQueue.getJob(jobId);
  if (job) await job.remove();
}
