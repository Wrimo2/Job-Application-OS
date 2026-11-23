/** @type {import('tailwindcss').Config} */
const token = (name) => `hsl(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
      },
      colors: {
        border: token('border'),
        input: token('input'),
        ring: token('ring'),
        background: token('background'),
        foreground: token('foreground'),
        primary: { DEFAULT: token('primary'), foreground: token('primary-foreground') },
        muted: { DEFAULT: token('muted'), foreground: token('muted-foreground') },
        accent: { DEFAULT: token('accent'), foreground: token('accent-foreground') },
        card: { DEFAULT: token('card'), foreground: token('card-foreground') },
        popover: { DEFAULT: token('popover'), foreground: token('popover-foreground') },
        sidebar: { DEFAULT: token('sidebar'), foreground: token('sidebar-foreground') },
      },
      borderRadius: {
        lg: '0.625rem',
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(16,16,24,0.04), 0 1px 1px rgba(16,16,24,0.02)',
        lift: '0 8px 24px -8px rgba(16,16,24,0.18), 0 2px 6px -2px rgba(16,16,24,0.08)',
        glow: '0 0 0 1px hsl(var(--primary) / 0.25), 0 8px 30px -10px hsl(var(--primary) / 0.45)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'scale-in': {
          from: { opacity: '0', transform: 'translate(-50%, 0) scale(0.97)' },
          to: { opacity: '1', transform: 'translate(-50%, 0) scale(1)' },
        },
        'pop-in': { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        'slide-in-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'flame': { '0%,100%': { transform: 'scale(1) rotate(-2deg)' }, '50%': { transform: 'scale(1.08) rotate(2deg)' } },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        'fade-up': 'fade-up 260ms cubic-bezier(.2,.8,.2,1) both',
        'scale-in': 'scale-in 180ms cubic-bezier(.2,.8,.2,1)',
        'pop-in': 'pop-in 160ms cubic-bezier(.2,.8,.2,1)',
        'slide-in-right': 'slide-in-right 260ms cubic-bezier(.2,.8,.2,1)',
        'slide-in-up': 'slide-in-up 260ms cubic-bezier(.2,.8,.2,1)',
        flame: 'flame 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
