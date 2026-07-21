// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderToBuffer } = require('@react-pdf/renderer')
import { ProformaPDF } from './templates/proforma-estandar'
import type { Proforma } from '@/types/europartners'
import React from 'react'

export async function generarPDFProforma(proforma: Proforma): Promise<Buffer> {
  const element = React.createElement(ProformaPDF, { proforma })
  // renderToBuffer returns a Buffer-compatible result
  const buffer = await renderToBuffer(element as unknown as React.ReactElement)
  return Buffer.from(buffer)
}
