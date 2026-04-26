import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, auth } from '../api.js';
import { useAuth } from '../store.js';
import { NeuroMark, GradientHalo, Button, Field, Input, Card } from '../components/ui.jsx';

export default function Register() {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const setUser = useAuth((s) => s.setUser);
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (password !== password2) { setErr('Пароли не совпадают'); return; }
    setBusy(true);
    try {
      const r = await api.register({ username, password, displayName });
      auth.set(r.token);
      setUser(r.user);
      nav('/', { replace: true });
    } catch (e) {
      setErr(translateErr(e));
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-full grid place-items-center p-6 bg-ink-950 relative overflow-hidden">
      <GradientHalo tone="premium" />
      <div className="relative w-full max-w-sm animate-slide-up">
        <div className="text-center mb-9">
          <div className="inline-grid place-items-center mb-4 animate-pop sparkle">
            <NeuroMark size={56} glow />
          </div>
          <h1 className="font-display text-5xl font-bold text-hero leading-none">Регистрация</h1>
          <div className="text-sm text-white/55 mt-2">30 секунд и ты внутри</div>
        </div>

        <Card as="form" onSubmit={submit} className="space-y-3.5 !p-5">
          <Field label="Имя">
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Алексей" />
          </Field>
          <Field label="Имя пользователя"
                 hint="Только латиница, цифры и подчёркивание.">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 32))}
              placeholder="alexserguntsov" autoComplete="username" className="font-mono"
            />
          </Field>
          <Field label="Пароль">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password" placeholder="мин. 6 символов" />
          </Field>
          <Field label="Повторите пароль">
            <Input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)}
              autoComplete="new-password" />
          </Field>

          <Button type="submit" variant="premium" disabled={busy} className="w-full h-12">
            {busy ? 'Создаём…' : 'Создать аккаунт'}
          </Button>

          {err && <div className="text-sm text-bad text-center font-medium pt-1">{err}</div>}
        </Card>

        <div className="mt-5 text-center text-sm">
          <span className="text-white/55">Уже есть аккаунт? </span>
          <Link to="/login" className="text-brand bg-clip-text text-transparent bg-hero-gradient font-semibold hover:underline">
            Войти
          </Link>
        </div>
      </div>
    </div>
  );
}

function translateErr(e) {
  const map = {
    bad_credentials: 'Неверные данные',
    username_short: 'Username слишком короткий (мин. 3)',
    username_taken: 'Имя уже занято',
    password_short: 'Пароль слишком короткий (мин. 6)',
    http_error: 'Сервер не отвечает — проверь backend',
  };
  return map[e?.data?.error] || e?.data?.message || e?.message || 'Ошибка';
}
