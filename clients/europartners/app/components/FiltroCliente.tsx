'use client'

interface Cliente { id: string; nombre: string }

interface Props {
  clientes: Cliente[]
  value: string
  onChange: (clienteId: string) => void
  className?: string
}

// Select nativo para filtrar por cliente. La lista de clientes crece con el
// negocio, así que un select evita el scroll horizontal que sufría la fila
// de tabs anterior (ver /finanzas y /proformas). 'todos' representa "sin
// filtro de cliente" para mantener compatibilidad con el estado existente
// (clienteTab) en las páginas que lo usan.
export default function FiltroCliente({ clientes, value, onChange, className }: Props) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={
        className ??
        'text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20'
      }
    >
      <option value="todos">Todos los clientes</option>
      {clientes.map(c => (
        <option key={c.id} value={c.id}>{c.nombre}</option>
      ))}
    </select>
  )
}
