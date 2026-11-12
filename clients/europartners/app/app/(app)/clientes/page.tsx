'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Users, Pencil, X } from 'lucide-react'
import { useRol } from '@/lib/useRol'
import SearchField from '@/components/ui/SearchField'
import type { Cliente } from '@/types/europartners'

// Campos editables del modal -- subconjunto de Cliente, validado en el
// frontend y de nuevo en el backend (app/api/clientes/[id]/route.ts) antes
// de guardar. 'nombre' es obligatorio, el resto puede quedar vacío (muchos
// clientes no tienen contacto cargado todavía).
interface ClienteForm {
  nombre: string
  contacto_nombre: string
  contacto_email: string
  contacto_telefono: string
  direccion: string
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function formValorInicial(c: Cliente): ClienteForm {
  return {
    nombre: c.nombre || '',
    contacto_nombre: c.contacto_nombre || '',
    contacto_email: c.contacto_email || '',
    contacto_telefono: c.contacto_telefono || '',
    direccion: c.direccion || '',
  }
}

export default function ClientesPage() {
  const { puedeEditar } = useRol()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [seleccionado, setSeleccionado] = useState<Cliente | null>(null)

  const cargarClientes = useCallback(() => {
    setLoading(true)
    setError(false)
    fetch('/api/clientes')
      .then(r => {
        if (!r.ok) throw new Error('No se pudo cargar')
        return r.json()
      })
      .then(({ data }) => { setClientes(data || []); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  useEffect(() => { cargarClientes() }, [cargarClientes])

  // Búsqueda en memoria sobre la lista ya cargada -- mismo patrón que
  // Despachos/Proformas (sin debounce, no hay llamada a red por tecla).
  const clientesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return clientes
    return clientes.filter(c => {
      const campos = [c.nombre, c.contacto_nombre, c.contacto_email]
      return campos.some(campo => campo?.toLowerCase().includes(q))
    })
  }, [clientes, busqueda])

  function onGuardado(actualizado: Cliente) {
    setClientes(prev => prev.map(c => (c.id === actualizado.id ? { ...c, ...actualizado } : c)))
    setSeleccionado(null)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-0px)] overflow-hidden">
      <div className="px-8 pt-7 pb-4 bg-bg-surface border-b border-border flex-shrink-0">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-text-heading">Clientes</h1>
          <p className="text-text-subtle text-sm mt-0.5">Empresas con las que trabajamos</p>
        </div>
        <SearchField
          value={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar por nombre, contacto o correo..."
          className="w-full"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-text-subtle text-sm">Cargando clientes...</div>
        ) : error ? (
          <div className="bg-danger-bg border border-danger text-danger rounded-lg p-4 text-sm text-center">
            <p className="mb-3">No se pudo cargar la lista de clientes.</p>
            <button
              onClick={cargarClientes}
              className="font-semibold underline hover:no-underline"
            >
              Reintentar
            </button>
          </div>
        ) : clientesFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-text-subtle gap-2">
            <Users size={36} strokeWidth={1} />
            <p className="text-sm">
              {clientes.length === 0 ? 'No hay clientes todavía' : 'Ningún cliente coincide con la búsqueda'}
            </p>
          </div>
        ) : (
          <div className="bg-bg-surface rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-subtle border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Empresa</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Contacto</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Correo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Teléfono</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">País</th>
                  {puedeEditar && <th className="w-8 px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {clientesFiltrados.map(c => (
                  <tr
                    key={c.id}
                    className={`border-b border-border transition-colors ${puedeEditar ? 'hover:bg-bg-subtle cursor-pointer' : ''}`}
                    onClick={() => { if (puedeEditar) setSeleccionado(c) }}
                  >
                    <td className="px-4 py-3 font-semibold text-text-heading">{c.nombre}</td>
                    <td className="px-4 py-3 text-text-muted text-xs">
                      {c.contacto_nombre || <span className="text-text-subtle">—</span>}
                    </td>
                    <td className="px-4 py-3 text-text-muted text-xs">
                      {c.contacto_email || <span className="text-text-subtle">—</span>}
                    </td>
                    <td className="px-4 py-3 text-text-muted text-xs">
                      {c.contacto_telefono || <span className="text-text-subtle">—</span>}
                    </td>
                    <td className="px-4 py-3 text-text-muted text-xs">
                      {c.pais || <span className="text-text-subtle">—</span>}
                    </td>
                    {puedeEditar && (
                      <td className="px-4 py-3 text-text-subtle">
                        <Pencil size={15} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {seleccionado && (
        <ClienteEditModal
          cliente={seleccionado}
          onClose={() => setSeleccionado(null)}
          onGuardado={onGuardado}
        />
      )}
    </div>
  )
}

// Modal de edición -- mismo patrón estructural que RegistrarPagoFleteModal
// de /despachos (overlay + caja con header/body/footer, max-h con scroll
// interno en el body).
function ClienteEditModal({
  cliente, onClose, onGuardado,
}: {
  cliente: Cliente
  onClose: () => void
  onGuardado: (c: Cliente) => void
}) {
  const [form, setForm] = useState<ClienteForm>(formValorInicial(cliente))
  const [guardando, setGuardando] = useState(false)
  const [errorValidacion, setErrorValidacion] = useState('')
  const [errorGuardado, setErrorGuardado] = useState('')

  function campo(nombre: keyof ClienteForm, valor: string) {
    setForm(prev => ({ ...prev, [nombre]: valor }))
  }

  async function guardar() {
    const nombre = form.nombre.trim()
    if (!nombre) {
      setErrorValidacion('El nombre de la empresa es obligatorio')
      return
    }
    const correo = form.contacto_email.trim()
    if (correo && !EMAIL_REGEX.test(correo)) {
      setErrorValidacion('El correo no tiene un formato válido')
      return
    }

    setErrorValidacion('')
    setErrorGuardado('')
    setGuardando(true)

    const res = await fetch(`/api/clientes/${cliente.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre,
        contacto_nombre: form.contacto_nombre.trim(),
        contacto_email: correo,
        contacto_telefono: form.contacto_telefono.trim(),
        direccion: form.direccion.trim(),
      }),
    })

    if (res.ok) {
      const { data } = await res.json()
      onGuardado(data)
    } else {
      const j = await res.json().catch(() => ({}))
      setErrorGuardado(j.error || 'Error al guardar los cambios')
    }
    setGuardando(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-surface rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-5 border-b border-border flex-none">
          <h2 className="text-lg font-bold text-text">Editar cliente</h2>
          <button onClick={onClose} className="text-text-subtle hover:text-text-muted">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-text-muted">Nombre de la empresa*</label>
            <input
              autoFocus
              value={form.nombre}
              onChange={e => campo('nombre', e.target.value)}
              className="bg-bg-surface w-full mt-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus-ring"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-text-muted">Nombre de contacto</label>
            <input
              value={form.contacto_nombre}
              onChange={e => campo('contacto_nombre', e.target.value)}
              className="bg-bg-surface w-full mt-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus-ring"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-text-muted">Correo de contacto</label>
            <input
              type="email"
              value={form.contacto_email}
              onChange={e => campo('contacto_email', e.target.value)}
              className="bg-bg-surface w-full mt-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus-ring"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-text-muted">Teléfono</label>
            <input
              value={form.contacto_telefono}
              onChange={e => campo('contacto_telefono', e.target.value)}
              className="bg-bg-surface w-full mt-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus-ring"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-text-muted">Dirección</label>
            <input
              value={form.direccion}
              onChange={e => campo('direccion', e.target.value)}
              className="bg-bg-surface w-full mt-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus-ring"
            />
          </div>

          {errorValidacion && (
            <div className="bg-danger-bg border border-danger text-danger rounded-lg p-2.5 text-xs">
              {errorValidacion}
            </div>
          )}
          {errorGuardado && (
            <div className="bg-danger-bg border border-danger text-danger rounded-lg p-2.5 text-xs">
              {errorGuardado}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-3 flex-none">
          <button onClick={onClose} className="text-sm text-text-muted hover:text-text">
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="px-4 py-2 rounded-lg text-sm bg-action-primary text-on-action-primary hover:bg-action-primary-hover font-medium disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
