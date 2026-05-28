/** @type {import('tailwindcss').Config} */
export default {
  content: ['./renderer/**/*.{html,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0f0f0f',
          surface: '#1a1a1a',
          elevated: '#242424',
          hover: '#2a2a2a',
        },
        border: {
          DEFAULT: '#2e2e2e',
          subtle: '#222222',
        },
        text: {
          DEFAULT: '#e2e2e2',
          muted: '#737373',
          faint: '#4a4a4a',
        },
        accent: {
          DEFAULT: '#8b5cf6',
          dim: '#6d28d9',
          glow: 'rgba(139,92,246,0.15)',
        },
        agent: {
          cyan: '#06b6d4',
          magenta: '#d946ef',
          yellow: '#eab308',
          green: '#22c55e',
          blue: '#3b82f6',
          red: '#ef4444',
        },
        status: {
          success: '#22c55e',
          warning: '#f59e0b',
          error: '#ef4444',
          info: '#3b82f6',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideIn: { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};
