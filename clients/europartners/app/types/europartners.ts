export type Rol = 'operaciones' | 'admin' | 'analista'
export type Incoterm = 'FOB' | 'CFR' | 'CIF'
export type ModoPricing = 'set' | 'componente'
export type EstadoProforma = 'borrador' | 'en_revision' | 'aprobada' | 'rechazada' | 'enviada' | 'facturada'
export type EstadoProducto = 'activo' | 'descontinuado' | 'pendiente'

export interface Usuario {
  id: string
  nombre: string
  rol: Rol
  email?: string
  activo: boolean
  created_at: string
}

export interface Cliente {
  id: string
  nombre: string
  slug: string
  pais: string
  ciudad?: string
  contacto_nombre?: string
  contacto_email?: string
  contacto_telefono?: string
  incoterm: Incoterm
  modo_pricing: ModoPricing
  usa_numeracion_propia: boolean
  prefijo_numeracion?: string
  margenes_categoria: Record<string, number>
  issuer_pdf: string
  notas?: string
  activo: boolean
}

export interface CategoriaProducto {
  id: string
  nombre: string
  orden: number
}

export interface Producto {
  id: string
  categoria_id?: string
  categoria?: CategoriaProducto
  codigo?: string
  descripcion: string
  proveedor: string
  precio_fob_usd?: number
  precio_fob_fecha?: string
  cbm_unitario?: number
  estado: EstadoProducto
  variantes?: ProductoVariante[]
  componentes?: ProductoComponente[]
}

export interface ProductoVariante {
  id: string
  producto_id: string
  variante: string
  codigo_variante?: string
  precio_fob_usd?: number
  cbm_unitario?: number
  activo: boolean
}

export interface ProductoComponente {
  id: string
  producto_id: string
  componente: string
  precio_fob_usd?: number
  orden: number
}

export interface ParametrosPrecio {
  id: string
  nombre: string
  flete_usd: number
  cbm_total_contenedor: number
  arancel_pct: number
  valido_desde: string
  activo: boolean
}

export interface ProformaLinea {
  id: string
  proforma_id: string
  orden: number
  producto_id?: string
  variante_id?: string
  componente_id?: string
  descripcion_pdf: string
  codigo_pdf?: string
  cantidad: number
  precio_costo_usd?: number
  precio_cliente_usd?: number
  margen_pct?: number
  subtotal_costo_usd?: number
  subtotal_cliente_usd?: number
  notas?: string
  // Joined
  producto?: Producto
  variante?: ProductoVariante
  componente?: ProductoComponente
}

export interface Proforma {
  id: string
  numero: string
  numero_cliente?: string
  cliente_id: string
  parametros_precio_id?: string
  creada_por?: string
  aprobada_por?: string
  fecha: string
  fecha_vencimiento?: string
  incoterm: Incoterm
  modo_pricing: ModoPricing
  total_fob_usd?: number
  total_flete_usd?: number
  total_cif_usd?: number
  estado: EstadoProforma
  notas_internas?: string
  motivo_rechazo?: string
  pdf_url?: string
  importado_de_excel: boolean
  created_at: string
  // Joined
  cliente?: Cliente
  lineas?: ProformaLinea[]
  parametros_precio?: ParametrosPrecio
  creador?: Usuario
}

export interface HistorialPrecio {
  id: string
  cliente_id: string
  producto_id?: string
  variante_id?: string
  componente_id?: string
  proforma_id?: string
  proforma_numero?: string
  fecha_proforma?: string
  precio_costo_usd?: number
  precio_cliente_usd?: number
  margen_pct?: number
  created_at: string
}

export interface ProformaEvento {
  id: string
  proforma_id: string
  usuario_id?: string
  estado_desde?: string
  estado_hacia: string
  comentario?: string
  created_at: string
  usuario?: Usuario
}

export interface Notificacion {
  id: string
  usuario_id: string
  tipo: string
  proforma_id?: string
  mensaje?: string
  leida: boolean
  created_at: string
  proforma?: Proforma
}

// Tipos de respuesta API
export interface ApiResponse<T> {
  data?: T
  error?: string
}

export interface PrecioCalculado {
  precio_costo: number
  flete_prorrateado: number
  arancel: number
  precio_sin_margen: number
  precio_cliente: number
  margen_pct: number
}

// T1 — Solicitud de cliente (previo a la proforma)
export type EstadoSolicitud = 'pendiente' | 'revisada' | 'convertida' | 'descartada'

export interface SolicitudLinea {
  id: string
  solicitud_id: string
  producto_id?: string
  descripcion_libre?: string
  cantidad: number
  notas?: string
  created_at: string
  // Joined
  producto?: Producto
}

export interface Solicitud {
  id: string
  cliente_id: string
  estado: EstadoSolicitud
  notas_cliente?: string
  revisada_por?: string
  proforma_id?: string
  created_at: string
  updated_at: string
  // Joined
  cliente?: Cliente
  lineas?: SolicitudLinea[]
}

// T5/T6 — Despacho y tránsito
export type EstadoDespacho = 'preparando' | 'en_transito' | 'en_puerto' | 'entregado'
export type EstadoPago = 'pendiente' | 'parcial' | 'pagado'

export interface Despacho {
  id: string
  proforma_id: string
  naviera?: string
  numero_bl?: string
  puerto_origen: string
  puerto_destino: string
  fecha_despacho?: string
  fecha_llegada_estimada?: string
  fecha_llegada_real?: string
  shipping_fee_usd?: number
  estado: EstadoDespacho
  archivo_bl_url?: string
  archivo_shipping_fee_url?: string
  archivo_picking_url?: string
  picking_descripcion?: string
  notas?: string
  created_at: string
  updated_at: string
  // Joined
  proforma?: Proforma
}
