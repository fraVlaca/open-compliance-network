/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.6s ease-out forwards',
        'fade-in': 'fade-in 0.4s ease-out forwards',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      colors: {
        surface: {
          900: "#0a0f1a",
          800: "#151d2e",
          700: "#1e2a3e",
          600: "#2a3a52",
        },
        accent: {
          blue: "#3b82f6",
          green: "#10b981",
          amber: "#f59e0b",
          red: "#ef4444",
          purple: "#8b5cf6",
          cyan: "#06b6d4",
        },
      },
    },
  },
  plugins: [],
};
