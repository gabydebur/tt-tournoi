/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        accent: {
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
        },
        // 2026 palette
        ink: {
          950: '#0a0a0f',
          900: '#0b0d17',
          800: '#11131f',
          700: '#1a1d2e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Instrument Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      animation: {
        'blob-slow': 'blobFloat 12s ease-in-out infinite',
        'blob-slower': 'blobFloat 18s ease-in-out infinite',
        'fade-in-up': 'fadeInUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'aurora': 'aurora 14s ease-in-out infinite',
      },
      keyframes: {
        blobFloat: {
          '0%, 100%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(40px, -30px) scale(1.1)' },
          '66%': { transform: 'translate(-30px, 40px) scale(0.95)' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        aurora: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}
