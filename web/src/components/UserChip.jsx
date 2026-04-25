import React from 'react';

export function Avatar({ user, size = 40, ring = true }) {
  const px = size + 'px';
  const url = user?.avatar || null;
  const initials = (user?.displayName || user?.username || '?').slice(0, 2).toUpperCase();
  const border = user?.activeBorder;
  const isRainbow = border === 'border_rainbow';
  const ringColor =
    border === 'border_silver' ? '#c0c0c0' :
    border === 'border_gold' ? '#fbbf24' :
    border === 'border_neon' ? '#22d3ee' :
    null;
  return (
    <div className="relative shrink-0" style={{ width: px, height: px }}>
      {ring && isRainbow && (
        <div className="border-rainbow absolute inset-0 rounded-full" style={{ padding: 2 }} />
      )}
      {ring && ringColor && (
        <div className="absolute inset-0 rounded-full" style={{ boxShadow: `0 0 0 2px ${ringColor}` }} />
      )}
      <div
        className="absolute inset-[2px] rounded-full bg-ink-700 flex items-center justify-center text-sm font-bold overflow-hidden"
      >
        {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <span>{initials}</span>}
      </div>
    </div>
  );
}

export function NameLine({ user, withPrefix = true, withEmoji = true, className = '' }) {
  if (!user) return null;
  const nickStyle = user.nickColor && user.isPremium ? { color: user.nickColor } : null;
  const prefixStyle = user.prefixColor && user.isPremium ? { color: user.prefixColor } : null;
  return (
    <span className={className}>
      {withPrefix && user.prefixText ? (
        <span style={prefixStyle} className="opacity-90 mr-1">{user.prefixText}</span>
      ) : null}
      <span style={nickStyle} className="font-semibold">{user.displayName || user.username}</span>
      {user.isPremium && <span className="ml-1 text-xs opacity-80" title="Neuro Premium">✦</span>}
      {withEmoji && user.isPremium && user.customEmoji ? (
        <span className="ml-1">{user.customEmoji}</span>
      ) : null}
    </span>
  );
}

export function ProfileBackground({ code, className = '', children }) {
  // Lookup gradient classes by code in a static table mirroring the seeded shop.
  const G = {
    bg_aurora:     'from-fuchsia-500 via-purple-600 to-indigo-700',
    bg_sunset:     'from-amber-400 via-rose-500 to-fuchsia-700',
    bg_ocean:      'from-cyan-400 via-sky-600 to-indigo-900',
    bg_emerald:    'from-emerald-300 via-teal-600 to-emerald-900',
    bg_lava:       'from-yellow-400 via-red-600 to-rose-900',
    bg_neon:       'from-pink-400 via-fuchsia-500 to-cyan-400',
    bg_galaxy:     'from-indigo-900 via-purple-800 to-black',
    bg_mint:       'from-lime-300 via-emerald-400 to-cyan-500',
    bg_blood:      'from-rose-700 via-red-900 to-black',
    bg_white_gold: 'from-yellow-100 via-amber-300 to-orange-500',
  };
  const cls = G[code] || 'from-ink-700 via-ink-800 to-ink-900';
  return (
    <div className={`relative bg-gradient-to-br ${cls} gradient-bg ${className}`}>{children}</div>
  );
}
