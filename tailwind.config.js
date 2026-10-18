// Tailwind reads brand colours from CSS variables so dark mode is a single attribute switch.
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: { colors: { gold: "rgb(var(--gold-rgb) / <alpha-value>)", ink: "rgb(var(--ink-rgb) / <alpha-value>)", bg: "rgb(var(--bg-rgb) / <alpha-value>)", card: "rgb(var(--card-rgb) / <alpha-value>)", muted: "rgb(var(--muted-rgb) / <alpha-value>)", brand: "rgb(var(--brand-rgb) / <alpha-value>)" },
    fontFamily: { display: ["Cormorant Garamond", "Noto Sans Bengali", "serif"], body: ["Inter", "Noto Sans Bengali", "sans-serif"] } } },
};
