// Lógica pura del carrito de la solicitud pública — extraída de SolicitudForm
// para poder reutilizarla también desde la página de detalle de producto
// (app/solicitud/[token]/producto/[id]/page.tsx) sin duplicar la regla de
// "fijar cantidad absoluta" (no sumar) en dos archivos distintos.

export interface LineaCarrito {
  key: string
  producto_id?: string
  descripcion_libre?: string
  codigo?: string
  nombre: string
  cantidad: number
  precio_cliente?: number | null
}

export interface ProductoParaCarrito {
  id: string
  codigo?: string
  nombre: string
  precio_cliente?: number | null
}

// Fija la cantidad ABSOLUTA de un producto en el carrito (no la suma) —
// cantidad <= 0 lo quita, si no existe lo crea, si ya existe la actualiza.
export function fijarCantidadProducto(
  carrito: LineaCarrito[],
  producto: ProductoParaCarrito,
  cantidad: number
): LineaCarrito[] {
  const existente = carrito.find(l => l.producto_id === producto.id)
  if (cantidad <= 0) {
    return carrito.filter(l => l.producto_id !== producto.id)
  }
  if (existente) {
    return carrito.map(l => (l.producto_id === producto.id ? { ...l, cantidad } : l))
  }
  return [
    ...carrito,
    {
      key: producto.id,
      producto_id: producto.id,
      codigo: producto.codigo,
      nombre: producto.nombre,
      cantidad,
      precio_cliente: producto.precio_cliente,
    },
  ]
}

export function cantidadEnCarrito(carrito: LineaCarrito[], productoId: string): number {
  return carrito.find(l => l.producto_id === productoId)?.cantidad || 0
}
