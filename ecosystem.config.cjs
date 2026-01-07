module.exports = {
  apps: [
    {
      name: "api-server",
      script: "src/index.js",
      instances: 1,
      exec_mode: "cluster",
      autorestart: true,
      max_memory_restart: "500M", // Restart if memory exceeds 500MB
      env: {
        NODE_ENV: "production",
      },
      error_file: "./logs/api-error.log",
      out_file: "./logs/api-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
    {
      name: "file-worker",
      script: "src/worker/fileDelete.worker.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
      },
      error_file: "./logs/worker-error.log",
      out_file: "./logs/worker-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};