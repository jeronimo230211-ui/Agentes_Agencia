import { Document, Page, Text, View, StyleSheet, Image, Svg, Circle, Path, Font } from '@react-pdf/renderer'
import fs from 'fs'
import path from 'path'
import type { Producto } from '@/types/europartners'

// Primera plantilla de ficha técnica (2026-10-14). Reusa el lenguaje visual
// de proforma-estandar.tsx (navy/lila, Work Sans, logo real) pero es un
// módulo independiente a propósito: no importa nada de negocio de la
// proforma, solo repite el mismo patrón de Font.register/StyleSheet.
//
// IMPORTANTE (bug real ya resuelto en generator.ts, no repetir): todo este
// archivo importa @react-pdf/renderer con `import`, NUNCA con `require`.
// Mezclar los dos estilos de import en el mismo bundle serverless de
// Next.js crea DOS instancias del paquete, cada una con su propio
// FontStore — Font.register() queda en una instancia y el render lee de
// la otra (vacía), lo que revienta SOLO en producción con "Font family not
// registered". Ver generator.ts para el caso real que pasó con la proforma.

const FUENTES_DIR = path.join(process.cwd(), 'lib/pdf/fonts')
function leerFuente(nombre: string) {
  const buffer = fs.readFileSync(path.join(FUENTES_DIR, nombre))
  return `data:font/woff;base64,${buffer.toString('base64')}`
}
// Fuentes como data URL, no como ruta de archivo — mismo motivo que la
// proforma: el src de Font.register en esta versión de react-pdf solo
// acepta string, y una ruta se abre de forma perezosa en el momento del
// render, lo cual falla en silencio en el filesystem de solo lectura de
// una función serverless de Vercel.
Font.register({
  family: 'Work Sans',
  fonts: [
    { src: leerFuente('WorkSans-Regular.woff'), fontWeight: 400 },
    { src: leerFuente('WorkSans-Medium.woff'), fontWeight: 500 },
    { src: leerFuente('WorkSans-SemiBold.woff'), fontWeight: 600 },
    { src: leerFuente('WorkSans-Bold.woff'), fontWeight: 700 },
  ],
})

// Logo y franja decorativa: mismos PNG oficiales que usa la proforma, leídos
// como Buffer (no como ruta) por el mismo motivo que las fuentes.
const LOGO_BUFFER = fs.readFileSync(path.join(process.cwd(), 'lib/pdf/assets/logo.png'))
const FOOTER_DECO_BUFFER = fs.readFileSync(path.join(process.cwd(), 'lib/pdf/assets/footer-decoracion.png'))

const NAVY = '#000d66'
const LILA = '#ccc8fa'
// Tono claro de fondo para superficies grandes (franja superior, caja de
// encabezado de especificaciones) — del archivo real de Canva de Marta
// ("Plantilla ficha tecnica.pdf", 2026-10-18), más claro que el LILA que
// usamos como acento sólido (pill, chips) en el resto de la app.
const LILA_CLARO = '#e9e6fc'

