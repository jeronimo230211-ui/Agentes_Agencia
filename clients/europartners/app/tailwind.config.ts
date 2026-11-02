import type { Config } from "tailwindcss";

const config: Config = {
  // Preset del sistema de diseño de Marta (docs/design-system/tailwind.preset.js,
  // copiado tal cual a ./tailwind.preset.js) -- mapea los tokens de tokens.css a
  // clases Tailwind. Importante: por cómo está nombrado el preset, las clases
  // reales que genera son "bg-bg-page", "text-text-heading", "text-text-muted",
  // etc. (el nombre del token ya incluye el prefijo bg-/text-, así que Tailwind
  // lo duplica) -- NO "bg-page"/"text-heading" como sugiere implementacion-web.md.
  // Verificado compilando el preset con tailwindcss antes de copiarlo.
  presets: [require('./tailwind.preset.js')],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      // El preset deja font-family en nombres literales ("Quicksand", "Work Sans"),
      // pero esas fuentes se cargan con next/font/google en modo "variable" (ver
      // app/layout.tsx), que genera un nombre interno autohospedado -- el string
      // literal "Quicksand" nunca existe en el navegador. Sobreescribimos aquí
      // (el theme propio del proyecto gana sobre el preset) para que font-display/
      // font-body/font-sans apunten a esas variables CSS y sí carguen la fuente real.
      fontFamily: {
        display: ["var(--font-quicksand)", "Avenir Next", "system-ui", "sans-serif"],
        body: ["var(--font-work-sans)", "Segoe UI", "system-ui", "sans-serif"],
        sans: ["var(--font-work-sans)", "Segoe UI", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
