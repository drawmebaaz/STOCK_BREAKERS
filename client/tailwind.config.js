/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 500: "#c6a15b", 600: "#8b713e", 900: "#241c10" },
        tape: { 500: "#53d6d0", 900: "#062422" },
        up: "#4fbf86",
        down: "#e06f70",
      },
    },
  },
  plugins: [],
};
