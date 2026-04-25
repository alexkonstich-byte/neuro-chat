import { Router } from 'express';
import { db } from '../db.js';
import { now } from '../util.js';
import { addXp, addNeurons, grantPremium, activateMultiplier } from '../xp.js';

const r = Router();

const SYMBOLS = ['🍒', '🍋', '🍇', '⭐', '🔔', '💎', '7️⃣'];
// Weighted reel for tunable RTP — 7s rare, jackpot rarer.
const REEL = [
  '🍒','🍒','🍒','🍒','🍋','🍋','🍋','🍇','🍇','🍇',
  '⭐','⭐','🔔','🔔','💎','💎','7️⃣',
];

function spinReel() { return REEL[Math.floor(Math.random() * REEL.length)]; }

function getSetting(key, def) {
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return r ? Number(r.value) : def;
}

r.post('/spin', (req, res) => {
  if (req.user.is_banned) return res.status(403).json({ error: 'banned_from_casino' });

  const bet = Math.max(0, Math.floor(Number(req.body?.bet || 0)));
  const minBet = getSetting('casino_min_bet', 5);
  const maxBet = getSetting('casino_max_bet', 5000);
  if (bet < minBet) return res.status(400).json({ error: 'min_bet', minBet });
  if (bet > maxBet) return res.status(400).json({ error: 'max_bet', maxBet });

  const u = db.prepare('SELECT xp FROM users WHERE id = ?').get(req.user.id);
  if (u.xp < bet) return res.status(400).json({ error: 'not_enough_xp' });

  const t = now();
  // Place bet
  db.prepare('UPDATE users SET xp = xp - ? WHERE id = ?').run(bet, req.user.id);
  db.prepare(`INSERT INTO transactions(user_id, kind, amount_xp, note, created_at, refundable_until)
              VALUES(?, 'casino_bet', ?, 'Ставка в казино', ?, 0)`).run(req.user.id, -bet, t);

  const reels = [spinReel(), spinReel(), spinReel()];
  let winXp = 0;
  let winNeurons = 0;
  let jackpot = 0;
  let bonus = null;

  const allSame = reels[0] === reels[1] && reels[1] === reels[2];
  const twoSame = !allSame && (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]);

  if (allSame && reels[0] === '7️⃣') {
    // JACKPOT — 3 months Neuro Premium + big XP
    jackpot = 1;
    winXp = bet * 50;
    grantPremium(req.user.id, 90 * 24 * 3600 * 1000, 'premium_grant', 'Джекпот 7-7-7');
    bonus = { type: 'premium', months: 3 };
  } else if (allSame && reels[0] === '💎') {
    winXp = bet * 25;
    winNeurons = 5;
  } else if (allSame && reels[0] === '⭐') {
    winXp = bet * 15;
    // Random multiplier as bonus
    activateMultiplier(req.user.id, 5, 60 * 60);
    bonus = { type: 'multiplier', factor: 5, durationSec: 3600 };
  } else if (allSame && reels[0] === '🔔') {
    winXp = bet * 12;
  } else if (allSame) {
    winXp = bet * 8;
  } else if (twoSame) {
    winXp = Math.floor(bet * 1.5);
  }

  if (winXp > 0) addXp(req.user.id, winXp, 'casino_win', `Выигрыш: ${reels.join(' ')}`);
  if (winNeurons > 0) addNeurons(req.user.id, winNeurons, 'neurons_change', 'Выигрыш в казино');

  db.prepare(`INSERT INTO casino_spins(user_id, bet_xp, reels, win_xp, win_neurons, jackpot, created_at)
              VALUES(?, ?, ?, ?, ?, ?, ?)`)
    .run(req.user.id, bet, JSON.stringify(reels), winXp, winNeurons, jackpot, t);

  const me = db.prepare('SELECT xp, neurons, premium_until FROM users WHERE id = ?').get(req.user.id);
  res.json({ ok: true, reels, winXp, winNeurons, jackpot, bonus, balance: me });
});

r.get('/leaderboard', (req, res) => {
  const period = String(req.query?.period || 'week');
  let sinceMs = 0;
  if (period === 'day') sinceMs = now() - 24 * 3600 * 1000;
  else if (period === 'week') sinceMs = now() - 7 * 24 * 3600 * 1000;
  else if (period === 'month') sinceMs = now() - 30 * 24 * 3600 * 1000;

  const rows = db.prepare(
    `SELECT s.user_id, MAX(s.win_xp) AS top_win, SUM(s.win_xp) AS total_win,
            COUNT(s.id) AS spins, u.username, u.display_name, u.avatar_path
     FROM casino_spins s
     JOIN users u ON u.id = s.user_id
     WHERE s.created_at >= ?
     GROUP BY s.user_id
     ORDER BY top_win DESC, total_win DESC
     LIMIT 20`
  ).all(sinceMs);
  res.json({ leaderboard: rows, period });
});

r.get('/recent', (req, res) => {
  const rows = db.prepare(
    `SELECT id, bet_xp, reels, win_xp, win_neurons, jackpot, created_at
     FROM casino_spins WHERE user_id = ? ORDER BY id DESC LIMIT 20`
  ).all(req.user.id);
  res.json({ spins: rows.map(r => ({ ...r, reels: JSON.parse(r.reels) })) });
});

export default r;
