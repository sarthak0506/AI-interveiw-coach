/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        calm: {
          50: "#f0f9f8",
          100: "#d8f1ed",
          600: "#0f766e",
          700: "#0f5f59",
          900: "#134e4a"
        }
      },
      boxShadow: {
        panel: "0 10px 30px -16px rgba(15, 23, 42, 0.18)"
      }
    },
  },
  plugins: [],
};
