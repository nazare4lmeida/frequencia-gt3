/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'gt-navy': '#001f3f',       // Azul Marinho
        'gt-teal': '#008080',       // IA + Soft Skills
        'gt-slate': '#2F4F4F',      // IA Generativa
        'gt-gray-light': '#F5F5F5', // Cinza de fundo
      }
    },
  },
  plugins: [],
}