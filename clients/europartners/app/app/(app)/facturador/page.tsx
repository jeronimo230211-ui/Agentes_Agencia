'use client'
import { Receipt } from 'lucide-react'

export default function FacturadorPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-[#1E3A5F] mb-2">Facturador</h1>
      <p className="text-gray-500 text-sm mb-8">Convierte proformas aprobadas en facturas</p>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
        <Receipt size={48} className="text-gray-200 mx-auto mb-4" />
        <p className="text-gray-500 font-medium">Módulo de facturación</p>
        <p className="text-gray-400 text-sm mt-1">
          Disponible en Fase 3 — Las proformas enviadas aparecerán aquí para su conversión en facturas.
        </p>
      </div>
    </div>
  )
}
