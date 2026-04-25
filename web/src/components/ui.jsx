import React, { forwardRef, useEffect, useRef } from 'react';

/* ---------------- Brand mark ---------------- */
export function NeuroMark({ size = 28, glow = false }) {
  const px = size + 'px';
  return (
    <svg width={px} height={px} viewBox="0 0 64 64" fill="none" aria-hidden="true"
         className={glow ? 'drop-shadow-[0_0_18px_rgba(197,107,255,0.55)]' : ''}>
      <defs>
        <linearGradient id="nm-g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#5B72FF" />
          <stop offset="0.5" stopColor="#C56BFF" />
          <stop offset="1" stopColor="#65DEFF" />
        </linearGradient>
      </defs>
      <path d="M32 2 L58 17 L58 47 L32 62 L6 47 L6 17 Z" fill="url(#nm-g)" />
      <path d="M22 44 L22 22 L26 22 L40 38 L40 22 L44 22 L44 44 L40 44 L26 28 L26 44 Z"
            fill="white" stroke="white" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------------- Mesh halo background ---------------- */
export function GradientHalo({ className = '', tone = 'brand' }) {
  if (tone === 'premium') {
    return (
      <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
        <div className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full bg-premium-rose/30 blur-[110px] animate-mesh-drift" />
        <div className="absolute -bottom-40 -right-40 w-[560px] h-[560px] rounded-full bg-premium-amber/25 blur-[120px] animate-mesh-drift" />
      </div>
    );
  }
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <div className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full bg-brand-indigo/30 blur-[120px] animate-mesh-drift" />
      <div className="absolute top-1/3 right-[-10%] w-[440px] h-[440px] rounded-full bg-brand-fuchsia/25 blur-[110px] animate-mesh-drift" style={{ animationDelay: '-8s' }} />
      <div className="absolute -bottom-40 left-1/3 w-[480px] h-[480px] rounded-full bg-brand-sky/25 blur-[120px] animate-mesh-drift" style={{ animationDelay: '-14s' }} />
    </div>
  );
}

/* ---------------- Button ---------------- */
export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', className = '', children, asChild = false, ...rest }, ref) {
  const base = 'press inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap select-none disabled:opacity-50 disabled:pointer-events-none';
  const sizes = {
    sm: 'h-9 px-4 text-sm',
    md: 'h-11 px-5 text-[15px]',
    lg: 'h-14 px-7 text-base',
    icon: 'h-11 w-11 p-0',
  };
  const variants = {
    primary: 'bg-hero-gradient text-white shadow-glow-brand hover:brightness-110',
    premium: 'bg-premium-gradient text-white shadow-glow-premium',
    ghost:   'bg-white/5 hover:bg-white/10 text-white border border-white/10',
    subtle:  'bg-ink-700 hover:bg-ink-600 text-white',
    danger:  'bg-bad/90 hover:bg-bad text-white',
    outline: 'border border-white/15 hover:bg-white/5 text-white',
    glass:   'surface text-white hover:bg-white/[0.08]',
  };
  const cls = `${base} ${sizes[size]} ${variants[variant]} ${className}`;
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, { className: `${cls} ${children.props.className || ''}`, ref, ...rest });
  }
  return <button ref={ref} className={cls} {...rest}>{children}</button>;
});

/* ---------------- Icon button ---------------- */
export function IconButton({ children, className = '', tone = 'ghost', ...rest }) {
  const tones = {
    ghost:  'hover:bg-white/10 text-white/85 active:bg-white/15',
    accent: 'bg-hero-gradient text-white shadow-glow-brand',
    danger: 'text-bad hover:bg-bad/15',
  };
  return (
    <button {...rest} className={`press w-10 h-10 grid place-items-center rounded-full ${tones[tone]} ${className}`}>
      {children}
    </button>
  );
}

/* ---------------- Card ---------------- */
export function Card({ className = '', as: Tag = 'div', ...rest }) {
  return <Tag className={`surface rounded-3xl p-5 shadow-glass ${className}`} {...rest} />;
}

/* ---------------- Field (input + label + hint) ---------------- */
export function Field({ label, hint, error, children }) {
  return (
    <label className="block">
      {label && <div className="text-[11px] uppercase tracking-[0.18em] text-white/55 mb-1.5 font-mono">{label}</div>}
      {children}
      {hint && !error && <div className="mt-1 text-xs text-white/50">{hint}</div>}
      {error && <div className="mt-1 text-xs text-bad">{error}</div>}
    </label>
  );
}
export function Input({ className = '', ...rest }) {
  return (
    <input
      {...rest}
      className={`w-full h-12 rounded-xl bg-ink-800 border border-white/[0.06] px-4 outline-none transition focus:border-brand-indigo/60 focus:ring-2 focus:ring-brand-indigo/30 placeholder:text-white/30 ${className}`}
    />
  );
}

