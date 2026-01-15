module.exports = {
  apps: [
    {
      name: 'discord-task-bot',
      script: './dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
        PERSISTENCE_TYPE: 'json'
      },
      env_production: {
        NODE_ENV: 'production',
        PERSISTENCE_TYPE: 'json'
      },
      env_production_db: {
        NODE_ENV: 'production',
        PERSISTENCE_TYPE: 'typeorm'
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000
    }
  ]
};
