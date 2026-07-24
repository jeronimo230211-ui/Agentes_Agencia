import type { ParametrosPrecio, PrecioCalculado, TipoPrecio } from '@/types/europartners'

export function calcPrecioCliente(
  fob: number,
  cbmUnit: number,
  params: ParametrosPrecio,
  margen: number
): PrecioCalculado {
  const flete_prorrateado = (params.flete_usd / params.cbm_total_contenedor) * cbmUnit
  const arancel = fob * params.arancel_pct
  const precio_sin_margen = fob + flete_prorrateado + arancel
  const precio_cliente = precio_sin_margen * (1 + margen)

  return {
    precio_costo: fob,
    flete_prorrateado,
    arancel,
    precio_sin_margen,
    precio_cliente,
    margen_pct: margen,
  }
}

export function calcMargen(precio_costo: number, precio_cliente: number): number {
  if (!precio_costo || precio_costo === 0) return 0
  return (precio_cliente / precio_costo) - 1
}

// Precio ya calculado por producto (productos.precio_mayorista / precio_detallista),
// no un margen fijo — cada producto puede tener un margen distinto según cuándo se cargó.
export function precioPorTipo(
  precioMayorista: number | null | undefined,
  precioDetallista: number | null | undefined,
  tipo: TipoPrecio
): number | undefined {
  const valor = tipo === 'mayorista' ? precioMayorista : precioDetallista
  return valor ?? undefined
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatPct(pct: number): string {
  return `${(pct * 100).toFixed(1)}%`
}
