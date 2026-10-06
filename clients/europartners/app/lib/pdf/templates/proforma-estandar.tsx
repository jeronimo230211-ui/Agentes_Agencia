import { Document, Page, Text, View, StyleSheet, Image, Link, Svg, Circle, Line, Path } from '@react-pdf/renderer'
import fs from 'fs'
import path from 'path'
import type { Proforma } from '@/types/europartners'
import { formatUSD } from '@/lib/precio'

// Rediseño 2026-10-05 a partir de la plantilla de la diseñadora
// (europartners-proforma-invoice.pdf) — pedido de Jero: imágenes más
// grandes y clickeables (abren la foto completa al hacer click, un PDF no
// tiene zoom real), descripciones cortas (ver fix en cotizador/[id] que
// ahora guarda solo el nombre del producto, no la ficha técnica completa),
// y el layout nuevo de la diseñadora (franja decorativa, bloques lila de
// shipping/payment terms, badge redondeado del número de proforma).
//
// Se leen como Buffer (no como ruta de archivo) porque @react-pdf/renderer
// intenta resolver un string como URL si no es un Buffer/objeto de datos
// — con una ruta de Windows ("Only absolute URLs are supported") o en el
// filesystem de solo lectura de Vercel, pasar la ruta cruda no es
// confiable. Se leen una sola vez al cargar el módulo, no en cada request.
const LOGO_BUFFER = fs.readFileSync(path.join(process.cwd(), 'lib/pdf/assets/logo.png'))
const FOOTER_DECO_BUFFER = fs.readFileSync(path.join(process.cwd(), 'lib/pdf/assets/footer-decoracion.png'))

const MORADO = '#5B4FE0'
const MORADO_CLARO = '#EEECFC'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    paddingTop: 28,
    paddingHorizontal: 30,
    paddingBottom: 46, // deja lugar a la franja decorativa del fondo
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  logo: { width: 130, height: 73, marginBottom: 8 },
  contactLine: { fontSize: 8, color: '#374151', marginBottom: 2 },
  headerRight: { alignItems: 'flex-end' },
  proformaTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#1E3A5F', marginBottom: 6 },
  numeroBadge: {
    backgroundColor: MORADO_CLARO,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 14,
  },
  numeroBadgeText: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: MORADO },

  topRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 14,
  },
  topCol: { flex: 1 },
  topLabel: { fontSize: 8, color: '#6b7280' },
  topValue: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#1E3A5F', marginBottom: 4 },
  buyerTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: MORADO, marginBottom: 3 },

  termsRow: { flexDirection: 'row', gap: 14, marginBottom: 14 },
  termsBox: {
    flex: 1,
    backgroundColor: MORADO_CLARO,
    borderRadius: 8,
    padding: 10,
  },
  termsTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: MORADO, marginBottom: 4 },
  termsLine: { fontSize: 8, color: '#374151', marginBottom: 1 },

  table: { marginTop: 2 },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E3A5F',
    borderRadius: 6,
    padding: '6 8',
  },
  tableHeaderText: { color: 'white', fontFamily: 'Helvetica-Bold', fontSize: 8 },
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
  descText: { fontSize: 8.5, color: '#1f2937' },
  codeText: { fontSize: 8, fontFamily: 'Courier', color: '#4b5563' },
  priceText: { fontSize: 8.5, color: '#374151' },
  totalText: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#1E3A5F' },

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
    backgroundColor: MORADO,
    alignItems: 'center',
    justifyContent: 'center',
  },

  totalsSection: { marginTop: 10, alignItems: 'flex-end' },
  totalRow: { flexDirection: 'row', gap: 16, marginBottom: 2 },
  totalLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#374151' },
  totalValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1E3A5F', minWidth: 80, textAlign: 'right' },
  grandTotal: { backgroundColor: '#1E3A5F', borderRadius: 6, padding: '6 10', flexDirection: 'row', gap: 16, marginTop: 4 },
  grandTotalLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#D4A017' },
  grandTotalValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#D4A017', minWidth: 80, textAlign: 'right' },

  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 26 },
  termsText: { fontSize: 7, color: '#6b7280', maxWidth: 300, lineHeight: 1.4 },
  signatureBlock: { alignItems: 'center' },
  signatureLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#1E3A5F', marginTop: 2 },
  signatureSubLabel: { fontSize: 7, color: '#6b7280' },

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

