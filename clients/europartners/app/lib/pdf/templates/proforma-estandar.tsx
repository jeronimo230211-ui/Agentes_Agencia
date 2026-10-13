import { Document, Page, Text, View, StyleSheet, Image, Link, Svg, Circle, Line, Path, Rect, Font } from '@react-pdf/renderer'
import fs from 'fs'
import path from 'path'
import type { Proforma } from '@/types/europartners'
import { formatUSD } from '@/lib/precio'

// Rediseño 2026-10-05 a partir de la plantilla de la diseñadora
// (europartners-proforma-invoice.pdf), con ajustes de layout del
// 2026-10-10 (su feedback de 5 puntos) y calibración final del
// 2026-10-13 contra el PDF exportado directo de su archivo de Canva
// (https://www.canva.com/design/DAHWn-juin4) — de ahí se sacaron los
// valores EXACTOS (no aproximados a ojo) de tipografía, colores de
// texto y de fondo, leyendo los spans y las formas del PDF con
// PyMuPDF en vez de adivinar mirando la imagen renderizada.
// Las fuentes se leen y se pasan como data URL en base64, NO como ruta de
// archivo — a diferencia de <Image>, el src de Font.register en esta
// versión de react-pdf SOLO acepta un string (ruta, URL http, o data URL);
// pasar un Buffer da error de tipos, y pasar una ruta hace que
// @react-pdf/font recién intente abrir el archivo de forma perezosa, en el
// momento de renderizar, no al registrar. En el filesystem de solo lectura
// de una función serverless de Vercel esa lectura tardía falla en silencio
// y el error que sale a superficie es engañoso ("Font family not
// registered"), no el ENOENT real. Con la data URL, react-pdf no toca el
// filesystem en absoluto durante el render. Bug real en producción 2026-10-13.
const FUENTES_DIR = path.join(process.cwd(), 'lib/pdf/fonts')
function leerFuente(nombre: string) {
  const buffer = fs.readFileSync(path.join(FUENTES_DIR, nombre))
  return `data:font/woff;base64,${buffer.toString('base64')}`
}
Font.register({
  family: 'Work Sans',
  fonts: [
    { src: leerFuente('WorkSans-Regular.woff'), fontWeight: 400 },
    { src: leerFuente('WorkSans-Medium.woff'), fontWeight: 500 },
    { src: leerFuente('WorkSans-SemiBold.woff'), fontWeight: 600 },
    { src: leerFuente('WorkSans-Bold.woff'), fontWeight: 700 },
  ],
})
Font.register({
  family: 'Poppins',
  fonts: [
    { src: leerFuente('Poppins-Medium.woff'), fontWeight: 500 },
    { src: leerFuente('Poppins-SemiBold.woff'), fontWeight: 600 },
  ],
})
Font.register({
  family: 'Questrial',
  fonts: [{ src: leerFuente('Questrial-Regular.woff'), fontWeight: 400 }],
})

// Se leen como Buffer (no como ruta de archivo) por el mismo motivo que
// las fuentes de arriba.
const LOGO_BUFFER = fs.readFileSync(path.join(process.cwd(), 'lib/pdf/assets/logo.png'))
const FOOTER_DECO_BUFFER = fs.readFileSync(path.join(process.cwd(), 'lib/pdf/assets/footer-decoracion.png'))

