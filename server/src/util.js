import crypto from 'node:crypto';

export const now = () => Date.now();

export const todayIso = (ts = Date.now()) => {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const isoDiffDays = (a, b) => {
  const da = new Date(a + 'T00:00:00Z').getTime();
  const db = new Date(b + 'T00:00:00Z').getTime();
  return Math.round((db - da) / (24 * 3600 * 1000));
};

export const randomHex = (bytes = 24) => crypto.randomBytes(bytes).toString('hex');

export const randomCode = () => String(Math.floor(10000 + Math.random() * 90000));

export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export const normPhone = (raw) => String(raw || '').replace(/[^\d+]/g, '');

export function pairKey(a, b) {
  return a < b ? [a, b] : [b, a];
}

export function asInt(v, def = 0) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

import { scryptSync, timingSafeEqual, randomBytes } from 'node:crypto';

export function hashPassword(plain) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, 64).toString('hex');
  return { salt, hash };
}
export function verifyPassword(plain, salt, expected) {
  if (!salt || !expected) return false;
  const got = scryptSync(plain, salt, 64);
  const exp = Buffer.from(expected, 'hex');
  if (got.length !== exp.length) return false;
  return timingSafeEqual(got, exp);
}
export function shortCode(digits = 8) {
  let s = '';
  for (let i = 0; i < digits; i++) s += Math.floor(Math.random() * 10);
  return s;
}
