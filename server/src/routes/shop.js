import { Router } from 'express';
import { db } from '../db.js';
import { now } from '../util.js';
import { spendXp, activateMultiplier, addNeurons } from '../xp.js';

const r = Router();
const REFUND_WINDOW_MS = 5 * 60 * 1000;

r.get('/items', (req, res) => {
  // Hide exclusive items from the regular shop
  const items = db.prepare(
    `SELECT id, code, kind, name, description, price_xp, price_neurons, payload, premium_only, sort_order
     FROM shop_items WHERE active = 1 AND is_exclusive = 0 ORDER BY sort_order ASC, id ASC`
  ).all();
  res.json({ items: items.map(i => ({ ...i, payload: i.payload ? JSON.parse(i.payload) : null })) });
});

r.get('/inventory', (req, res) => {
  const owned = db.prepare(
    `SELECT i.*, s.name, s.kind, s.payload FROM inventory i
     LEFT JOIN shop_items s ON s.code = i.item_code
     WHERE i.user_id = ? ORDER BY i.acquired_at DESC`
  ).all(req.user.id);
  res.json({ inventory: owned.map(o => ({ ...o, payload: o.payload ? JSON.parse(o.payload) : null })) });
});

r.post('/buy', (req, res) => {
  const code = String(req.body?.code || '');
  const item = db.prepare(`SELECT * FROM shop_items WHERE code = ? AND active = 1`).get(code);
  if (!item) return res.status(404).json({ error: 'no_item' });
  if (item.is_exclusive) return res.status(403).json({ error: 'exclusive_only' });
  if (item.premium_only && !(req.user.premium_until > now())) return res.status(403).json({ error: 'premium_required' });

  const payload = item.payload ? JSON.parse(item.payload) : {};

  // Special-case: multipliers and neuron packs are consumable / cumulative.
  // For one-time cosmetics (background, border, prefix slot) check ownership.
  if (['background', 'border', 'prefix'].includes(item.kind)) {
    const owned = db.prepare('SELECT 1 FROM inventory WHERE user_id = ? AND item_code = ?').get(req.user.id, code);
    if (owned) return res.status(400).json({ error: 'already_owned' });
  }

  const txId = spendXp(req.user.id, item.price_xp, 'shop_buy', `Покупка: ${item.name}`, REFUND_WINDOW_MS, code);
  if (!txId) return res.status(400).json({ error: 'not_enough_xp' });

  const t = now();
  if (item.kind === 'multiplier') {
    activateMultiplier(req.user.id, payload.factor, payload.durationSec);
    db.prepare(`INSERT INTO inventory(user_id, item_code, source, acquired_at, expires_at)
                VALUES(?, ?, 'shop', ?, ?)`).run(req.user.id, code, t, t + payload.durationSec * 1000);
  } else if (item.kind === 'neurons_pack') {
    addNeurons(req.user.id, payload.amount, 'neurons_change', `Покупка: ${item.name}`);
  } else {
    db.prepare(`INSERT INTO inventory(user_id, item_code, source, acquired_at, expires_at)
                VALUES(?, ?, 'shop', ?, 0)`).run(req.user.id, code, t);
  }

  const me = db.prepare('SELECT xp, neurons FROM users WHERE id = ?').get(req.user.id);
  res.json({ ok: true, txId, balance: me });
});

r.get('/transactions', (req, res) => {
  const list = db.prepare(
    `SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 200`
  ).all(req.user.id);
  res.json({ transactions: list });
});

r.post('/refund/:txId', (req, res) => {
  const txId = Number(req.params.txId);
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(txId, req.user.id);
  if (!tx) return res.status(404).json({ error: 'no_tx' });
  if (tx.kind !== 'shop_buy') return res.status(400).json({ error: 'not_refundable' });
  if (tx.refunded) return res.status(400).json({ error: 'already_refunded' });
  if (tx.refundable_until <= now()) return res.status(400).json({ error: 'window_expired' });

  // Reverse: refund XP, remove inventory entry, deactivate multiplier if active
  const refundAmount = -tx.amount_xp;
  db.prepare('UPDATE users SET xp = xp + ? WHERE id = ?').run(refundAmount, req.user.id);
  db.prepare('UPDATE transactions SET refunded = 1 WHERE id = ?').run(txId);
  db.prepare(`INSERT INTO transactions(user_id, kind, amount_xp, ref_item_code, note, created_at, refundable_until)
              VALUES(?, 'shop_refund', ?, ?, 'Возврат покупки', ?, 0)`)
    .run(req.user.id, refundAmount, tx.ref_item_code, now());

  const itemCode = tx.ref_item_code;
  if (itemCode) {
    db.prepare('DELETE FROM inventory WHERE user_id = ? AND item_code = ?').run(req.user.id, itemCode);
    const item = db.prepare('SELECT kind, payload FROM shop_items WHERE code = ?').get(itemCode);
    if (item?.kind === 'multiplier') {
      db.prepare('DELETE FROM active_multipliers WHERE user_id = ?').run(req.user.id);
    }
    if (item?.kind === 'background') {
      db.prepare('UPDATE users SET active_bg = NULL WHERE id = ? AND active_bg = ?').run(req.user.id, itemCode);
    }
    if (item?.kind === 'border') {
      db.prepare('UPDATE users SET active_border = NULL WHERE id = ? AND active_border = ?').run(req.user.id, itemCode);
    }
  }

  const me = db.prepare('SELECT xp, neurons FROM users WHERE id = ?').get(req.user.id);
  res.json({ ok: true, balance: me });
});

// Equip / unequip cosmetics from inventory
r.post('/equip', (req, res) => {
  const code = String(req.body?.code || '');
  const slot = String(req.body?.slot || ''); // background | border | clear_bg | clear_border
  if (slot === 'clear_bg') {
    db.prepare('UPDATE users SET active_bg = NULL WHERE id = ?').run(req.user.id);
    return res.json({ ok: true });
  }
  if (slot === 'clear_border') {
    db.prepare('UPDATE users SET active_border = NULL WHERE id = ?').run(req.user.id);
    return res.json({ ok: true });
  }
  const owned = db.prepare('SELECT 1 FROM inventory WHERE user_id = ? AND item_code = ?').get(req.user.id, code);
  if (!owned) return res.status(403).json({ error: 'not_owned' });
  const item = db.prepare('SELECT kind FROM shop_items WHERE code = ?').get(code);
  if (!item) return res.status(404).json({ error: 'no_item' });
  if (item.kind === 'background') db.prepare('UPDATE users SET active_bg = ? WHERE id = ?').run(code, req.user.id);
  else if (item.kind === 'border') db.prepare('UPDATE users SET active_border = ? WHERE id = ?').run(code, req.user.id);
  else return res.status(400).json({ error: 'not_equippable' });
  res.json({ ok: true });
});

export default r;