// Colores EXACTOS leídos del PDF de Canva (page.get_text("dict") para texto,
// page.get_drawings() para los fondos de las cajas) — no son aproximaciones.
const NAVY = '#000d66'
const LILA = '#ccc8fa'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Work Sans',
    fontSize: 9,
    paddingTop: 28,
    paddingHorizontal: 30,
    paddingBottom: 46, // deja lugar a la franja decorativa del fondo
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  // Logo en su propia fila; los datos de contacto y el número de proforma
  // van en una segunda fila, como dos columnas que arrancan en el mismo
  // alignItems:'flex-start' — así quedan SIEMPRE a la misma altura sin
  // importar cuántas líneas tenga cada lado (pedido de la diseñadora
  // 2026-10-10: "el número debe estar alineado con los datos de contacto").
  logoRow: { marginBottom: 10 },
  logo: { width: 130, height: 73 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  contactCol: { gap: 3 },
  contactRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  contactIconBox: { width: 9, paddingTop: 1 },
  contactLine: { fontSize: 8, color: '#000000' },
  headerRight: { alignItems: 'flex-end' },
  proformaTitle: { fontSize: 10, fontFamily: 'Work Sans', fontWeight: 500, color: NAVY, marginBottom: 6 },
  numeroBadge: {
    backgroundColor: LILA,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 14,
  },
  numeroBadgeText: { fontSize: 11, fontFamily: 'Work Sans', fontWeight: 700, color: NAVY },

  // Fila Date / Buyer Data — en la plantilla real NO son 3 columnas
  // repartidas a todo el ancho (eso dejaba espacios enormes, feedback
  // 2026-10-10 punto 3): es el bloque Date a la izquierda, y "Buyer Data"
  // como UNA sola caja a la derecha con una grilla interna 2x2 (razón
  // social+mail arriba, ubicación+teléfono abajo).
  topRow: { flexDirection: 'row', gap: 28, marginBottom: 14 },
  dateBlock: { gap: 3 },
  dateIconRow: { marginBottom: 2 },
  plainLine: { fontSize: 9, color: '#000000', fontFamily: 'Work Sans', fontWeight: 400 },
  buyerBlock: { flex: 1 },
  buyerTitle: { fontSize: 10, fontFamily: 'Work Sans', fontWeight: 700, color: NAVY, marginBottom: 4 },
  buyerGrid: { flexDirection: 'row', gap: 28 },
  buyerCol: { gap: 3 },

  termsRow: { flexDirection: 'row', gap: 14, marginBottom: 14 },
  termsBox: {
    flex: 1,
    backgroundColor: LILA,
    borderRadius: 8,
    padding: 10,
  },
  termsTitle: { fontSize: 10, fontFamily: 'Work Sans', fontWeight: 700, color: NAVY, marginBottom: 4 },
  termsLine: { fontSize: 8, color: '#000000', fontFamily: 'Work Sans', fontWeight: 400, marginBottom: 1 },

  table: { marginTop: 2 },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NAVY,
    borderRadius: 6,
    padding: '6 8',
  },
  tableHeaderText: { color: 'white', fontFamily: 'Work Sans', fontWeight: 600, fontSize: 8 },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
    padding: '8 8',
  },
  colImg: { width: '12%' },
  colQty: { width: '8%' },
  colDesc: { width: '38%', paddingRight: 6 },
  colCode: { width: '16%' },
  colPrice: { width: '13%', textAlign: 'right' },
  colTotal: { width: '13%', textAlign: 'right' },
  // El cuerpo de la tabla usa Poppins (no Work Sans) en el PDF real —
  // confirmado leyendo los spans de cada celda, no es un detalle menor:
  // Poppins tiene números con proporciones distintas, se nota si se deja
  // Work Sans ahí.
  descText: { fontSize: 8.5, color: NAVY, fontFamily: 'Poppins', fontWeight: 500 },
  codeText: { fontSize: 8, fontFamily: 'Courier', color: '#4b5563' },
  priceText: { fontSize: 8.5, color: NAVY, fontFamily: 'Poppins', fontWeight: 500 },
  totalText: { fontSize: 8.5, fontFamily: 'Poppins', fontWeight: 600, color: NAVY },

  productImgBox: {
    position: 'relative',
    width: 44,
    height: 44,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    padding: 3,
  },
  productImg: { width: '100%', height: '100%', objectFit: 'contain', borderRadius: 4 },
  zoomBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
  },

  totalsSection: { marginTop: 10, alignItems: 'flex-end' },
  totalRow: { flexDirection: 'row', gap: 16, marginBottom: 2 },
  totalLabel: { fontSize: 8, fontFamily: 'Poppins', fontWeight: 500, color: NAVY },
  totalValue: { fontSize: 9, fontFamily: 'Poppins', fontWeight: 500, color: NAVY, minWidth: 80, textAlign: 'right' },
  grandTotal: { backgroundColor: NAVY, borderRadius: 6, padding: '6 10', flexDirection: 'row', gap: 16, marginTop: 4 },
  grandTotalLabel: { fontSize: 9, fontFamily: 'Poppins', fontWeight: 600, color: '#ffffff' },
  grandTotalValue: { fontSize: 10, fontFamily: 'Poppins', fontWeight: 600, color: '#ffffff', minWidth: 80, textAlign: 'right' },

  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 26 },
  // "TERM AND CONDITIONS" es la única palabra del documento en Questrial.
  termsHeading: { fontSize: 9, fontFamily: 'Questrial', color: NAVY, marginBottom: 2 },
  termsText: { fontSize: 8.5, color: NAVY, fontFamily: 'Work Sans', fontWeight: 500, maxWidth: 300, lineHeight: 1.4 },
  signatureBlock: { alignItems: 'center' },
  signatureLabel: { fontSize: 9, fontFamily: 'Work Sans', fontWeight: 600, color: NAVY, marginTop: 2 },
  signatureSubLabel: { fontSize: 7, color: '#6b7280', fontFamily: 'Work Sans' },

  footerDeco: { position: 'absolute', bottom: 0, left: 0, width: '100%', height: 28 },
})

