import React, { useEffect, useRef, useState } from 'react';

/**
 * Full-screen viewer for media of any kind.
 * Props:
 *   open       boolean
 *   onClose    () => void
 *   items      [{ id, kind, url, name?, mime?, duration_ms?, width?, height? }]
 *   index      number — which item to start on
 */
export default function MediaViewer({ open, onClose, items = [], index = 0 }) {
  const [i, setI] = useState(index);
  useEffect(() => { setI(index); }, [index]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'ArrowLeft')  setI((v) => Math.max(0, v - 1));
      if (e.key === 'ArrowRight') setI((v) => Math.min(items.length - 1, v + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, items.length, onClose]);

  if (!open || !items.length) return null;
  const item = items[i] || items[0];

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col animate-pop"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 text-white/85">
        <button onClick={onClose}
          className="press w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center text-lg" aria-label="Закрыть">✕</button>
        <div className="min-w-0 flex-1">
          <div className="text-sm truncate">{item.name || item.kind}</div>
          <div className="text-[11px] text-white/45 font-mono">{i + 1} / {items.length}{item.mime ? ` · ${item.mime}` : ''}</div>
        </div>
        <a href={item.url} download={item.name || ''} target="_blank" rel="noreferrer"
           className="press w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center text-base" aria-label="Скачать">⬇</a>
      </div>

      {/* Stage */}
      <div className="flex-1 grid place-items-center px-4 select-none relative overflow-hidden">
        {items.length > 1 && i > 0 && (
          <button onClick={() => setI(i - 1)} aria-label="Назад"
            className="press absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center text-2xl">‹</button>
        )}
        {items.length > 1 && i < items.length - 1 && (
          <button onClick={() => setI(i + 1)} aria-label="Вперёд"
            className="press absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center text-2xl">›</button>
        )}

        <Stage item={item} />
      </div>

      {/* Bottom strip (multi-attachments) */}
      {items.length > 1 && (
        <div className="px-4 py-3 flex gap-2 overflow-x-auto scrollbar-thin">
          {items.map((it, k) => (
            <button key={it.id ?? k} onClick={() => setI(k)}
              className={`press shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition ${k === i ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'}`}>
              <Thumb item={it} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Stage({ item }) {
  if (item.kind === 'photo' || item.kind === 'image') {
    return <img src={item.url} alt={item.name || ''} className="max-w-full max-h-[78vh] rounded-2xl shadow-2xl object-contain" />;
  }
  if (item.kind === 'video' || item.kind === 'video_note') {
    return (
      <video src={item.url} controls autoPlay playsInline
        className={`max-w-full max-h-[78vh] shadow-2xl ${item.kind === 'video_note' ? 'aspect-square w-[60vmin] object-cover rounded-[28%]' : 'rounded-2xl'}`} />
    );
  }
  if (item.kind === 'voice' || item.kind === 'audio') {
    return <CustomAudio item={item} />;
  }
  // file fallback
  return (
    <div className="rounded-3xl bg-white/5 border border-white/10 p-8 text-center max-w-md">
      <div className="text-5xl mb-3">📎</div>
      <div className="font-display font-semibold truncate">{item.name || 'Файл'}</div>
      <div className="text-xs text-white/55 font-mono mt-1">{item.mime || 'unknown'}</div>
      <a href={item.url} download className="mt-5 inline-flex items-center justify-center w-full px-4 py-2.5 rounded-xl bg-hero-gradient font-semibold">Скачать</a>
    </div>
  );
}

function Thumb({ item }) {
  if (item.kind === 'photo' || item.kind === 'image') return <img src={item.url} className="w-full h-full object-cover" />;
  if (item.kind === 'video' || item.kind === 'video_note') return <video src={item.url} className="w-full h-full object-cover" muted />;
  return <div className="w-full h-full bg-white/10 grid place-items-center text-xl">{item.kind === 'voice' ? '🎙' : '📎'}</div>;
}

/** Lightweight custom audio player with waveform-ish track and playback rate. */
function CustomAudio({ item }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(item.duration_ms ? item.duration_ms / 1000 : 0);
  const [rate, setRate] = useState(1);

  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    const onTime = () => setT(a.currentTime);
    const onMeta = () => { if (!Number.isNaN(a.duration) && Number.isFinite(a.duration)) setDur(a.duration); };
    const onEnd  = () => setPlaying(false);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('ended', onEnd);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('ended', onEnd);
    };
  }, []);

  const toggle = () => {
    const a = audioRef.current; if (!a) return;
    if (a.paused) { a.playbackRate = rate; a.play(); setPlaying(true); }
    else { a.pause(); setPlaying(false); }
  };
  const seek = (e) => {
    const a = audioRef.current; if (!a || !dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    a.currentTime = x * dur;
    setT(a.currentTime);
  };
  const cycleRate = () => {
    const r = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
    setRate(r);
    if (audioRef.current) audioRef.current.playbackRate = r;
  };

  const pct = dur ? Math.min(100, (t / dur) * 100) : 0;

  return (
    <div className="w-full max-w-md rounded-3xl p-5 bg-gradient-to-br from-brand-indigo/20 via-brand-fuchsia/15 to-brand-sky/20 border border-white/10 shadow-2xl">
      <audio ref={audioRef} src={item.url} preload="metadata" />
      <div className="font-display font-semibold mb-3 truncate text-white">{item.name || 'Голосовое'}</div>
      <div className="flex items-center gap-3">
        <button onClick={toggle} aria-label={playing ? 'Пауза' : 'Играть'}
          className="press w-14 h-14 rounded-full bg-hero-gradient grid place-items-center text-2xl text-white shadow-glow-brand">
          {playing ? '❚❚' : '▶'}
        </button>
        <div className="flex-1">
          <div onClick={seek}
            className="relative h-3 rounded-full bg-white/10 cursor-pointer overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-hero-gradient" style={{ width: `${pct}%` }} />
            <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white" style={{ left: `calc(${pct}% - 6px)` }} />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-white/65 font-mono">
            <span>{fmt(t)}</span>
            <span>{fmt(dur)}</span>
          </div>
        </div>
        <button onClick={cycleRate}
          className="press min-w-[44px] h-10 px-2 rounded-full bg-white/10 hover:bg-white/20 text-xs font-mono">{rate}×</button>
      </div>
    </div>
  );
}

function fmt(s) {
  if (!s || !Number.isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${ss}`;
}
