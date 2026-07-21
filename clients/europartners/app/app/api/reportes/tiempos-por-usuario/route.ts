import { NextResponse } from 'next/server'
import { getCurrentUsuario } from '@/lib/auth'

interface EventoRow {
  proforma_id: string
  usuario_id: string | null
  estado_desde: string | null
  estado_hacia: string
  created_at: string
}

// GET /api/reportes/tiempos-por-usuario — mismo cálculo que /api/dashboard/stats
// (duración entre transiciones de proforma_eventos) pero agrupado también por
// usuario_id: cuánto tiempo tardó CADA persona en actuar sobre cada etapa.
// Acceso: admin + analista (Jero) — es una vista analítica, no la cola de
// acción de Marta (esa es /api/mis-pendientes).
export async function GET() {
  const ctx = await getCurrentUsuario()
  if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (!['admin', 'analista'].includes(ctx.usuario.rol)) {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  }

  const { supabase } = ctx

  const { data: proformas } = await supabase.from('proformas').select('id, created_at')
  const creadaEn = new Map((proformas || []).map(p => [p.id, p.created_at]))

  const { data: eventos } = await supabase
    .from('proforma_eventos')
    .select('proforma_id, usuario_id, estado_desde, estado_hacia, created_at')
    .order('proforma_id', { ascending: true })
    .order('created_at', { ascending: true })

  const { data: usuarios } = await supabase.from('usuarios').select('id, nombre')
  const nombrePorUsuario = new Map((usuarios || []).map(u => [u.id, u.nombre]))

  const porProforma = new Map<string, EventoRow[]>()
  for (const ev of (eventos || []) as EventoRow[]) {
    if (!porProforma.has(ev.proforma_id)) porProforma.set(ev.proforma_id, [])
    porProforma.get(ev.proforma_id)!.push(ev)
  }

  // clave: `${usuario_id}::${etapa}` → lista de horas
  const duraciones: Record<string, number[]> = {}

  for (const [proformaId, evs] of Array.from(porProforma.entries())) {
    let anterior = creadaEn.get(proformaId)
    for (const ev of evs) {
      if (anterior && ev.usuario_id) {
        const horas = (new Date(ev.created_at).getTime() - new Date(anterior).getTime()) / 3_600_000
        if (horas >= 0) {
          const etapa = `${ev.estado_desde ?? '—'} → ${ev.estado_hacia}`
          const clave = `${ev.usuario_id}::${etapa}`
          if (!duraciones[clave]) duraciones[clave] = []
          duraciones[clave].push(horas)
        }
      }
      anterior = ev.created_at
    }
  }

  const filas = Object.entries(duraciones).map(([clave, horas]) => {
    const [usuario_id, etapa] = clave.split('::')
    return {
      usuario_id,
      nombre: nombrePorUsuario.get(usuario_id) || 'Desconocido',
      etapa,
      promedio_horas: Math.round((horas.reduce((a, b) => a + b, 0) / horas.length) * 10) / 10,
      muestras: horas.length,
    }
  }).sort((a, b) => a.nombre.localeCompare(b.nombre) || a.etapa.localeCompare(b.etapa))

  return NextResponse.json({ data: filas })
}
