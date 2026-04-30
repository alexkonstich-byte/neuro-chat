/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Midnight ladder — backed by CSS vars so themes can swap them at runtime.
        ink: {
          950: 'var(--bg)',
          900: 'var(--bg-elev)',
          800: 'var(--bg-elev-2)',
          700: 'var(--bg-elev-3)',
          600: '#1B1E2B',
          500: '#262A3B',
          400: '#3A3F55',
          300: '#5C627A',
        },
        // Brand: also CSS vars — the gradient classes below stay literal.
        brand: {
          indigo:  'var(--brand-1)',
          fuchsia: 'var(--brand-2)',
          sky:     'var(--brand-3)',
        },
        premium: { amber: '#FFB13B', rose: '#FF5BA3' },
        ok:   '#34D399',
        warn: '#F59E0B',
        bad:  '#FB7185',
      },
      backgroundImage: {
        'hero-gradient':   'linear-gradient(135deg, var(--brand-1) 0%, var(--brand-2) 50%, var(--brand-3) 100%)',
        'hero-soft':       'linear-gradient(135deg, color-mix(in srgb, var(--brand-1) 24%, transparent) 0%, color-mix(in srgb, var(--brand-2) 18%, transparent) 50%, color-mix(in srgb, var(--brand-3) 24%, transparent) 100%)',
        'premium-gradient':'linear-gradient(135deg,#FFB13B 0%, #FF5BA3 100%)',
        'casino-gradient': 'linear-gradient(135deg,#FFB13B 0%, #FF5BA3 50%, var(--brand-2) 100%)',
        'mesh-1':          'radial-gradient(120% 80% at 0% 0%, color-mix(in srgb, var(--brand-1) 38%, transparent) 0%, transparent 60%), radial-gradient(120% 80% at 100% 100%, color-mix(in srgb, var(--brand-2) 32%, transparent) 0%, transparent 60%)',
      },
      boxShadow: {
        'glass':       '0 24px 60px -20px rgba(91,114,255,0.35), 0 8px 24px -12px rgba(197,107,255,0.20)',
        'glow-brand':  '0 0 0 1px rgba(91,114,255,0.35), 0 0 32px -2px rgba(91,114,255,0.45)',
        'glow-premium':'0 0 0 1px rgba(255,177,59,0.35), 0 0 32px -2px rgba(255,91,163,0.40)',
        'inner-line':  'inset 0 1px 0 0 rgba(255,255,255,0.06)',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      animation: {
        'gradient-x':  'gradientX 16s ease-in-out infinite',
        'mesh-drift':  'meshDrift 22s ease-in-out infinite',
        'pop':         'pop 220ms cubic-bezier(.2,.9,.3,1.4)',
        'slide-up':    'slideUp 260ms cubic-bezier(.2,.9,.3,1)',
        'sheet-in':    'sheetIn 280ms cubic-bezier(.2,.9,.3,1)',
        'shimmer':     'shimmer 2.4s linear infinite',
        'pulse-soft':  'pulseSoft 2.6s ease-in-out infinite',
      },
      keyframes: {
        gradientX: {
          '0%, 100%': { 'background-position': '0% 50%' },
          '50%':      { 'background-position': '100% 50%' },
        },
        meshDrift: {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%':      { transform: 'translate3d(2%, -1%, 0) scale(1.05)' },
        },
        pop: {
          '0%':   { transform: 'scale(0.92)', opacity: '0' },
          '60%':  { transform: 'scale(1.04)', opacity: '1' },
          '100%': { transform: 'scale(1)' },
        },
        slideUp: {
          '0%':   { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        sheetIn: {
          '0%':   { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { 'background-position': '-200% 0' },
          '100%': { 'background-position': '200% 0' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.6' },
          '50%':      { opacity: '1' },
        },
      },
    },
  },
  safelist: [
    { pattern: /^(from|via|to)-(amber|rose|fuchsia|purple|indigo|cyan|sky|emerald|teal|yellow|red|pink|lime|orange|slate)-(100|200|300|400|500|600|700|800|900)$/ },
    'from-yellow-100','via-amber-300','to-orange-500',
  ],
  plugins: [],
};
