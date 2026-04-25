import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.resolve(__dirname, '..', '.env');

if (existsSync(envFile)) {
  const text = readFileSync(envFile, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const root = path.resolve(__dirname, '..');
const dataDir = path.resolve(root, process.env.DATA_DIR || './data');
const uploadDir = path.resolve(root, process.env.UPLOAD_DIR || './data/uploads');
const dbFile = path.resolve(root, process.env.DB_FILE || './data/neuro.db');

export const config = {
  port: Number(process.env.PORT || 3001),
  publicOrigin: process.env.PUBLIC_ORIGIN || 'http://localhost:5173',
  dataDir,
  uploadDir,
  dbFile,
  adminPhone: process.env.ADMIN_PHONE || '',
  sessionTtlDays: Number(process.env.SESSION_TTL_DAYS || 30),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 100),
};
