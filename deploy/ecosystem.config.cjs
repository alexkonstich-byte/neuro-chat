// PM2 process file. Run from repo root: `pm2 start deploy/ecosystem.config.cjs`
module.exports = {
  apps: [
    {
      name: 'neuro-server',
      cwd: './server',
      script: 'src/index.js',
      // node:sqlite is currently behind a flag; required on Node 22.x.
      node_args: '--experimental-sqlite',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      max_memory_restart: '700M',
      restart_delay: 1500,
      out_file: './data/pm2-out.log',
      error_file: './data/pm2-err.log',
      merge_logs: true,
    },
  ],
};
