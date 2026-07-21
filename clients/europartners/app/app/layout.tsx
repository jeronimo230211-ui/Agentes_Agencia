import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Europartners — Sistema de Operaciones',
  description: 'Sistema de cotización y aprobación de proformas para Europartners International',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased bg-[#F5F7FA]">
        {children}
      </body>
    </html>
  )
}
