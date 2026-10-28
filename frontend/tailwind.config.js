/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bank: {
          navy: "#0F172A",
          slate: "#1E293B",
          blue: "#2563EB",
          blueDark: "#1D4ED8",
          blueLight: "#EFF6FF",
          bg: "#F8FAFC",
          card: "#FFFFFF",
          border: "#E2E8F0",
          success: "#10B981",
          warning: "#F59E0B",
          danger: "#EF4444",
          muted: "#64748B"
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