const styles = StyleSheet.create({
  // Sin padding propio: la franja superior y la franja decorativa del pie
  // necesitan sangrado completo (full-bleed). El contenido del cuerpo va
  // envuelto en `body`, que sí tiene el padding horizontal.
  page: {
    fontFamily: 'Work Sans',
    fontSize: 9,
    paddingBottom: 46, // deja lugar a la franja decorativa del fondo
    backgroundColor: '#ffffff',
    color: '#000000',
  },

  // FRANJA SUPERIOR — fondo lila claro de borde a borde, logo + título de
  // la ficha en la misma fila (igual que la plantilla real de Marta).
  headerBand: {
    backgroundColor: LILA_CLARO,
    paddingVertical: 20,
    paddingHorizontal: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  logo: { width: 120, height: 67 },
  headerBandTitle: { fontSize: 13, fontFamily: 'Work Sans', fontWeight: 700, color: NAVY },

  body: { paddingHorizontal: 30 },

  // BLOQUE SUPERIOR — imagen a la izquierda, referencia/nombre/descripción
  // a la derecha.
  topBlock: { flexDirection: 'row', gap: 16, marginBottom: 18 },
  imagenBox: {
    width: 190,
    height: 190,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    padding: 8,
    flexShrink: 0,
  },
  imagenProducto: { width: '100%', height: '100%', objectFit: 'contain', borderRadius: 4 },

  infoCol: { flex: 1 },
  refPill: {
    backgroundColor: LILA,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  refPillText: { fontSize: 8, fontFamily: 'Work Sans', fontWeight: 700, color: NAVY },
  codigoTexto: { fontSize: 9, fontFamily: 'Work Sans', fontWeight: 600, color: '#6b7280', marginBottom: 3 },
  nombreProducto: { fontSize: 15, fontFamily: 'Work Sans', fontWeight: 700, color: NAVY, marginBottom: 2 },
  categoriaEyebrow: { fontSize: 9, fontFamily: 'Work Sans', fontWeight: 600, color: NAVY, marginBottom: 8 },
  leadText: { fontSize: 10, fontFamily: 'Work Sans', fontWeight: 500, color: NAVY, lineHeight: 1.5, marginBottom: 6 },
  descripcionLarga: { fontSize: 9, color: '#000000', fontFamily: 'Work Sans', fontWeight: 400, lineHeight: 1.5 },

  divisorFino: { borderBottomWidth: 0.75, borderBottomColor: '#d1d5db', marginBottom: 18 },

  // ESPECIFICACIONES + COLORES — dos columnas; especificaciones es una
  // lista de dos columnas con líneas finas (no tabla con header navy, así
  // es en la plantilla real de Marta).
  specsRow: { flexDirection: 'row', gap: 24, marginBottom: 18 },
  specsCol: { flex: 1.3 },
  coloresCol: { flex: 1 },

  seccionHeadingBox: {
    backgroundColor: LILA_CLARO,
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  seccionHeadingText: { fontSize: 9.5, fontFamily: 'Work Sans', fontWeight: 700, color: NAVY },

  // Ancho fijo por columna (no justifyContent:'space-between' con texto de
  // ancho automático) -- con auto-width, un valor largo que pasa a 2
  // líneas no reserva espacio propio y termina montado sobre el label.
  specRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 6,
    gap: 8,
  },
  specLabel: { width: '42%', fontSize: 8.5, color: '#000000', fontFamily: 'Work Sans', fontWeight: 500 },
  specValor: { width: '58%', fontSize: 8.5, color: '#000000', fontFamily: 'Work Sans', fontWeight: 400 },

  seccionTitulo: { fontSize: 9.5, fontFamily: 'Work Sans', fontWeight: 700, color: NAVY, marginBottom: 6 },
  coloresTexto: { fontSize: 9, color: '#000000', fontFamily: 'Work Sans', fontWeight: 400, lineHeight: 1.5 },

  // PIE — fila de contacto horizontal con íconos (antes vivía arriba junto
  // al logo; en la plantilla real de Marta pasa al pie de página).
  footerContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingHorizontal: 30,
    marginTop: 'auto',
    marginBottom: 14,
  },
  footerContactItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  footerContactText: { fontSize: 8, color: '#000000', fontFamily: 'Work Sans', fontWeight: 400 },

  footerDeco: { position: 'absolute', bottom: 0, left: 0, width: '100%', height: 28 },

  // Página de galería — solo se agrega cuando el producto tiene más de 1
  // foto (imagen_url + imagenes_urls). Referencia: fichas técnicas reales
  // de competencia (Carbone) que mandó Jerónimo, página final en grilla
  // 2x2 con cada foto en su propio recuadro con borde.
  galeriaBody: { paddingHorizontal: 30 },
  galeriaTitulo: { fontSize: 13, fontFamily: 'Work Sans', fontWeight: 700, color: NAVY, marginBottom: 14 },
  galeriaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  galeriaBox: {
    width: '48%',
    height: 230,
    borderWidth: 1,
    borderColor: NAVY,
    borderRadius: 8,
    padding: 8,
    backgroundColor: '#ffffff',
  },
  galeriaImagen: { width: '100%', height: '100%', objectFit: 'contain' },
})

// Mismos iconos que la proforma (dibujados a mano con primitivas Svg —
// react-pdf no trae ninguna fuente de iconos). Se redefinen acá en vez de
// importarlos de proforma-estandar.tsx porque esa plantilla no los exporta
// y este módulo debe quedar independiente del flujo de proformas.
function IconoPin() {
  return (
    <Svg width={9} height={9} viewBox="0 0 24 24">
      <Path d="M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8z" fill="#000000" />
      <Circle cx="12" cy="10" r="3.2" fill="white" />
    </Svg>
  )
}

function IconoSobre() {
  return (
    <Svg width={9} height={9} viewBox="0 0 24 24">
      <Path d="M3 5h18v14H3z" stroke="#000000" strokeWidth={2} fill="none" />
      <Path d="M3 5l9 7 9-7" stroke="#000000" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

function IconoTelefono() {
  return (
    <Svg width={9} height={9} viewBox="0 0 24 24">
      <Path
        d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.9 21 3 13.1 3 3.4c0-.6.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.4 0 .8-.2 1L6.6 10.8z"
        fill="#000000"
      />
    </Svg>
  )
}

// Textos fijos de la plantilla, bilingües — a diferencia de ficha_tecnica.campos
// (que todavía no tiene versión EN y se muestra igual en los dos idiomas),
// estos títulos sí deben traducirse según el parámetro `idioma`.
const TEXTOS = {
  es: {
    titulo: 'FICHA TÉCNICA',
    descripcion: 'Descripción',
    especificaciones: 'Especificaciones Técnicas',
    colCampo: 'CAMPO',
    colValor: 'VALOR',
    proveedor: 'Proveedor',
    galeria: 'Galería de Fotos',
    referencia: 'REFERENCIA DEL PRODUCTO',
    colores: 'Colores',
  },
  en: {
    titulo: 'TECHNICAL DATA SHEET',
    descripcion: 'Description',
    especificaciones: 'Technical Specifications',
    colCampo: 'FIELD',
    colValor: 'VALUE',
    proveedor: 'Supplier',
    galeria: 'Photo Gallery',
    referencia: 'PRODUCT REFERENCE',
    colores: 'Colors',
  },
} as const

// El endpoint solo selecciona de Supabase los campos que esta plantilla
// necesita (no el Producto completo, que trae campos de catálogo interno
// como precios o estado que no aplican acá) — este Pick es el contrato
// real entre el endpoint y la plantilla.
export type ProductoFicha = Pick<
  Producto,
  | 'id' | 'codigo' | 'nombre' | 'proveedor' | 'color_variante' | 'imagen_url' | 'imagenes_urls'
  | 'descripcion_corta_es' | 'descripcion_corta_en'
  | 'descripcion_larga_es' | 'descripcion_larga_en'
  | 'ficha_tecnica' | 'ficha_tecnica_estado'
> & {
  // El endpoint solo pide `nombre` de la categoría (join liviano), no el
  // objeto CategoriaProducto completo — se tipa aparte en vez de heredar
  // Pick<Producto, 'categoria'>, que exigiría id/orden que no se seleccionan.
  categoria?: { nombre: string } | null
}

interface Props {
  producto: ProductoFicha
  idioma: 'es' | 'en'
}

export function FichaTecnicaPDF({ producto, idioma }: Props) {
  const t = TEXTOS[idioma]
  const descripcionCorta = idioma === 'en' ? producto.descripcion_corta_en : producto.descripcion_corta_es
  const descripcionLarga = idioma === 'en' ? producto.descripcion_larga_en : producto.descripcion_larga_es
  const campos = producto.ficha_tecnica?.campos || []
  const tieneImagen = Boolean(producto.imagen_url)
  // Mismo criterio de deduplicación que GaleriaProducto.tsx en la app:
  // imagen_url es siempre la primera, el resto viene de imagenes_urls.
  const todasLasImagenes = [producto.imagen_url, ...(producto.imagenes_urls || [])].filter(
    (u): u is string => Boolean(u)
  )
  const hayGaleria = todasLasImagenes.length > 1

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* FRANJA SUPERIOR — layout real de Marta: fondo lila claro de borde
            a borde, logo a la izquierda, título de la ficha a la derecha
            (el contacto se movió al pie, ver footerContactRow). */}
        <View style={styles.headerBand}>
          <Image src={LOGO_BUFFER} style={styles.logo} />
          <Text style={styles.headerBandTitle}>{t.titulo}</Text>
        </View>

        <View style={styles.body}>
          {/* BLOQUE SUPERIOR — imagen a la izquierda; a la derecha el pill
              "REFERENCIA DEL PRODUCTO" (texto fijo de la plantilla de
              Marta), el código real debajo, nombre, categoría y
              descripción. */}
          <View style={styles.topBlock}>
            {tieneImagen && (
              <View style={styles.imagenBox}>
                <Image src={producto.imagen_url as string} style={styles.imagenProducto} />
              </View>
            )}
            <View style={styles.infoCol}>
              <View style={styles.refPill}>
                <Text style={styles.refPillText}>{t.referencia}</Text>
              </View>
              {producto.codigo && <Text style={styles.codigoTexto}>{producto.codigo}</Text>}
              <Text style={styles.nombreProducto}>{producto.nombre}</Text>
              {producto.categoria?.nombre && (
                <Text style={styles.categoriaEyebrow}>{producto.categoria.nombre}</Text>
              )}
              {descripcionCorta && <Text style={styles.leadText}>{descripcionCorta}</Text>}
              {descripcionLarga && <Text style={styles.descripcionLarga}>{descripcionLarga}</Text>}
            </View>
          </View>

          <View style={styles.divisorFino} />

          {/* ESPECIFICACIONES (lista de 2 columnas, sin header navy — así
              es en la plantilla real) + COLORES, lado a lado. Colores solo
              se muestra si el producto tiene `color_variante` cargado — no
              se inventan swatches/círculos de color sin datos reales. */}
          {(campos.length > 0 || producto.color_variante) && (
            <View style={styles.specsRow}>
              {campos.length > 0 && (
                <View style={styles.specsCol}>
                  <View style={styles.seccionHeadingBox}>
                    <Text style={styles.seccionHeadingText}>{t.especificaciones}</Text>
                  </View>
                  {campos.map((campo, i) => (
                    <View key={i} style={styles.specRow}>
                      <Text style={styles.specLabel}>{campo.label}</Text>
                      <Text style={styles.specValor}>{campo.valor}</Text>
                    </View>
                  ))}
                </View>
              )}
              {producto.color_variante && (
                <View style={styles.coloresCol}>
                  <Text style={styles.seccionTitulo}>{t.colores}</Text>
                  <Text style={styles.coloresTexto}>{producto.color_variante}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* PIE — contacto en fila horizontal, igual que la plantilla real
            de Marta (antes vivía arriba junto al logo). */}
        <View style={styles.footerContactRow}>
          <View style={styles.footerContactItem}>
            <IconoPin />
            <Text style={styles.footerContactText}>Panama City, Panama</Text>
          </View>
          <View style={styles.footerContactItem}>
            <IconoSobre />
            <Text style={styles.footerContactText}>egispty@gmail.com</Text>
          </View>
          <View style={styles.footerContactItem}>
            <IconoTelefono />
            <Text style={styles.footerContactText}>+507 6608-5639</Text>
          </View>
        </View>

        {/* FRANJA DECORATIVA — misma imagen que la proforma */}
        <Image src={FOOTER_DECO_BUFFER} style={styles.footerDeco} fixed />
      </Page>

      {/* PÁGINA DE GALERÍA — solo si el producto tiene más de 1 foto. Patrón
          tomado de fichas técnicas reales de competencia (Carbone) que
          Jerónimo mandó como referencia: página final en grilla 2x2, cada
          foto en su propio recuadro con borde navy. */}
      {hayGaleria && (
        <Page size="A4" style={styles.page}>
          <View style={styles.headerBand}>
            <Image src={LOGO_BUFFER} style={styles.logo} />
            <Text style={styles.headerBandTitle}>{t.galeria}</Text>
          </View>
          <View style={styles.galeriaBody}>
            <View style={styles.galeriaGrid}>
              {todasLasImagenes.map((url, i) => (
                <View key={i} style={styles.galeriaBox}>
                  <Image src={url} style={styles.galeriaImagen} />
                </View>
              ))}
            </View>
          </View>
          <Image src={FOOTER_DECO_BUFFER} style={styles.footerDeco} fixed />
        </Page>
      )}
    </Document>
  )
}
