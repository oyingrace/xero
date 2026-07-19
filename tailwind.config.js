/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        board: {
          bg: "#0f1410",
          line: "#2a3a2c",
          cell: "#161d17",
        },
        x: {
          DEFAULT: "#5fae62",
          soft: "#3c6e47",
        },
        o: {
          DEFAULT: "#e0aa52",
          soft: "#a8742a",
        },
      },
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
