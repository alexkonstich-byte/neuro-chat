import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, auth } from '../api.js';
import { useAuth } from '../store.js';
import { AllsafeMark, GradientHalo, Button, Field, Input, PasswordInput, Card } from '../components/ui.jsx';

export default function Login() {
  const [mode, setMode] = useState('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const setUser = useAuth((s) => s.setUser);
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const r = mode === 'password'
        ? await api.login(username, password)
        : await api.loginByCode(username, code);
      auth.set(r.token);
      setUser(r.user);
      nav('/', { replace: true });
    } catch (e) {
      setErr(translateErr(e));
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-full grid place-items-center p-6 bg-ink-950 relative overflow-hidden">
      <GradientHalo />
      <div className="relative w-full max-w-sm animate-slide-up">
        <div className="text-center mb-9">
          <div className="inline-grid place-items-center mb-4 animate-pop sparkle">
            <AllsafeMark size={56} glow />
          </div>
          <h1 className="font-display text-5xl font-bold text-hero leading-none">Allsafe</h1>
          <div className="text-sm text-white/55 mt-2">Войдите в свой аккаунт</div>
        </div>

        <Card as="form" onSubmit={submit} className="space-y-3.5 !p-5">
          <Field label="Имя пользователя">
            <Input
              autoFocus value={username} onChange={(e) => setUsername(e.target.value)}
              autoComplete="username" placeholder="alexserguntsov" className="font-mono"
            />
          </Field>

          {mode === 'password' ? (
            <Field label="Пароль">
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password" placeholder="••••••••" />
            </Field>
          ) : (
            <Field label="Код с другого устройства"
                   hint="Получи код в активной сессии: Профиль → «Войти на другом устройстве».">
              <Input
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                onFocus={(e) => { e.target.setSelectionRange(0, 0); }}
                inputMode="numeric" maxLength={8} placeholder="01234567"
                className="text-left text-xl tracking-[0.35em] font-mono h-14 placeholder:text-white/20" />
            </Field>
          )}

          <Button type="submit" disabled={busy} className="w-full h-12">
            {busy ? 'Входим…' : 'Войти'}
          </Button>

          <button type="button" onClick={() => setMode(mode === 'password' ? 'code' : 'password')}
            className="w-full text-xs text-white/55 hover:text-white py-1 transition">
            {mode === 'password' ? 'Войти по коду с другого устройства →' : '← Войти по паролю'}
          </button>

          {err && <div className="text-sm text-bad text-center font-medium pt-1">{err}</div>}
        </Card>

        <div className="mt-5 text-center text-sm">
          <span className="text-white/55">Нет аккаунта? </span>
          <Link to="/register" className="text-brand bg-clip-text text-transparent bg-hero-gradient font-semibold hover:underline">
            Создать
          </Link>
        </div>
        <div className="mt-2 text-center text-xs text-white/40">
          <Link to="/info" className="hover:text-white">О мессенджере →</Link>
        </div>
      </div>
    </div>
  );
}

function translateErr(e) {
  const map = {
    bad_credentials: 'Неверные данные',
    bad_code: 'Код не подходит или просрочен',
    banned: 'Аккаунт заблокирован',
    username_short: 'Слишком короткий username',
    username_taken: 'Имя занято',
    password_short: 'Пароль слишком короткий',
    http_error: 'Сервер не отвечает — проверь, запущен ли backend',
  };
  return map[e?.data?.error] || e?.data?.message || e?.message || 'Ошибка';
}
