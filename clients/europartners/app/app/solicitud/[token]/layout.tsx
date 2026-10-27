import { SolicitudCarritoProvider } from '@/lib/SolicitudCarritoContext'

// Envuelve tanto el listado (page.tsx) como el detalle de producto
// (producto/[id]/page.tsx) para que el carrito armado en uno siga visible en
// el otro al navegar — ver lib/SolicitudCarritoContext.tsx.
export default function SolicitudTokenLayout({ children }: { children: React.ReactNode }) {
  return <SolicitudCarritoProvider>{children}</SolicitudCarritoProvider>
}
