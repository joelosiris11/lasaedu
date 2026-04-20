// pm2 ecosystem file — loaded by `pm2 start ecosystem.config.cjs --env production`
// Secrets come from the VPS `.env` file (read by pm2 via `env_file`-style include),
// so this file is safe to commit.

module.exports = {
  apps: [
    {
      name: 'lasaedu-fileserver',
      script: './index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_memory_restart: '512M',
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 5000,
      merge_logs: true,
      out_file: './logs/out.log',
      error_file: './logs/err.log',
      time: true,
      env: {
        NODE_ENV: 'development',
        PORT: 3010,
        UPLOAD_DIR: './uploads',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3010,
        // All other variables (FIREBASE_PROJECT_ID, GOOGLE_APPLICATION_CREDENTIALS,
        // BASE_URL, ALLOWED_ORIGINS, UPLOAD_DIR) come from the VPS .env file,
        // which pm2 picks up automatically when you run:
        //   pm2 start ecosystem.config.cjs --env production --update-env
        // or through `npm run deploy`.
      },
    },
  ],
};
