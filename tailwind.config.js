/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefdf6",
          100: "#d6f9e8",
          200: "#b0f1d4",
          300: "#79e4ba",
          400: "#3ecf9b",
          500: "#16b381",
          600: "#0a9068",
          700: "#087354",
          800: "#0a5b45",
          900: "#094b3a",
        },
        ink: {
          50: "#f6f7f9",
          100: "#eceef2",
          200: "#d5dae1",
          300: "#b3bcc8",
          400: "#8a97a8",
          500: "#6b7a8d",
          600: "#546074",
          700: "#454e5e",
          800: "#3b4250",
          900: "#191d26",
        },
        danger: "#e5484d",
        warn: "#f5a524",
        info: "#3b82f6",
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-in": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(22,179,129,.45)" },
          "70%": { boxShadow: "0 0 0 12px rgba(22,179,129,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(22,179,129,0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up .4s ease-out both",
        "fade-in": "fade-in .3s ease-out both",
        "slide-in": "slide-in .25s ease-out both",
        "scale-in": "scale-in .18s ease-out both",
        "pulse-ring": "pulse-ring 1.8s infinite",
        shimmer: "shimmer 1.6s infinite",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.04), 0 8px 24px -12px rgba(16,24,40,.18)",
        pop: "0 12px 40px -12px rgba(16,24,40,.28)",
      },
    },
  },
  plugins: [],
};
