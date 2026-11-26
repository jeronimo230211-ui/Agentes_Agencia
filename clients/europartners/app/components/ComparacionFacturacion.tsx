'use client'
import { useState, useEffect, useCallback } from 'react'
import { AlertCircle, Receipt } from 'lucide-react'
import { formatUSD } from '@/lib/precio'
import Badge, { type BadgeVariant } from '@/components/ui/Badge'
import SeccionColapsable from '@/components/ui/SeccionColapsable'
import ScrollFadeRight from '@/components/ui/ScrollFadeRight'

interface LineaComparacion {
  match_key: string
  rn: number
  estado_linea: 'coincide' | 'caida' | 'agregada'
  cambio_detectado: boolean
  snapshot_descripcion_pdf: string | null
  actual_descripcion_pdf: string | null
  snapshot_codigo_pdf: string | null
  actual_codigo_pdf: string | null
  snapshot_cantidad: number | null
  actual_cantidad: number | null
  snapshot_precio_cliente_usd: number | null
  actual_precio_cliente_usd: number | null
  snapshot_subtotal_cliente_usd: number | null
  actual_subtotal_cliente_usd: number | null
}

interface TotalesComparacion {
  tiene_snapshot: boolean
  total_snapshot_cliente_usd: number
  total_actual_cliente_usd: number
  n_lineas_coinciden: number
  n_lineas_con_cambio: number
  n_lineas_caidas: number
  n_lineas_agregadas: number
}

// Umbrales de severidad aprobados por Jero (encargo original, ver
// agency-developer): sin cambios = success, diferencia chica (≤$100 y ≤5%)
// = info, y "revisar" (>$100 o >5% o CUALQUIER línea caída/agregada, aunque
// el total cuadre por compensación) = warning -- una línea caída que se
// compensa con una agregada es justo el caso más fácil de no notar.
function severidad(t: TotalesComparacion): { variant: BadgeVariant; label: string } {
  const diferenciaUsd = Math.round(((t.total_actual_cliente_usd ?? 0) - (t.total_snapshot_cliente_usd ?? 0)) * 100) / 100
  const diferenciaAbs = Math.abs(diferenciaUsd)
  const diferenciaPct = t.total_snapshot_cliente_usd > 0
    ? (diferenciaAbs / t.total_snapshot_cliente_usd) * 100
    : (diferenciaAbs > 0 ? Infinity : 0)
  const hayLineasCaidasOAgregadas = t.n_lineas_caidas > 0 || t.n_lineas_agregadas > 0

  if (diferenciaAbs === 0 && !hayLineasCaidasOAgregadas) return { variant: 'success', label: 'Sin cambios' }
  if (diferenciaAbs > 100 || diferenciaPct > 5 || hayLineasCaidasOAgregadas) return { variant: 'warning', label: 'Revisar diferencia' }
  return { variant: 'info', label: 'Diferencia menor' }
}

const ESTILO_LINEA: Partial<Record<LineaComparacion['estado_linea'], { badge: BadgeVariant; label: string }>> = {
  caida: { badge: 'danger', label: 'Se cayó' },
  agregada: { badge: 'info', label: 'Se agregó' },
}

// Delta chico junto al valor actual (ej. "(+2)", "(-$45.00)") -- solo se
// muestra si de verdad cambió; null/undefined (línea caída o agregada, que
// no tiene contraparte del otro lado) no cuenta como cambio. A propósito SIN
// color verde/rojo por dirección (subir/bajar): a diferencia del total de
// arriba (donde facturar MÁS que lo cotizado sí es más grave, por eso ahí es
// rojo), a nivel de línea ninguna dirección es "la buena" -- una cantidad
// facturada mayor puede ser tan problemática como una menor. Solo se marca
// que cambió, en texto neutro.
function Delta({ antes, ahora, formato }: { antes: number | null; ahora: number | null; formato: (n: number) => string }) {
  if (antes == null || ahora == null || antes === ahora) return null
  const sube = ahora > antes
  return (
    <span className="text-xs ml-1 whitespace-nowrap text-warning font-medium">
      ({sube ? '+' : ''}{formato(ahora - antes)})
    </span>
  )
}