interface Props {
  proforma: Proforma
}

// cliente.ciudad existe en el schema pero en la practica quedo vacio para
// TODOS los clientes reales (nadie lo llena) — la ciudad de destino solo
// vive, si acaso, como el penultimo segmento separado por coma dentro de
// cliente.direccion (ej. "...Kgn. 11, Jamaica, West Indies, KINGSTON,
// JAMAICA"). Heuristica de mejor esfuerzo para el campo TO del PDF; no es
// perfecta para direcciones con formato distinto, pero sin esto TO
// mostraba solo el pais.
function ciudadDesdeCliente(cliente: NonNullable<Proforma['cliente']>): string {
  if (cliente.ciudad) return cliente.ciudad
  const partes = (cliente.direccion || '').split(',').map(p => p.trim()).filter(Boolean)
  if (partes.length < 2) return ''
  const candidata = partes[partes.length - 2]
  return candidata.toLowerCase() === cliente.pais.toLowerCase() ? '' : candidata
}

// Iconos dibujados a mano con primitivas Svg — react-pdf no trae ninguna
// fuente de iconos, y cargar una librería solo para 4 glifos de 9px no
// vale la pena. Color negro puro: confirmado contra el PDF de Canva que
// los iconos de contacto son #000000, no el navy del resto del texto.
function IconoLupa() {
  return (
    <Svg width={8} height={8} viewBox="0 0 24 24">
      <Circle cx="10" cy="10" r="6.5" stroke="white" strokeWidth={2.2} fill="none" />
      <Line x1="15" y1="15" x2="21" y2="21" stroke="white" strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  )
}

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

// Faltaba en el rediseño del 2026-10-05 — la plantilla real tiene un
// icono de calendario junto a "Date:" que no se había copiado.
function IconoCalendario() {
  return (
    <Svg width={10} height={10} viewBox="0 0 24 24">
      <Rect x="3" y="4.5" width="18" height="16" rx="2" stroke="#000000" strokeWidth={1.8} fill="none" />
      <Line x1="3" y1="9.5" x2="21" y2="9.5" stroke="#000000" strokeWidth={1.8} />
      <Line x1="7.5" y1="2.5" x2="7.5" y2="6.5" stroke="#000000" strokeWidth={1.8} strokeLinecap="round" />
      <Line x1="16.5" y1="2.5" x2="16.5" y2="6.5" stroke="#000000" strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  )
}

