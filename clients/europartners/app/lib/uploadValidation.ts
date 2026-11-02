// Validación de tipo de archivo para los 3 endpoints que reciben comprobantes
// o documentos vía formData (pago público, pagos internos, documentos de
// despacho) — auditoría de seguridad oct-2026. Antes de esto solo se
// validaba tamaño (y solo en /api/pago/[token]): cualquier tipo de archivo
// se aceptaba, incluido HTML/SVG con script embebido, y se subía tal cual a
// un bucket de Storage público. En la práctica un comprobante o documento de
// despacho siempre es una foto o un PDF, así que esta lista no debería
// rechazar ningún uso real — solo cierra la puerta a tipos que nunca se
// esperan ahí.
const TIPOS_PERMITIDOS = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'application/pdf',
])

export function tipoArchivoPermitido(archivo: File): boolean {
  return TIPOS_PERMITIDOS.has(archivo.type)
}

export const MENSAJE_TIPO_NO_PERMITIDO_ES = 'Tipo de archivo no permitido. Solo se aceptan imágenes (JPG, PNG, WEBP, HEIC) o PDF.'
export const MENSAJE_TIPO_NO_PERMITIDO_EN = 'File type not allowed. Only images (JPG, PNG, WEBP, HEIC) or PDF are accepted.'
