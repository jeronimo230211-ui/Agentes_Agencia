// Selección de las specs más relevantes de un producto, para mostrarlas en
// UI compacta. Centralizado acá porque la misma lógica de prioridad la usan
// dos componentes — DestacadosRapidos (chips horizontales) y
// EspecificacionesPrincipales (caja de viñetas, pedida por Jerónimo viendo
// la referencia de Homecenter) — y no queremos que el orden de prioridad se
// desincronice entre los dos si alguien edita solo uno.
export interface CampoFichaTecnica { label: string; valor: string }

export interface EspecificacionSeleccionada {
  clave: 'color' | 'dimensiones' | 'moq' | 'cbm' | 'ficha'
  label: string
  valor: string
}

export interface ParametrosEspecificaciones {
  colorVariante?: string | null
  dimensiones?: string | null
  moq?: number | string | null
  cbmUnitario?: number | null
  camposFicha?: CampoFichaTecnica[]
  // 'es' (default) para el catálogo interno, 'en' para la vista pública del
  // cliente. Jerónimo (2026-10-26): todo el contenido que ve el cliente debe
  // estar en inglés. Las 4 etiquetas fijas (Color/Dimensiones/MOQ/CBM) se
  // traducen acá; los campos sueltos de ficha_tecnica.campos NO (esa columna
  // todavía no es bilingüe, ver prompt-generacion.md del content-pipeline),
  // así que en inglés se omiten en vez de mostrar texto en español.
  idioma?: 'es' | 'en'
}

const LABEL_DIMENSIONES: Record<'es' | 'en', string> = { es: 'Dimensiones', en: 'Dimensions' }

// Orden de prioridad fijo: color > dimensiones > MOQ > CBM, y si no se llega
// al máximo se completa con las primeras entradas de ficha_tecnica.campos
// (solo en español -- ver nota de `idioma` arriba).
export function seleccionarEspecificaciones(
  { colorVariante, dimensiones, moq, cbmUnitario, camposFicha = [], idioma = 'es' }: ParametrosEspecificaciones,
  max: number
): EspecificacionSeleccionada[] {
  const items: EspecificacionSeleccionada[] = []

  if (colorVariante) items.push({ clave: 'color', label: 'Color', valor: colorVariante })
  if (dimensiones) items.push({ clave: 'dimensiones', label: LABEL_DIMENSIONES[idioma], valor: dimensiones })
  if (moq != null && moq !== '') items.push({ clave: 'moq', label: 'MOQ', valor: String(moq) })
  if (cbmUnitario != null) items.push({ clave: 'cbm', label: 'CBM', valor: `${cbmUnitario} CBM` })

  if (idioma === 'es') {
    for (const campo of camposFicha) {
      if (items.length >= max) break
      items.push({ clave: 'ficha', label: campo.label, valor: campo.valor })
    }
  }

  return items.slice(0, max)
}

// Busca en ficha_tecnica.campos un campo que describa el "modelo" del
// producto (ej. "Modelo / diseño": "KM-459") para mostrarlo junto al código,
// como en la referencia de Homecenter ("Modelo Tao | Código 3057289"). No
// inventa el dato — si no existe ese campo, devuelve null y quien llama
// muestra solo el código.
export function extraerModelo(camposFicha?: CampoFichaTecnica[] | null): string | null {
  if (!camposFicha) return null
  const campo = camposFicha.find(c => /modelo/i.test(c.label))
  return campo?.valor ?? null
}
