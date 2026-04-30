import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Chats from './pages/Chats.jsx';
import { NeuroMark } from './components/ui.jsx';
import Onboarding from './components/Onboarding.jsx';
import { useAuth } from './store.js';

/**
 * Layout shell:
 *  - lg+ (desktop): persistent left sidebar with chat list + right main pane.
 *  - <lg (mobile/tablet): the sidebar takes the full screen on `/`, and the
 *    main pane takes the full screen on deeper routes (/chat, /profile, ...).
 */
export default function AppShell() {
  const loc = useLocation();
  const isRoot = loc.pathname === '/';
  const user = useAuth((s) => s.user);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (user && user.tutorialDone === false) setShowOnboarding(true);
    else setShowOnboarding(false);
  }, [user?.tutorialDone, user?.id]);

  return (
    <div className="h-full flex bg-ink-950 overflow-hidden">
      <aside
        className={`${isRoot ? 'flex' : 'hidden'} lg:flex flex-col w-full lg:w-[380px] lg:max-w-[380px] lg:border-r lg:border-white/5 lg:shrink-0`}
        // overscroll-contain: scroll inside this aside doesn't bubble to <main>
        style={{ overscrollBehavior: 'contain' }}
      >
        <Chats />
      </aside>
      <main
        className={`${isRoot ? 'hidden lg:block' : 'block'} flex-1 min-w-0 relative h-full overflow-y-auto`}
        style={{ overscrollBehavior: 'contain' }}
      >
        <Outlet />
      </main>
      {showOnboarding && <Onboarding onClose={() => setShowOnboarding(false)} />}
    </div>
  );
}

/** Empty state shown in the right pane on desktop when no chat is open. */
export function DesktopEmpty() {
  return (
    <div className="hidden lg:flex h-full flex-col items-center justify-center text-center px-10 relative overflow-hidden">
      {/* Subtle moving halo */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-brand-indigo/10 blur-[140px] animate-mesh-drift" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-brand-fuchsia/10 blur-[140px] animate-mesh-drift" style={{ animationDelay: '-10s' }} />
      </div>
      <div className="relative">
        <div className="mx-auto mb-6 animate-pop">
          <NeuroMark size={88} glow />
        </div>
        <h2 className="font-display text-3xl font-bold mb-2 text-hero">Выберите чат</h2>
        <p className="text-white/55 max-w-sm">
          Откройте любой диалог слева или начните новый. Чат «Избранное»
          и «Neuro» уже на месте.
        </p>
      </div>
    </div>
  );
}
