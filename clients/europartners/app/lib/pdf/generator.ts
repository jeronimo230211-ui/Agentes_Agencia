// Antes esto importaba renderToBuffer con require('@react-pdf/renderer')
// mientras proforma-estandar.tsx lo importa (a sí mismo, para Font) con
// `import`. En el build serverless de Next.js eso hizo que el bundler
// resolviera DOS instancias separadas del paquete -- cada una con su
// propio registro interno de fuentes (@react-pdf/font es un singleton por
// instancia del módulo). Font.register() corría sobre la instancia que
// cargó proforma-estandar.tsx; renderToBuffer (vía fetchAssets) leía de
// la otra, vacía -- "Font family not registered: Work Sans" en producción
// aunque local funcionaba perfecto. Ahora las dos partes importan el
// mismo paquete de la misma forma, una sola instancia.
import { renderToBuffer } from '@react-pdf/renderer'
import { ProformaPDF } from './templates/proforma-estandar'
import type { Proforma } from '@/types/europartners'
import React from 'react'

export async function generarPDFProforma(proforma: Proforma): Promise<Buffer> {
  const element = React.createElement(ProformaPDF, { proforma })
  const buffer = await renderToBuffer(element as Parameters<typeof renderToBuffer>[0])
  return Buffer.from(buffer)
}
