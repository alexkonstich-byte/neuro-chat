import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { db } from '../db.js';
import { config } from '../config.js';
import { now, randomHex } from '../util.js';

const r = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(config.uploadDir, 'media')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 16).replace(/[^a-zA-Z0-9.]/g, '');
    cb(null, `${Date.now()}_${randomHex(6)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadMb * 1024 * 1024 },
});

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(config.uploadDir, 'avatars')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 16).replace(/[^a-zA-Z0-9.]/g, '');
    cb(null, `${req.user.id}_${Date.now()}${ext}`);
  },
});
const avatarUpload = multer({ storage: avatarStorage, limits: { fileSize: 10 * 1024 * 1024 } });

r.post('/file', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no_file' });
  const kind = String(req.body?.kind || 'file');
  const rel = path.relative(config.uploadDir, req.file.path).replaceAll('\\', '/');
  const meta = {
    width: Number(req.body?.width) || null,
    height: Number(req.body?.height) || null,
    duration: Number(req.body?.duration) || null,
  };
  const t = now();
  const r1 = db.prepare(
    `INSERT INTO attachments(message_id, kind, path, mime, size, width, height, duration_ms, created_at)
     VALUES(NULL, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(kind, rel, req.file.mimetype, req.file.size, meta.width, meta.height, meta.duration, t);
  res.json({
    id: Number(r1.lastInsertRowid),
    kind, path: rel, mime: req.file.mimetype, size: req.file.size,
    url: `/uploads/${rel}`,
  });
});

r.post('/avatar', avatarUpload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no_file' });
  const rel = path.relative(config.uploadDir, req.file.path).replaceAll('\\', '/');
  const url = `/uploads/${rel}`;
  db.prepare('UPDATE users SET avatar_path = ? WHERE id = ?').run(url, req.user.id);
  res.json({ ok: true, url });
});

export default r;
