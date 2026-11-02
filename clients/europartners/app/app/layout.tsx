import type { Metadata, Viewport } from 'next'
import { Quicksand, Work_Sans } from 'next/font/google'
import './globals.css'

// Work Sans (texto) y Quicksand (headings/display, sistema de Marta oct-2026).
// Ambas en modo "variable": el preset de Tailwind (tailwind.config.ts) usa
// font-family: var(--font-work-sans) / var(--font-quicksand) en vez del
// nombre literal de la fuente -- next/font autohospeda el archivo y genera
// un nombre interno, así que el string "Quicksand" a secas nunca existiría
// en el navegador si no pasamos por la variable.
const workSans = Work_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-work-sans',
  display: 'swap',
})

const quicksand = Quicksand({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-quicksand',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Europartners — Sistema de Operaciones',
  description: 'Sistema de cotización y aprobación de proformas para Europartners International',
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/brand/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/favicon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/brand/favicon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/brand/apple-touch-icon-180.png',
  },
}

// themeColor va en `viewport`, no en `metadata` -- Next 14 marca `metadata.themeColor`
// como deprecado (warning en build) a favor de este export.
export const viewport: Viewport = {
  themeColor: '#162373',
}

// Script anti-flash de tema: debe correr ANTES del primer paint, por eso va
// inline en <head> y no en un useEffect de un componente cliente (eso
// pintaría primero en claro y luego saltaría a oscuro). Lee la preferencia
// guardada por ThemeToggle.tsx (localStorage 'ep_theme'); si el usuario
// nunca la cambió, sigue al sistema operativo.
const THEME_INIT_SCRIPT = `(function () {
  try {
    var guardado = localStorage.getItem('ep_theme');
    var tema = guardado === 'light' || guardado === 'dark'
      ? guardado
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', tema);
  } catch (e) {}
})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning SOLO en este tag: data-theme lo decide a propósito
    // el script anti-flash de abajo, antes del primer paint, así que el servidor
    // nunca lo conoce -- el mismatch server/cliente en este atributo es esperado
    // y hay que silenciarlo (patrón estándar de Next.js), no "arreglarlo" agregando
    // el atributo en el servidor (eso forzaría un tema fijo y rompería el anti-flash).
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      {/* Las clases .variable de next/font solo EXPONEN --font-work-sans/--font-quicksand
          como variables CSS en este elemento y sus hijos -- quien de verdad aplica la
          fuente es tokens.css (--font-body/--font-display encadenan a esas variables)
          vía la regla `body { font-family: var(--font-body) }` de globals.css. */}
      <body
        className={`${workSans.variable} ${quicksand.variable} antialiased bg-[var(--bg-page)] text-[var(--text)]`}
      >
        {children}
      </body>
    </html>
  )
}
