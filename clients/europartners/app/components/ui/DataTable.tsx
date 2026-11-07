'use client'

import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

export interface DataTableColumn<T> {
  key: string
  header: ReactNode
  align?: 'left' | 'right' | 'center'
  /** Ancho fijo opcional, ej. "w-8" -- se pasa tal cual al <th>. */
  thClassName?: string
  render: (row: T) => ReactNode
  cellClassName?: string
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  loading?: boolean
  emptyMessage?: string
  onRowClick?: (row: T) => void
}

const ALIGN_CLASS: Record<'left' | 'right' | 'center', string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
}

// Tabla de operaciones reutilizable (proformas, despachos, finanzas,
// solicitudes...): mismo header/zebra/estado vacío-cargando en todos los
// módulos densos, ya con los tokens del sistema de Marta -- así el tema
// oscuro funciona solo y no hay que repetir "bg-white border-gray-100
// bg-gray-50 text-gray-500" en cada archivo.
export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  emptyMessage = 'No hay datos',
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div className="bg-bg-surface rounded-xl border border-border overflow-x-auto">
      <table className="w-full text-text-body">
        <thead>
          <tr className="bg-bg-subtle border-b border-border">
            {columns.map(col => (
              <th
                key={col.key}
                className={`${ALIGN_CLASS[col.align ?? 'left']} px-4 py-3 text-text-label text-text-muted ${col.thClassName ?? ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="text-center p-8 text-text-subtle">
                <Loader2 size={18} className="animate-spin inline-block mr-2" />
                Cargando...
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center p-8 text-text-subtle">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map(row => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-border last:border-0 hover:bg-bg-subtle transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
              >
                {columns.map(col => (
                  <td key={col.key} className={`${ALIGN_CLASS[col.align ?? 'left']} px-4 py-3 ${col.cellClassName ?? ''}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
