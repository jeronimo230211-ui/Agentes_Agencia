import type { Metadata } from 'next'
import { Work_Sans } from 'next/font/google'
import './globals.css'

// Misma tipografía que se calibró para el PDF de proforma contra el
// archivo real de Canva de la diseñadora — antes la app declaraba 'Inter'
// en globals.css pero nunca la cargaba de ningún lado, así que en la
// práctica ya corría en la fuente del sistema.
const workSans = Work_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'] })

export const metadata: Metadata = {
  title: 'Europartners — Sistema de Operaciones',
  description: 'Sistema de cotización y aprobación de proformas para Europartners International',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${workSans.className} antialiased bg-[#F5F7FA]`}>
        {children}
      </body>
    </html>
  )
}