// Icono de lupa dibujado a mano (react-pdf no soporta fuentes de iconos) —
// señala que la foto es clickeable, ver zoomBadge más abajo.
function IconoLupa() {
  return (
    <Svg width={8} height={8} viewBox="0 0 24 24">
      <Circle cx="10" cy="10" r="6.5" stroke="white" strokeWidth={2.2} fill="none" />
      <Line x1="15" y1="15" x2="21" y2="21" stroke="white" strokeWidth={2.2} strokeLinecap="round" />
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
        {/* HEADER — logo real de la diseñadora (extraído de su plantilla,
            ver lib/pdf/assets/logo.png) + dirección de contacto a la
            izquierda; título y badge redondeado con el número a la derecha. */}
        <View style={styles.header}>
          <View>
            <Image src={LOGO_BUFFER} style={styles.logo} />
            <Text style={styles.contactLine}>San Francisco Calle 78, PH The View</Text>
            <Text style={styles.contactLine}>Apto 22A, Panama City, Panama</Text>
            <Text style={styles.contactLine}>egispty@gmail.com</Text>
            <Text style={styles.contactLine}>+507 6608-5639</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.proformaTitle}>{esFactura ? 'INVOICE' : 'PROFORMA INVOICE'}</Text>
            <View style={styles.numeroBadge}>
              <Text style={styles.numeroBadgeText}>{proforma.numero}</Text>
            </View>
          </View>
        </View>

        {/* DATE / VALID UNTIL — BUYER DATA (razón social, ubicación, mail, teléfono) */}
        <View style={styles.topRow}>
          <View style={styles.topCol}>
            <Text style={styles.topLabel}>Date:</Text>
            <Text style={styles.topValue}>{fecha}</Text>
            {!esFactura && fechaVencimiento && (
              <>
                <Text style={styles.topLabel}>Valid until:</Text>
                <Text style={styles.topValue}>{fechaVencimiento}</Text>
              </>
            )}
          </View>
          <View style={[styles.topCol, { flex: 2 }]}>
            <Text style={styles.buyerTitle}>BUYER DATA</Text>
            <Text style={styles.topLabel}>Razón social:</Text>
            <Text style={styles.topValue}>{cliente.nombre}</Text>
            <Text style={styles.topLabel}>Ubicación:</Text>
            <Text style={styles.topValue}>{direccionComprador}</Text>
          </View>
          <View style={styles.topCol}>
            <Text style={styles.topLabel}>Mail:</Text>
            <Text style={styles.topValue}>{cliente.contacto_email || '—'}</Text>
            <Text style={styles.topLabel}>Teléfono:</Text>
            <Text style={styles.topValue}>{cliente.contacto_telefono || '—'}</Text>
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
            <Text style={[styles.termsText, { fontFamily: 'Helvetica-Bold', color: '#1E3A5F', marginBottom: 2 }]}>
              TERM AND CONDITIONS
            </Text>
            <Text style={styles.termsText}>
              {!esFactura && 'This proforma invoice is valid for 15 days from the date of issue. '}
              All prices are in USD. Payment terms: 100% upon arrival notification.
            </Text>
          </View>
          <View style={styles.signatureBlock}>
            <Svg width={90} height={36} viewBox="0 0 90 36">
              <Path
                d="M6 24 C 14 6, 20 6, 24 18 S 34 30, 40 14 S 50 4, 56 20 S 68 30, 74 12 S 82 8, 86 18"
                stroke="#1E3A5F"
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
