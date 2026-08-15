'use client'
import { useState, useEffect } from 'react'
import { X, Search, Loader2 } from 'lucide-react'

export interface ClienteOpcion {
  id: string
  nombre: string
  incoterm: string
}

export default function SeleccionarClienteModal({
  titulo = 'Selecciona un cliente',
  onSeleccionar,
  onClose,
}: {
  titulo?: string
  onSeleccionar: (cliente: ClienteOpcion) => void
  onClose: () => void
}) {
  const [clientes, setClientes] = useState<ClienteOpcion[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    fetch('/api/clientes')
      .then(r => r.json())
      .then(({ data }) => { setClientes(data || []); setCargando(false) })
  }, [])

  const filtrados = clientes.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.trim().toLowerCase())
  )

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="p-5 pb-3 flex-none">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-[#1E3A5F]">{titulo}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar cliente..."
              className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 pb-5">
          {cargando ? (
            <div className="p-8 text-center">
              <Loader2 size={22} className="animate-spin mx-auto text-gray-400" />
            </div>
          ) : filtrados.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin clientes que coincidan</p>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {filtrados.map(c => (
                <button
                  key={c.id}
                  onClick={() => onSeleccionar(c)}
                  className="flex items-center justify-between px-4 py-3 rounded-xl border-2 border-gray-100 hover:border-[#1E3A5F] hover:bg-[#1E3A5F]/5 text-left transition-all"
                >
                  <span className="font-semibold text-gray-800 text-sm">{c.nombre}</span>
                  <span className="text-xs text-gray-400 font-mono">{c.incoterm}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
