'use client'
import { useState } from 'react'
import { Layers, Plus, Loader2, Pencil, X } from 'lucide-react'
import { formatUSD } from '@/lib/precio'

export interface Variante {
  id: string
  producto_id: string
  variante: string
  precio_fob_usd: number | null
}

export interface Componente {
  id: string
  producto_id: string
  variante_id: string | null
  componente: string
  precio_fob_usd: number | null
  orden: number
}

const CHIPS_SUGERIDOS = ['Tank', 'Bowl', 'Seat Cover', 'Otro']

// Mismo patrón de mapeo de error de backend que FijarPrecioEspecialModal --
// nunca se muestra el texto crudo de Postgres, el backend ya devuelve el
// mensaje legible (409 para nombre repetido).
async function leerError(res: Response, fallback: string): Promise<string> {
  const j = await res.json().catch(() => ({}))
  return j.error || fallback
}

function componentesDeVariante(componentes: Componente[], varianteId: string): Componente[] {
  return componentes
    .filter(c => c.variante_id === varianteId)
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
}

function sumaComponentes(componentes: Componente[]): number {
  return componentes.reduce((acc, c) => acc + (c.precio_fob_usd ?? 0), 0)
}

// ─── Modal "Agregar/editar variante" ────────────────────────────────────────
function VarianteModal({
  productoId, variante, onClose, onCreada, onEditada,
}: {
  productoId: string
  variante: Variante | null
  onClose: () => void
  onCreada: (v: Variante) => void
  onEditada: (v: Variante) => void
}) {
  const [nombre, setNombre] = useState(variante?.variante || '')
  const [precio, setPrecio] = useState(variante?.precio_fob_usd != null ? String(variante.precio_fob_usd) : '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function guardar() {
    const nombreTrim = nombre.trim()
    if (!nombreTrim) { setError('El nombre del color es obligatorio'); return }

    // Mismo chequeo que el backend (ver variantes/route.ts) pero antes de
    // pegarle a la red -- un costo/precio negativo nunca es válido.
    const precioNum = precio.trim() === '' ? null : Number(precio)
    if (precioNum !== null && precioNum < 0) { setError('El precio de referencia no puede ser negativo'); return }

    setGuardando(true)
    setError('')

    const url = variante
      ? `/api/productos/${productoId}/variantes/${variante.id}`
      : `/api/productos/${productoId}/variantes`
    const res = await fetch(url, {
      method: variante ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variante: nombreTrim, precio_fob_usd: precioNum }),
    })
    setGuardando(false)

    if (!res.ok) {
      setError(await leerError(res, 'No se pudo guardar la variante'))
      return
    }
    const { data } = await res.json()
    if (variante) onEditada(data)
    else onCreada(data)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
      <div className="bg-bg-surface rounded-2xl shadow-xl w-full max-w-sm flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-5 border-b border-border flex-none">
          <h2 className="text-lg font-bold text-text">{variante ? 'Editar variante' : 'Agregar variante'}</h2>
          <button onClick={onClose} className="text-text-subtle hover:text-text-muted">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-text-muted">Nombre del color*</label>
            <input
              autoFocus
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej: White, Hueso..."
              className="bg-bg-surface w-full mt-1 border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 focus:ring-focus-ring"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-text-muted">Precio de referencia (USD, opcional)</label>
            <input
              type="number" step="0.01"
              value={precio}
              onChange={e => setPrecio(e.target.value)}
              placeholder="0.00"
              className="bg-bg-surface w-full mt-1 border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 focus:ring-focus-ring"
            />
            <p className="text-xs text-text-subtle mt-1">
              Déjalo vacío si el precio real es la suma de sus componentes.
            </p>
          </div>

          {error && (
            <div className="bg-danger-bg border border-danger text-danger rounded-lg p-2.5 text-xs">{error}</div>
          )}
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-3 flex-none">
          {/* minHeight: 44 -- área táctil mínima (ver chips de arriba), con
              inline-flex items-center para que el texto quede centrado sin
              agregar padding visible (son links sin fondo). */}
          <button onClick={onClose} className="inline-flex items-center text-sm text-text-muted hover:text-text" style={{ minHeight: 44 }}>Cancelar</button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="px-4 py-2 rounded-lg text-sm bg-action-primary text-on-action-primary hover:bg-action-primary-hover font-medium disabled:opacity-50 flex items-center gap-1.5"
            style={{ minHeight: 44 }}
          >
            {guardando && <Loader2 size={14} className="animate-spin" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal "Agregar/editar componente" ──────────────────────────────────────
function ComponenteModal({
  productoId, varianteId, nombreVariante, componente, onClose, onGuardado,
}: {
  productoId: string
  varianteId: string
  nombreVariante: string
  componente: Componente | null
  onClose: () => void
  // Se llama después de cada guardado exitoso (crear o editar) para refrescar
  // los datos del producto. Editar siempre cierra; crear puede seguir abierto.
  onGuardado: () => void
}) {
  const sugeridoInicial = componente && CHIPS_SUGERIDOS.includes(componente.componente) ? componente.componente : (componente ? 'Otro' : 'Tank')
  const [chip, setChip] = useState(sugeridoInicial)
  const [nombreLibre, setNombreLibre] = useState(componente && chip === 'Otro' ? componente.componente : '')
  const [costo, setCosto] = useState(componente?.precio_fob_usd != null ? String(componente.precio_fob_usd) : '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  function limpiarFormulario() {
    setChip('Tank')
    setNombreLibre('')
    setCosto('')
  }

  async function guardar(cerrarAlTerminar: boolean) {
    const nombre = (chip === 'Otro' ? nombreLibre : chip).trim()
    if (!nombre) { setError('El nombre de la parte es obligatorio'); return }

    // Mismo chequeo que el backend (ver componentes/route.ts) pero antes de
    // pegarle a la red -- un costo negativo ensuciaría el margen de una
    // cotización real si ese componente se usa como línea del cotizador.
    const costoNum = costo.trim() === '' ? null : Number(costo)
    if (costoNum !== null && costoNum < 0) { setError('El costo FOB no puede ser negativo'); return }

    setGuardando(true)
    setError('')

    const url = componente
      ? `/api/productos/${productoId}/componentes/${componente.id}`
      : `/api/productos/${productoId}/variantes/${varianteId}/componentes`
    const res = await fetch(url, {
      method: componente ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ componente: nombre, precio_fob_usd: costoNum }),
    })
    setGuardando(false)

    if (!res.ok) {
      // 409 ya viene con el mensaje legible del backend ("Ya existe una parte
      // llamada... en esta variante") -- nunca se muestra el error crudo.
      setError(await leerError(res, 'No se pudo guardar la parte'))
      return
    }

    onGuardado()
    if (cerrarAlTerminar || componente) {
      onClose()
    } else {
      limpiarFormulario()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
      <div className="bg-bg-surface rounded-2xl shadow-xl w-full max-w-sm flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-5 border-b border-border flex-none">
          <div>
            <h2 className="text-lg font-bold text-text">{componente ? 'Editar parte' : 'Agregar parte'}</h2>
            <p className="text-xs text-text-subtle mt-0.5">Variante: {nombreVariante}</p>
          </div>
          <button onClick={onClose} className="text-text-subtle hover:text-text-muted">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1.5">Nombre de la parte*</label>
            {/* Chips ≥44px alto para que envuelvan bien en 375px (mobile-first). */}
            <div className="flex flex-wrap gap-2">
              {CHIPS_SUGERIDOS.map(c => (
                <button
                  key={c}
                  onClick={() => setChip(c)}
                  style={{ minHeight: 44 }}
                  className={`px-3.5 rounded-full text-sm font-medium border transition-colors ${
                    chip === c
                      ? 'bg-action-primary text-on-action-primary border-action-primary'
                      : 'bg-bg-surface text-text-muted border-border hover:bg-bg-subtle'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            {chip === 'Otro' && (
              <input
                autoFocus
                value={nombreLibre}
                onChange={e => setNombreLibre(e.target.value)}
                placeholder="Nombre de la parte"
                className="bg-bg-surface w-full mt-2 border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 focus:ring-focus-ring"
              />
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-text-muted">Costo FOB (USD)</label>
            <input
              type="number" step="0.01"
              value={costo}
              onChange={e => setCosto(e.target.value)}
              placeholder="0.00"
              className="bg-bg-surface w-full mt-1 border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 focus:ring-focus-ring"
            />
          </div>

          {error && (
            <div className="bg-danger-bg border border-danger text-danger rounded-lg p-2.5 text-xs">{error}</div>
          )}
        </div>

        <div className="p-4 border-t border-border flex flex-wrap justify-end gap-3 flex-none">
          {/* minHeight: 44 -- mismo criterio que el modal de variante. */}
          <button onClick={onClose} className="inline-flex items-center text-sm text-text-muted hover:text-text" style={{ minHeight: 44 }}>Terminar</button>
          <button
            onClick={() => guardar(false)}
            disabled={guardando}
            className="px-4 py-2 rounded-lg text-sm bg-action-primary text-on-action-primary hover:bg-action-primary-hover font-medium disabled:opacity-50 flex items-center gap-1.5"
            style={{ minHeight: 44 }}
          >
            {guardando && <Loader2 size={14} className="animate-spin" />}
            {componente ? 'Guardar' : 'Guardar y agregar otra parte'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Botón con confirmación de un segundo click (sin modal nuevo) ──────────
function BotonEliminar({ onConfirmar, eliminando, etiqueta = 'Eliminar' }: { onConfirmar: () => void; eliminando: boolean; etiqueta?: string }) {
  const [confirmando, setConfirmando] = useState(false)

  if (eliminando) return <span className="text-xs text-text-subtle">Eliminando...</span>

  // minHeight: 44 + inline-flex items-center en cada botón -- área táctil de
  // 44px sin fondo visible, con padding horizontal corto porque es texto
  // corto (asimétrico: casi nada de ancho extra, todo el alto lo da el
  // minHeight) para que no se vea como un botón gigante fuera de lugar.
  if (confirmando) {
    return (
      <span className="text-xs flex items-center gap-1.5">
        ¿Seguro?
        <button onClick={onConfirmar} className="inline-flex items-center px-1 font-semibold text-danger hover:underline" style={{ minHeight: 44 }}>Sí</button>
        <button onClick={() => setConfirmando(false)} className="inline-flex items-center px-1 text-text-subtle hover:underline" style={{ minHeight: 44 }}>No</button>
      </span>
    )
  }

  return (
    <button onClick={() => setConfirmando(true)} className="inline-flex items-center px-1 text-xs text-text-subtle hover:text-danger hover:underline" style={{ minHeight: 44 }}>
      {etiqueta}
    </button>
  )
}

// ─── Sección completa ───────────────────────────────────────────────────────
export default function SeccionVariantesComponentes({
  productoId, variantes, componentes, puedeEditar, onCambio,
}: {
  productoId: string
  variantes: Variante[]
  componentes: Componente[]
  puedeEditar: boolean
  onCambio: () => void
}) {
  const [modalVariante, setModalVariante] = useState<{ variante: Variante | null } | null>(null)
  const [modalComponente, setModalComponente] = useState<{ varianteId: string; nombreVariante: string; componente: Componente | null } | null>(null)
  const [eliminandoVarianteId, setEliminandoVarianteId] = useState<string | null>(null)
  const [eliminandoComponenteId, setEliminandoComponenteId] = useState<string | null>(null)

  const hayDatos = variantes.length > 0

  if (!puedeEditar && !hayDatos) return null

  async function eliminarVariante(id: string) {
    setEliminandoVarianteId(id)
    const res = await fetch(`/api/productos/${productoId}/variantes/${id}`, { method: 'DELETE' })
    setEliminandoVarianteId(null)
    if (res.ok) onCambio()
  }

  async function eliminarComponente(id: string) {
    setEliminandoComponenteId(id)
    const res = await fetch(`/api/productos/${productoId}/componentes/${id}`, { method: 'DELETE' })
    setEliminandoComponenteId(null)
    if (res.ok) onCambio()
  }

  function onVarianteCreada(v: Variante) {
    setModalVariante(null)
    onCambio()
    // Al crear (no al editar) se abre directo el modal de agregar componente
    // para esa variante -- no se deja a medias (punto 2 del encargo).
    setModalComponente({ varianteId: v.id, nombreVariante: v.variante, componente: null })
  }

  function onVarianteEditada() {
    setModalVariante(null)
    onCambio()
  }

  return (
    <div>
      {modalVariante && (
        <VarianteModal
          productoId={productoId}
          variante={modalVariante.variante}
          onClose={() => setModalVariante(null)}
          onCreada={onVarianteCreada}
          onEditada={onVarianteEditada}
        />
      )}

      {modalComponente && (
        <ComponenteModal
          productoId={productoId}
          varianteId={modalComponente.varianteId}
          nombreVariante={modalComponente.nombreVariante}
          componente={modalComponente.componente}
          onClose={() => setModalComponente(null)}
          onGuardado={onCambio}
        />
      )}

      {/* flex-wrap: en 375px el botón de agregar baja de línea si no cabe
          junto al título (punto 4 del encargo). */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        <p className="text-xs font-semibold text-text-subtle uppercase tracking-wide">
          Variantes de color y partes
        </p>
        {puedeEditar && hayDatos && (
          <button
            onClick={() => setModalVariante({ variante: null })}
            className="flex items-center gap-1.5 text-sm font-medium hover:underline text-text-link"
            style={{ minHeight: 44 }}
          >
            <Plus size={14} /> Agregar variante
          </button>
        )}
      </div>

      {!hayDatos ? (
        <div className="border border-dashed rounded-xl p-5 text-center border-border">
          <Layers size={28} className="mx-auto mb-2 text-text-subtle" />
          <p className="text-sm text-text-muted mb-1">Sin variantes de color cargadas</p>
          <p className="text-xs text-text-subtle mb-3">
            Carga los colores de este producto (ej. White, Hueso) y sus partes (Tank, Bowl, Seat Cover) para
            que el cotizador pueda dividirlo automáticamente.
          </p>
          {puedeEditar && (
            <button
              onClick={() => setModalVariante({ variante: null })}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold bg-action-primary text-on-action-primary hover:bg-action-primary-hover"
              style={{ minHeight: 44 }}
            >
              <Plus size={14} /> Agregar primera variante
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col space-y-3">
          {variantes.map(v => {
            const partes = componentesDeVariante(componentes, v.id)
            const suma = sumaComponentes(partes)
            const difieren = v.precio_fob_usd != null && partes.length > 0 && Math.abs(suma - v.precio_fob_usd) > 0.01
            return (
              <div key={v.id} className="border border-border rounded-xl p-4 bg-bg-surface">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-text-heading truncate">{v.variante}</span>
                    {v.precio_fob_usd != null && (
                      <span className="text-xs text-text-subtle">Ref: {formatUSD(v.precio_fob_usd)}</span>
                    )}
                  </div>
                  {puedeEditar && (
                    <button
                      onClick={() => setModalVariante({ variante: v })}
                      className="text-xs text-text-link hover:underline flex items-center gap-1"
                      style={{ minHeight: 44 }}
                    >
                      <Pencil size={11} /> Editar
                    </button>
                  )}
                </div>

                {partes.length === 0 ? (
                  <p className="text-xs text-text-subtle mb-2">Sin partes cargadas todavía.</p>
                ) : (
                  <div className="space-y-1.5 mb-2">
                    {partes.map(c => (
                      <div key={c.id} className="flex items-center justify-between gap-2 py-1 border-b border-border last:border-b-0">
                        <span className="text-sm text-text truncate">{c.componente}</span>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-sm tabular-nums text-text-muted">
                            {c.precio_fob_usd != null ? formatUSD(c.precio_fob_usd) : '—'}
                          </span>
                          {puedeEditar && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setModalComponente({ varianteId: v.id, nombreVariante: v.variante, componente: c })}
                                className="inline-flex items-center text-xs text-text-link hover:underline"
                                style={{ minHeight: 44 }}
                              >
                                Editar
                              </button>
                              <BotonEliminar
                                eliminando={eliminandoComponenteId === c.id}
                                onConfirmar={() => eliminarComponente(c.id)}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {partes.length > 0 && (
                  <p className="text-xs mb-2">
                    Suma de partes: <span className="font-medium text-text">{formatUSD(suma)}</span>
                    {difieren && (
                      <span className="text-warning ml-1.5">⚠ difieren del precio de referencia</span>
                    )}
                  </p>
                )}

                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {puedeEditar && (
                    <button
                      onClick={() => setModalComponente({ varianteId: v.id, nombreVariante: v.variante, componente: null })}
                      className="flex items-center gap-1.5 text-sm font-medium hover:underline text-text-link"
                      style={{ minHeight: 44 }}
                    >
                      <Plus size={13} /> Agregar otra parte
                    </button>
                  )}
                  {puedeEditar && (
                    <BotonEliminar
                      etiqueta="Eliminar variante"
                      eliminando={eliminandoVarianteId === v.id}
                      onConfirmar={() => eliminarVariante(v.id)}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
