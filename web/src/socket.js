import { io } from 'socket.io-client';
import { auth } from './api.js';

let sock = null;

export function getSocket() {
  if (sock && sock.connected) return sock;
  if (sock) return sock;
  sock = io({
    auth: { token: auth.get() },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 700,
    reconnectionDelayMax: 5000,
  });
  return sock;
}

export function destroySocket() {
  if (sock) { sock.disconnect(); sock = null; }
}
