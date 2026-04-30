import React, { useEffect, useRef, useState } from 'react';

/**
 * Custom right-click + long-press context menu.
 *
 * Usage:
 *   const ctx = useContextMenu();
 *   <div {...ctx.handlers(itemsForThisRow)}>...</div>
 *   ctx.element       // place once at the page root, OR rely on the global one in App.jsx
 *
 * Items: [{ icon?: ReactNode, label: string, danger?: boolean, disabled?: boolean, onSelect: () => void }]
 * A null entry creates a divider.
 */
export function useContextMenu() {
  const [open, setOpen] = useState(null); // { x, y, items }

  const close = () => setOpen(null);

  function handlers(getItems) {
    const items = typeof getItems === 'function' ? getItems : () => getItems;
    let pressTimer = null;

    const showAt = (x, y) => {
      const list = items();
      if (!list || list.length === 0) return;
      setOpen({ x, y, items: list });
    };

    return {
      onContextMenu: (e) => {
        e.preventDefault();
        showAt(e.clientX, e.clientY);
      },
      onTouchStart: (e) => {
        const t = e.touches[0];
        const x = t.clientX, y = t.clientY;
        pressTimer = setTimeout(() => {
          if (navigator.vibrate) navigator.vibrate(30);
          showAt(x, y);
        }, 420);
      },
      onTouchMove:  () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } },
      onTouchEnd:   () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } },
      onTouchCancel:() => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } },
    };
  }

  return { handlers, element: open ? <ContextMenuPopup x={open.x} y={open.y} items={open.items} onClose={close} /> : null };
}

function ContextMenuPopup({ x, y, items, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x, y, ready: false });

  useEffect(() => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const m = 8;
    let nx = x, ny = y;
    if (nx + r.width  > window.innerWidth  - m) nx = window.innerWidth  - r.width  - m;
    if (ny + r.height > window.innerHeight - m) ny = window.innerHeight - r.height - m;
    if (nx < m) nx = m;
    if (ny < m) ny = m;
    setPos({ x: nx, y: ny, ready: true });
  }, [x, y]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[55]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }}>
      <div
        ref={ref}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          left: pos.x, top: pos.y,
          opacity: pos.ready ? 1 : 0,
          transform: pos.ready ? 'scale(1)' : 'scale(0.96)',
          transformOrigin: 'top left',
          transition: 'opacity 120ms ease, transform 140ms cubic-bezier(.2,.9,.3,1.4)',
        }}
        className="surface-strong rounded-2xl shadow-2xl border border-white/10 min-w-[220px] py-1.5 backdrop-blur-xl"
      >
        {items.map((it, i) => {
          if (it === null || it === undefined) {
            return <div key={i} className="my-1 mx-2 h-px bg-white/8" />;
          }
          return (
            <button
              key={i}
              disabled={it.disabled}
              onClick={() => { it.onSelect?.(); onClose(); }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm rounded-xl mx-1
                ${it.disabled ? 'opacity-40' : 'hover:bg-white/[0.07] active:bg-white/[0.10]'}
                ${it.danger ? 'text-bad' : 'text-white'}`}
            >
              <span className="w-5 grid place-items-center opacity-80">{it.icon}</span>
              <span className="flex-1">{it.label}</span>
              {it.shortcut && <span className="text-xs text-white/40 font-mono">{it.shortcut}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
