/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
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
