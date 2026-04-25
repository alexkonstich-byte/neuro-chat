import express from 'express';
import http from 'node:http';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import './db.js';
import { authMiddleware, adminOnly } from './middleware.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import chatsRoutes from './routes/chats.js';
import shopRoutes from './routes/shop.js';
import casinoRoutes from './routes/casino.js';
import adminRoutes from './routes/admin.js';
import uploadsRoutes from './routes/uploads.js';
import { createSocketServer } from './socket.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, time: Date.now() }));

app.use('/api/auth', authRoutes);

// Serve uploaded files (via nginx in prod; this is a fallback)
app.use('/uploads', express.static(config.uploadDir, { fallthrough: true, maxAge: '1d' }));

// Authenticated routes
app.use('/api/profile', authMiddleware, profileRoutes);
app.use('/api/chats', authMiddleware, chatsRoutes);
app.use('/api/shop', authMiddleware, shopRoutes);
app.use('/api/casino', authMiddleware, casinoRoutes);
app.use('/api/uploads', authMiddleware, uploadsRoutes);
app.use('/api/admin', authMiddleware, adminOnly, adminRoutes);

// Frontend SPA (built into web/dist) — served by nginx in prod, here as a fallback for "single-process dev".
const webDist = path.resolve(__dirname, '..', '..', 'web', 'dist');
app.use(express.static(webDist, { maxAge: '1h', index: false }));
app.get(/^\/(?!api|uploads).*/, (req, res) => {
  res.sendFile(path.join(webDist, 'index.html'), (err) => {
    if (err) res.status(404).send('Build the web frontend first (cd web && npm run build).');
  });
});

app.use((err, req, res, _next) => {
  console.error('[err]', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'server', message: err?.message });
});

const server = http.createServer(app);
createSocketServer(server, { origin: config.publicOrigin });

server.listen(config.port, () => {
  console.log(`[neuro-server] listening on :${config.port}`);
});
