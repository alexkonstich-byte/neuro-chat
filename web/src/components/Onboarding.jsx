import React, { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../store.js';
import { Button } from './ui.jsx';

const STEPS = [
  {
    icon: '👋',
    title: 'Привет в Allsafe',
    body: 'Здесь у тебя сразу два чата: «Избранное» — личные заметки, и «Allsafe» — туда приходят коды входа и заявки в поддержку.',
  },
  {
    icon: '✨',
    title: 'Зарабатывай XP',
    body: 'Каждое сообщение даёт XP. Ставь множители из магазина, чтобы получать в 2–10× больше. На казино XP можно крутить слоты.',
  },
  {
    icon: '🛒',
    title: 'Кастомизируйся',
    body: 'Меняй фон профиля, обводку аватара, ник и эмодзи. Обводки бывают живые: радужные, пульсирующие, ауроровые.',
  },
  {
    icon: '🐞',
    title: 'Нашёл баг?',
    body: 'В чате Allsafe есть кнопки «Баг», «Идея» и «Сообщение админу». Заявки попадают прямо к создателю.',
  },
];

export default function Onboarding({ onClose }) {
  const setUser = useAuth((s) => s.setUser);
  const [i, setI] = useState(0);
  const last = i === STEPS.length - 1;
  const step = STEPS[i];

  const finish = async () => {
    try {
      const r = await api.setTutorialDone();
      setUser(r.user);
    } catch {}
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-xl grid place-items-center p-5 animate-pop">
      <div className="w-full max-w-md rounded-4xl overflow-hidden surface-strong border border-white/10 shadow-glass">
        <div className="bg-hero-gradient gradient-bg px-6 py-9 text-center">
          <div className="text-6xl mb-2">{step.icon}</div>
          <div className="font-display font-bold text-2xl text-white">{step.title}</div>
        </div>
        <div className="p-6 text-center">
          <p className="text-white/80 leading-relaxed">{step.body}</p>

          {/* Dots */}
          <div className="mt-5 flex items-center justify-center gap-1.5">
            {STEPS.map((_, k) => (
              <span key={k}
                className={`w-2 h-2 rounded-full transition ${k === i ? 'bg-hero-gradient w-6' : 'bg-white/20'}`} />
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between gap-2">
            <button onClick={finish} className="press text-xs text-white/55 hover:text-white">Пропустить</button>
            {last ? (
              <Button onClick={finish}>Поехали →</Button>
            ) : (
              <Button onClick={() => setI(i + 1)}>Дальше</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
