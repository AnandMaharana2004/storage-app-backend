module.exports = {
  apps: [
    {
      name: "api-server",
      script: "src/index.js",
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "file-worker",
      script: "src/worker/fileDelete.worker.js",
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
