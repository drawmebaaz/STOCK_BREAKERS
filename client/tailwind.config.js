/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 500: "#bc9042", 600: "#8f713e", 900: "#241c10" },
        tape: { 500: "#68c8c3", 900: "#0d2d2a" },
        up: "#3fb77c",
        down: "#dc6b69",
      },
    },
  },
  plugins: [],
};
