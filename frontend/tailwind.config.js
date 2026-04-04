/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#07080f",
        surface: "#10121a",
        card: "#191c26",
        primary: "#6c8ae6",
        success: "#4ad7a3",
        warning: "#f7b955",
        danger: "#f04f6e",
        muted: "#9fb0d8",
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