// Caja "Cotizado vs. facturado" -- detecta si lo que el cliente aprobó
// (snapshot tomado al pasar a 'enviada', ver migración
// 033_snapshot_lineas_enviadas_cliente.sql) terminó siendo distinto de lo
// que de verdad se facturó (líneas actuales de la proforma). Encargo de
// Deisy (operaciones), nov-2026: hoy puede venderse más/menos o caerse un
// producto del pedido entre el envío y la facturación, y no había forma de
// detectarlo.
//
// El padre (cotizador/[id]/page.tsx) ya filtra por estado -- solo se monta
// si la proforma pasó por 'enviada' (estado actual 'enviada' o
// 'facturada', únicos que llegan ahí según marcar-facturada/route.ts). Acá
// solo queda el gate por `tiene_snapshot` (proformas facturadas ANTES de
// esta migración, sin snapshot real que comparar).
export default function ComparacionFacturacion({ proformaId }: { proformaId: string }) {
  const [totales, setTotales] = useState<TotalesComparacion | null>(null)
  const [lineas, setLineas] = useState<LineaComparacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const cargar = useCallback(() => {
    setLoading(true)
    setError(false)
    fetch(`/api/proformas/${proformaId}/comparacion`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(({ data }) => {
        setTotales(data?.totales ?? null)
        setLineas(data?.lineas ?? [])
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [proformaId])

  useEffect(() => { cargar() }, [cargar])

  if (loading) {
    return (
      <div className="bg-bg-surface border border-border rounded-xl p-4 mb-4 animate-pulse">
        <div className="h-4 w-44 bg-bg-subtle rounded mb-3" />
        <div className="h-10 bg-bg-subtle rounded" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-danger-bg border border-danger text-danger rounded-xl p-3 mb-4 text-sm flex items-center justify-between gap-3 flex-wrap">
        <span className="flex items-center gap-2">
          <AlertCircle size={16} className="flex-none" />
          No se pudo cargar la comparación cotizado vs. facturado
        </span>
        <button type="button" onClick={cargar} className="underline font-medium hover:no-underline flex-none">
          Reintentar
        </button>
      </div>
    )
  }

  if (!totales || !totales.tiene_snapshot) {
    return (
      <div className="bg-bg-surface border border-border rounded-xl p-4 mb-4 text-sm text-text-subtle">
        No hay datos históricos para comparar lo cotizado contra lo facturado en esta proforma (es anterior a este control).
      </div>
    )
  }

  const { variant, label } = severidad(totales)
  const diferenciaUsd = Math.round((totales.total_actual_cliente_usd - totales.total_snapshot_cliente_usd) * 100) / 100
  const diferenciaPct = totales.total_snapshot_cliente_usd > 0
    ? (diferenciaUsd / totales.total_snapshot_cliente_usd) * 100
    : null

  return (
    <div className="bg-bg-surface border border-border rounded-xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Receipt size={16} className="text-text-subtle" />
        <h3 className="font-medium text-text text-sm">Cotizado vs. facturado</h3>
        <Badge variant={variant}>{label}</Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
        <div>
          <p className="text-xs text-text-subtle">Cotizado al cliente</p>
          <p className="font-semibold text-text">{formatUSD(totales.total_snapshot_cliente_usd)}</p>
        </div>
        <div>
          <p className="text-xs text-text-subtle">Facturado hoy</p>
          <p className="font-semibold text-text">{formatUSD(totales.total_actual_cliente_usd)}</p>
        </div>
        <div>
          <p className="text-xs text-text-subtle">Diferencia</p>
          {/* Acá SÍ hay una dirección peor que la otra (a diferencia del Delta
              por línea, ver ese comentario): facturar MÁS de lo que el
              cliente aprobó es el riesgo reputacional/de reclamo (rojo);
              facturar MENOS es ingreso perdido pero no un problema con el
              cliente (ámbar). */}
          <p className={`font-semibold ${diferenciaUsd === 0 ? 'text-text' : diferenciaUsd > 0 ? 'text-danger' : 'text-warning'}`}>
            {diferenciaUsd > 0 ? '+' : ''}{formatUSD(diferenciaUsd)}
            {diferenciaPct != null && ` (${diferenciaPct > 0 ? '+' : ''}${diferenciaPct.toFixed(1)}%)`}
          </p>
        </div>
      </div>

      <p className="text-xs text-text-subtle mb-1">
        {totales.n_lineas_coinciden} sin cambio · {totales.n_lineas_con_cambio} cambiaron · {totales.n_lineas_caidas} se cayeron · {totales.n_lineas_agregadas} se agregaron
      </p>

      {lineas.length > 0 && (
        <SeccionColapsable variante="link" titulo="Ver detalle por línea" tituloAbierto="Ocultar detalle por línea" className="mt-2">
          <ScrollFadeRight className="overflow-x-auto" wrapperClassName="rounded-lg overflow-hidden">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="bg-bg-subtle border-b border-border text-left text-xs text-text-subtle">
                  <th className="p-2 px-3">Código / Descripción</th>
                  <th className="p-2 px-3 text-right">Cantidad</th>
                  <th className="p-2 px-3 text-right">Precio</th>
                  <th className="p-2 px-3 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {lineas.map(l => {
                  const estilo = ESTILO_LINEA[l.estado_linea]
                  const esCaida = l.estado_linea === 'caida'
                  const codigo = esCaida ? l.snapshot_codigo_pdf : l.actual_codigo_pdf
                  const descripcion = esCaida ? l.snapshot_descripcion_pdf : l.actual_descripcion_pdf
                  const cantidad = esCaida ? l.snapshot_cantidad : l.actual_cantidad
                  const precio = esCaida ? l.snapshot_precio_cliente_usd : l.actual_precio_cliente_usd
                  const subtotal = esCaida ? l.snapshot_subtotal_cliente_usd : l.actual_subtotal_cliente_usd
                  return (
                    <tr key={`${l.match_key}-${l.rn}`} className="border-b border-border last:border-0">
                      <td className="p-2 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {estilo && <Badge variant={estilo.badge}>{estilo.label}</Badge>}
                          <span className="text-text-muted">{codigo ? `${codigo} — ` : ''}{descripcion}</span>
                        </div>
                      </td>
                      <td className="p-2 px-3 text-right text-text whitespace-nowrap">
                        {cantidad ?? '—'}
                        <Delta antes={l.snapshot_cantidad} ahora={l.actual_cantidad} formato={n => String(n)} />
                      </td>
                      <td className="p-2 px-3 text-right text-text whitespace-nowrap">
                        {formatUSD(precio ?? 0)}
                        <Delta antes={l.snapshot_precio_cliente_usd} ahora={l.actual_precio_cliente_usd} formato={formatUSD} />
                      </td>
                      <td className="p-2 px-3 text-right text-text font-medium whitespace-nowrap">
                        {formatUSD(subtotal ?? 0)}
                        <Delta antes={l.snapshot_subtotal_cliente_usd} ahora={l.actual_subtotal_cliente_usd} formato={formatUSD} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </ScrollFadeRight>
        </SeccionColapsable>
      )}
    </div>
  )
}
