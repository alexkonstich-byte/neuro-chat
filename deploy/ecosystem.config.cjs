// PM2 process file. Run from anywhere:
//   pm2 start /opt/neuro/deploy/ecosystem.config.cjs
//
// All paths are resolved relative to THIS file (not the caller's CWD), so PM2
// works no matter where you invoke it from.
const path = require('node:path');

const SERVER_DIR = path.resolve(__dirname, '..', 'server');

module.exports = {
  apps: [
    {
      name: 'neuro-server',
      cwd: SERVER_DIR,
      script: path.join(SERVER_DIR, 'src', 'index.js'),
      // node:sqlite is currently behind a flag; required on Node 22.x.
      node_args: '--experimental-sqlite',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      max_memory_restart: '700M',
      restart_delay: 1500,
      out_file:   path.join(SERVER_DIR, 'data', 'pm2-out.log'),
      error_file: path.join(SERVER_DIR, 'data', 'pm2-err.log'),
      merge_logs: true,
      autorestart: true,
    },
  ],
};