export function ProformaPDF({ proforma }: Props) {
  const cliente = proforma.cliente!
  const lineas = proforma.lineas || []
  const params = proforma.parametros_precio

  const totalFob = proforma.total_fob_usd || 0
  const totalFlete = proforma.total_flete_usd || 0
  const totalFinal = proforma.total_cif_usd || proforma.total_fob_usd || 0
  const labelTotal = proforma.incoterm === 'FOB' ? 'TOTAL FOB' : `TOTAL ${proforma.incoterm}`
  const esFactura = proforma.estado === 'facturada' || proforma.estado === 'anulada'
  const to = [ciudadDesdeCliente(cliente), cliente.pais].filter(Boolean).join(', ')
  const direccionComprador = cliente.direccion || [cliente.ciudad, cliente.pais].filter(Boolean).join(', ') || '—'
  const fecha = new Date(proforma.fecha).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const fechaVencimiento = proforma.fecha_vencimiento
    ? new Date(proforma.fecha_vencimiento).toLocaleDateString('en-US')
    : ''

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* HEADER — logo real de la diseñadora en su propia fila. Debajo,
            los datos de contacto (con ícono cada uno) y el título+badge
            del número van en la MISMA fila, para que queden a la misma
            altura sin importar el contenido de cada lado. */}
        <View style={styles.logoRow}>
          <Image src={LOGO_BUFFER} style={styles.logo} />
        </View>
        <View style={styles.header}>
          <View style={styles.contactCol}>
            <View style={styles.contactRow}>
              <View style={styles.contactIconBox}><IconoPin /></View>
              <View>
                <Text style={styles.contactLine}>San Francisco Calle 78, PH The View</Text>
                <Text style={styles.contactLine}>Apto 22A, Panama City, Panama</Text>
              </View>
            </View>
            <View style={styles.contactRow}>
              <View style={styles.contactIconBox}><IconoSobre /></View>
              <Text style={styles.contactLine}>egispty@gmail.com</Text>
            </View>
            <View style={styles.contactRow}>
              <View style={styles.contactIconBox}><IconoTelefono /></View>
              <Text style={styles.contactLine}>+507 6608-5639</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.proformaTitle}>{esFactura ? 'INVOICE' : 'PROFORMA INVOICE'}</Text>
            <View style={styles.numeroBadge}>
              <Text style={styles.numeroBadgeText}>{proforma.numero}</Text>
            </View>
          </View>
        </View>

        {/* DATE (con ícono de calendario) — BUYER DATA como una sola caja
            con grilla interna 2x2. Así es en el PDF real, no 3 columnas
            repartidas a todo el ancho (eso era el punto 3 del feedback
            de la diseñadora). */}
        <View style={styles.topRow}>
          <View style={styles.dateBlock}>
            <View style={[styles.contactRow, styles.dateIconRow]}>
              <View style={styles.contactIconBox}><IconoCalendario /></View>
            </View>
            <Text style={styles.plainLine}>Date: {fecha}</Text>
            {!esFactura && fechaVencimiento && (
              <Text style={styles.plainLine}>Valid until: {fechaVencimiento}</Text>
            )}
          </View>
          <View style={styles.buyerBlock}>
            <Text style={styles.buyerTitle}>Buyer Data</Text>
            <View style={styles.buyerGrid}>
              <View style={styles.buyerCol}>
                <Text style={styles.plainLine}>Razón social: {cliente.nombre}</Text>
                <Text style={styles.plainLine}>Ubicación: {direccionComprador}</Text>
              </View>
              <View style={styles.buyerCol}>
                <Text style={styles.plainLine}>Mail: {cliente.contacto_email || '—'}</Text>
                <Text style={styles.plainLine}>Teléfono: {cliente.contacto_telefono || '—'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* SHIPPING TERMS / PAYMENT TERMS */}
        <View style={styles.termsRow}>
          <View style={styles.termsBox}>
            <Text style={styles.termsTitle}>SHIPPING TERMS</Text>
            <Text style={styles.termsLine}>Incoterm: {proforma.incoterm}</Text>
            <Text style={styles.termsLine}>Via: Maritime   Shipped from: Xingang, China</Text>
            <Text style={styles.termsLine}>Destination: {to || '—'}</Text>
          </View>
          <View style={styles.termsBox}>
            <Text style={styles.termsTitle}>PAYMENT TERMS</Text>
            <Text style={styles.termsLine}>{proforma.payment_terms || '100% Arrival Notification'}</Text>
          </View>
        </View>
        {params && (
          <Text style={{ fontSize: 7, color: '#9ca3af', marginTop: -10, marginBottom: 10 }}>
            Freight cost: {formatUSD(params.flete_usd)} / {params.cbm_total_contenedor} CBM container
          </Text>
        )}

        {/* TABLE */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colImg]}>IMG</Text>
            <Text style={[styles.tableHeaderText, styles.colQty]}>QTY</Text>
            <Text style={[styles.tableHeaderText, styles.colDesc]}>DESCRIPTION</Text>
            <Text style={[styles.tableHeaderText, styles.colCode]}>CODE</Text>
            <Text style={[styles.tableHeaderText, styles.colPrice]}>UNIT PRICE</Text>
            <Text style={[styles.tableHeaderText, styles.colTotal]}>TOTAL</Text>
          </View>
          {lineas.map(linea => (
            <View key={linea.id} style={styles.tableRow}>
              <View style={styles.colImg}>
                {linea.producto?.imagen_url && (
                  // Click abre la foto en tamaño completo — un PDF no tiene
                  // zoom real al pasar el mouse, esto es lo más cerca que
                  // se puede llegar al pedido de "ampliar la foto" de la
                  // diseñadora (decisión confirmada con Jero 2026-10-05).
                  <Link src={linea.producto.imagen_url}>
                    <View style={styles.productImgBox}>
                      <Image src={linea.producto.imagen_url} style={styles.productImg} />
                      <View style={styles.zoomBadge}>
                        <IconoLupa />
                      </View>
                    </View>
                  </Link>
                )}
              </View>
              <Text style={[styles.colQty, styles.priceText]}>{linea.cantidad}</Text>
              <View style={styles.colDesc}>
                <Text style={styles.descText}>{linea.descripcion_pdf}</Text>
              </View>
              <Text style={[styles.colCode, styles.codeText]}>{linea.codigo_pdf || ''}</Text>
              <Text style={[styles.colPrice, styles.priceText]}>{formatUSD(linea.precio_cliente_usd || 0)}</Text>
              <Text style={[styles.colTotal, styles.totalText]}>{formatUSD(linea.subtotal_cliente_usd || 0)}</Text>
            </View>
          ))}
        </View>

        {/* TOTALS */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL AMOUNT FOB:</Text>
            <Text style={styles.totalValue}>{formatUSD(totalFob)}</Text>
          </View>
          {totalFlete > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>FREIGHT (Xingang to Kingston):</Text>
              <Text style={styles.totalValue}>{formatUSD(totalFlete)}</Text>
            </View>
          )}
          <View style={styles.grandTotal}>
            <Text style={styles.grandTotalLabel}>{labelTotal}:</Text>
            <Text style={styles.grandTotalValue}>{formatUSD(totalFinal)}</Text>
          </View>
        </View>

        {/* TERMS AND CONDITIONS + FIRMA */}
        <View style={styles.bottomRow}>
          <View>
            <Text style={styles.termsHeading}>TERM AND CONDITIONS</Text>
            <Text style={styles.termsText}>
              {!esFactura && 'This proforma invoice is valid for 15 days from the date of issue. '}
              All prices are in USD. Payment terms: 100% upon arrival notification.
            </Text>
          </View>
          <View style={styles.signatureBlock}>
            <Svg width={90} height={36} viewBox="0 0 90 36">
              <Path
                d="M6 24 C 14 6, 20 6, 24 18 S 34 30, 40 14 S 50 4, 56 20 S 68 30, 74 12 S 82 8, 86 18"
                stroke={NAVY}
                strokeWidth={1.3}
                fill="none"
              />
            </Svg>
            <Text style={styles.signatureLabel}>Representante legal</Text>
            <Text style={styles.signatureSubLabel}>President</Text>
          </View>
        </View>

        {/* FRANJA DECORATIVA — misma imagen que usa la diseñadora en su plantilla */}
        <Image src={FOOTER_DECO_BUFFER} style={styles.footerDeco} fixed />
      </Page>
    </Document>
  )
}
