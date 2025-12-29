import { fileDeleteQueue } from "../queue/fileDelete.queue.js";

export async function scheduleDelete(file, delayMs) {
  try {
    const jobId = file._id.toString();

    const existingJob = await fileDeleteQueue.getJob(jobId);
    if (existingJob) {
      console.log(`Job ${jobId} already exists, removing old job first`);
      await existingJob.remove();
    }

    const job = await fileDeleteQueue.add(
      "delete-file",
      {
        fileId: file._id.toString(),
        s3Key: file.s3Key,
      },
      {
        jobId: jobId,
        delay: delayMs,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: {
          age: 3600,
          count: 100,
        },
        removeOnFail: {
          age: 86400,
        },
      },
    );

    console.log(
      `Delete scheduled for file ${file._id} with delay ${delayMs}ms, Job ID: ${job.id}`,
    );
    return job.id;
  } catch (error) {
    console.error("Error scheduling delete:", error);
    throw error;
  }
}

export async function cancelDelete(jobId) {
  try {
    const job = await fileDeleteQueue.getJob(jobId);

    if (!job) {
      console.log(`Job ${jobId} not found`);
      return false;
    }

    const state = await job.getState();
    console.log(`Job ${jobId} current state: ${state}`);

    // Only remove if job is waiting or delayed
    if (state === "waiting" || state === "delayed") {
      await job.remove();
      console.log(`Job ${jobId} cancelled successfully`);
      return true;
    } else {
      console.log(`Job ${jobId} cannot be cancelled (state: ${state})`);
      return false;
    }
  } catch (error) {
    console.error(`Error cancelling job ${jobId}:`, error);
    throw error;
  }
}

export async function getDeleteStatus(jobId) {
  try {
    const job = await fileDeleteQueue.getJob(jobId);

    if (!job) {
      return null;
    }

    const state = await job.getState();
    return {
      id: job.id,
      state,
      data: job.data,
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
    };
  } catch (error) {
    console.error(`Error getting job status ${jobId}:`, error);
    throw error;
  }
}