/* ---------------- Tag / Badge ---------------- */
export function Tag({ children, tone = 'default', className = '' }) {
  const tones = {
    default: 'bg-white/8 text-white/80 border border-white/10',
    brand:   'bg-brand-indigo/15 text-brand-sky border border-brand-indigo/30',
    premium: 'bg-premium-rose/15 text-premium-amber border border-premium-amber/30',
    ok:      'bg-ok/15 text-ok border border-ok/30',
    warn:    'bg-warn/15 text-warn border border-warn/30',
    bad:     'bg-bad/15 text-bad border border-bad/30',
  };
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-semibold ${tones[tone]} ${className}`}>{children}</span>;
}

/* ---------------- Bottom sheet ---------------- */
export function Sheet({ open, onClose, children, title }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm animate-pulse-soft" />
      <div ref={ref}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-md surface-strong rounded-t-4xl sm:rounded-3xl shadow-glass animate-sheet-in safe-bottom">
        <div className="pt-2.5">
          <div className="mx-auto h-1 w-10 rounded-full bg-white/15" />
        </div>
        {title && <div className="px-5 pt-4 pb-2 font-display text-lg">{title}</div>}
        <div className="px-3 pb-3">{children}</div>
      </div>
    </div>
  );
}

/* ---------------- Empty state ---------------- */
export function EmptyState({ icon = '✦', title, hint, action }) {
  return (
    <div className="flex flex-col items-center text-center py-16 px-8">
      <div className="text-6xl mb-3 opacity-80 animate-pop">{icon}</div>
      <div className="font-display text-xl text-white/90">{title}</div>
      {hint && <div className="text-sm text-white/55 mt-1.5 max-w-xs">{hint}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------------- Page header (mobile sticky) ---------------- */
export function PageHeader({ left, title, right, subtitle }) {
  return (
    <div className="safe-top sticky top-0 z-20 surface-strong border-b border-white/5 px-3 py-2 flex items-center gap-2">
      <div className="w-10 grid place-items-center">{left}</div>
      <div className="flex-1 min-w-0 text-center">
        <div className="font-display text-base truncate">{title}</div>
        {subtitle && <div className="text-[11px] text-white/55 truncate">{subtitle}</div>}
      </div>
      <div className="w-10 grid place-items-center">{right}</div>
    </div>
  );
}

/* ---------------- Back button ---------------- */
export function BackButton({ onClick, to }) {
  const Tag = to ? 'a' : 'button';
  return (
    <Tag href={to} onClick={onClick} className="press w-10 h-10 grid place-items-center rounded-full hover:bg-white/10">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M14 4 L7 11 L14 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </Tag>
  );
}

/* ---------------- Section heading ---------------- */
export function Section({ children, className = '' }) {
  return <div className={`text-[11px] uppercase tracking-[0.22em] font-mono text-white/45 mb-2 ${className}`}>{children}</div>;
}

/* ---------------- Pull-to-refresh ---------------- */
export function PullToRefresh({ onRefresh, children }) {
  const [pull, setPull] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const startY = React.useRef(null);
  const refY = React.useRef(0);
  const threshold = 64;

  const onTouchStart = (e) => {
    const el = e.currentTarget;
    if (el.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e) => {
    if (startY.current == null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy <= 0) { setPull(0); return; }
    const damped = Math.min(120, dy * 0.5);
    setPull(damped);
    refY.current = damped;
  };
  const onTouchEnd = async () => {
    startY.current = null;
    if (refY.current >= threshold && !busy) {
      setBusy(true);
      try { await onRefresh?.(); } catch {}
      setBusy(false);
    }
    setPull(0);
    refY.current = 0;
  };

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
         className="relative overflow-y-auto h-full">
      <div className="absolute left-0 right-0 flex justify-center pointer-events-none transition-all"
           style={{ top: 0, transform: `translateY(${Math.max(0, pull - 30)}px)`, opacity: Math.min(1, pull / threshold) }}>
        <div className={`mt-2 w-9 h-9 rounded-full border-2 border-brand-indigo/40 border-t-brand-indigo grid place-items-center ${busy ? 'animate-spin' : ''}`}
             style={{ transform: `rotate(${pull * 4}deg)` }}>
          {busy ? '' : '↓'}
        </div>
      </div>
      <div style={{ transform: `translateY(${pull}px)`, transition: pull === 0 ? 'transform 220ms cubic-bezier(.2,.9,.3,1)' : 'none' }}>
        {children}
      </div>
    </div>
  );
}

/* ---------------- Swipe-back gesture (mobile) ----------------
 * Wrap a page content in <SwipeBack onBack={() => nav(-1)}>...</SwipeBack>.
 * Drag from left edge to slide-out the page horizontally. Releases beyond threshold → onBack().
 */
export function SwipeBack({ onBack, children }) {
  const [x, setX] = React.useState(0);
  const startX = React.useRef(null);
  const threshold = 80;
  const onTouchStart = (e) => {
    if (e.touches[0].clientX > 24) return; // edge only
    startX.current = e.touches[0].clientX;
  };
  const onTouchMove = (e) => {
    if (startX.current == null) return;
    const dx = e.touches[0].clientX - startX.current;
    if (dx <= 0) { setX(0); return; }
    setX(Math.min(window.innerWidth, dx));
  };
  const onTouchEnd = () => {
    if (startX.current == null) return;
    const out = x;
    startX.current = null;
    if (out > threshold) onBack?.();
    setX(0);
  };
  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
         style={{ transform: `translateX(${x}px)`, transition: x === 0 ? 'transform 220ms cubic-bezier(.2,.9,.3,1)' : 'none', height: '100%' }}>
      {children}
    </div>
  );
}
