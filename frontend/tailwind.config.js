/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0f0f16",
        panel: "#161622",
        primary: "#7289da",
        success: "#43b581",
        failed: "#f04747",
        pending: "#faa61a"
      }
    },
  },
  plugins: [],
}
