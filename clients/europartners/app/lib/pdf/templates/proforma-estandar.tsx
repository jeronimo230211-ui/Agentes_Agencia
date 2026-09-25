import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { Proforma } from '@/types/europartners'
import { formatUSD } from '@/lib/precio'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    padding: 30,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerLeft: { flex: 1 },
  headerRight: { alignItems: 'flex-end' },
  companyName: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1E3A5F' },
  companySubname: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#D4A017', marginTop: 2 },
  proformaTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1E3A5F' },
  // Grilla PROFORMA NO / DATE / etc. — valores en mayúscula (convención de
  // Incoterms y de la plantilla comercial que ya usaban Deisy/Marta antes
  // del sistema, ver captura compartida por Jero el 2026-09-24).
  infoGridTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  infoCol: { flex: 1 },
  infoRow: { flexDirection: 'row', marginBottom: 3 },
  infoRowRight: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 3 },
  infoLabel: { fontSize: 8, color: '#6b7280', width: 82 },
  infoLabelRight: { fontSize: 8, color: '#6b7280', width: 92, textAlign: 'right', marginRight: 6 },
  infoValue: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#1E3A5F', textTransform: 'uppercase' },
  detailsGrid: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  detailsCol: { flex: 1 },
  sectionTitleOrange: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#D4A017', marginBottom: 3 },
  detailsName: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1E3A5F', marginBottom: 2 },
  detailsLine: { fontSize: 8, color: '#374151', marginBottom: 1 },
  table: { marginTop: 12 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1E3A5F',
    padding: '4 6',
  },
  tableHeaderText: { color: 'white', fontFamily: 'Helvetica-Bold', fontSize: 8 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb', padding: '3 6' },
  tableRowAlt: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb', padding: '3 6', backgroundColor: '#f9fafb' },
  colImg: { width: '10%' },
  col1: { width: '9%' },
  col2: { width: '7%' },
  col3: { width: '35%' },
  col4: { width: '11%', textAlign: 'right' },
  col5: { width: '12%', textAlign: 'right' },
  col6: { width: '13%', textAlign: 'right' },
  productImgBox: {
    width: 26,
    height: 26,
    backgroundColor: '#f3f4f6',
    borderRadius: 3,
    padding: 2,
  },
  productImg: { width: '100%', height: '100%', objectFit: 'contain' },
  totalsSection: { marginTop: 8, alignItems: 'flex-end' },
  totalRow: { flexDirection: 'row', gap: 16, marginBottom: 2 },
  totalLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#374151' },
  totalValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1E3A5F', minWidth: 80, textAlign: 'right' },
  grandTotal: { backgroundColor: '#1E3A5F', padding: '4 8', flexDirection: 'row', gap: 16, marginTop: 4 },
  grandTotalLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#D4A017' },
  grandTotalValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#D4A017', minWidth: 80, textAlign: 'right' },
  footer: { marginTop: 20, borderTopWidth: 0.5, borderTopColor: '#d1d5db', paddingTop: 8, fontSize: 7, color: '#9ca3af' },
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

export function ProformaPDF({ proforma }: Props) {
  const cliente = proforma.cliente!
  const lineas = proforma.lineas || []
  const params = proforma.parametros_precio

  const totalFob = proforma.total_fob_usd || 0
  const totalFlete = proforma.total_flete_usd || 0
  const totalFinal = proforma.total_cif_usd || proforma.total_fob_usd || 0
  const labelTotal = proforma.incoterm === 'FOB' ? 'TOTAL FOB' : `TOTAL ${proforma.incoterm}`
  const esFactura = proforma.estado === 'facturada' || proforma.estado === 'anulada'
  const totalUnidades = lineas.reduce((sum, l) => sum + (l.cantidad || 0), 0)
  const to = [ciudadDesdeCliente(cliente), cliente.pais].filter(Boolean).join(' ')
  const direccionComprador = cliente.direccion || [cliente.ciudad, cliente.pais].filter(Boolean).join(', ') || '—'
  const contactoComprador = [cliente.contacto_telefono, cliente.contacto_email].filter(Boolean).join(' | ') || '—'
  const fecha = new Date(proforma.fecha).toLocaleDateString('en-GB')

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* HEADER — nombre completo de la empresa (EUROPARTNERS + razón
            social) fijo acá, ya no se lee de cliente.issuer_pdf (decisión
            de Jero, 2026-09-24: ese campo quedó desactualizado). */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.companyName}>EUROPARTNERS</Text>
            <Text style={styles.companySubname}>GLOBAL INVESTORS SERVICES S.A.</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.proformaTitle}>{esFactura ? 'INVOICE' : 'PROFORMA'}</Text>
          </View>
        </View>

        {/* PROFORMA NO / ORDER NO / VIA / TO / INCOTERM — DATE / PAYMENT
            TERMS / SHIPPED FROM / FREIGHT / INSURANCE */}
        <View style={styles.infoGridTop}>
          <View style={styles.infoCol}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>PROFORMA NO:</Text>
              <Text style={styles.infoValue}>{proforma.numero}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>ORDER NO:</Text>
              <Text style={styles.infoValue}>{proforma.numero_cliente || '—'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>VIA:</Text>
              <Text style={styles.infoValue}>Maritime</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>TO:</Text>
              <Text style={styles.infoValue}>{to || '—'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>INCOTERM:</Text>
              <Text style={styles.infoValue}>{proforma.incoterm}</Text>
            </View>
          </View>
          <View style={styles.infoCol}>
            <View style={styles.infoRowRight}>
              <Text style={styles.infoLabelRight}>DATE:</Text>
              <Text style={styles.infoValue}>{fecha}</Text>
            </View>
            <View style={styles.infoRowRight}>
              <Text style={styles.infoLabelRight}>PAYMENT TERMS:</Text>
              <Text style={styles.infoValue}>{proforma.payment_terms || '100% Arrival Notification'}</Text>
            </View>
            <View style={styles.infoRowRight}>
              <Text style={styles.infoLabelRight}>SHIPPED FROM:</Text>
              <Text style={styles.infoValue}>Xingang-China</Text>
            </View>
            <View style={styles.infoRowRight}>
              <Text style={styles.infoLabelRight}>FREIGHT:</Text>
              <Text style={styles.infoValue}>{proforma.freight || proforma.incoterm}</Text>
            </View>
            <View style={styles.infoRowRight}>
              <Text style={styles.infoLabelRight}>INSURANCE:</Text>
              <Text style={styles.infoValue}>{proforma.insurance || 'COLLECT'}</Text>
            </View>
          </View>
        </View>
        {params && (
          <Text style={{ fontSize: 7, color: '#9ca3af', marginTop: -10, marginBottom: 10 }}>
            Freight cost: {formatUSD(params.flete_usd)} / {params.cbm_total_contenedor} CBM container
          </Text>
        )}

        {/* ISSUER / SELLER DETAILS — BUYER / SELLER DETAILS */}
        <View style={styles.detailsGrid}>
          <View style={styles.detailsCol}>
            <Text style={styles.sectionTitleOrange}>ISSUER / SELLER DETAILS</Text>
            <Text style={styles.detailsName}>EUROPARTNERS GLOBAL INVESTORS SERVICES S.A.</Text>
            <Text style={styles.detailsLine}>Address: San Francisco Calle 78 PH The View, Panama City, Panama</Text>
            <Text style={styles.detailsLine}>Contact: +507 6608-5639 | E-mail: egispty@gmail.com</Text>
          </View>
          <View style={styles.detailsCol}>
            <Text style={styles.sectionTitleOrange}>BUYER / SELLER DETAILS</Text>
            <Text style={styles.detailsName}>{cliente.nombre}</Text>
            <Text style={styles.detailsLine}>Address: {direccionComprador}</Text>
            <Text style={styles.detailsLine}>Contact: {contactoComprador}</Text>
          </View>
        </View>

        {/* TABLE */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colImg]}></Text>
            <Text style={[styles.tableHeaderText, styles.col1]}>QTY</Text>
            <Text style={[styles.tableHeaderText, styles.col2]}>UNIT</Text>
            <Text style={[styles.tableHeaderText, styles.col3]}>DESCRIPTION</Text>
            <Text style={[styles.tableHeaderText, styles.col4, { textAlign: 'right' }]}>CODE</Text>
            <Text style={[styles.tableHeaderText, styles.col5, { textAlign: 'right' }]}>UNIT PRICE</Text>
            <Text style={[styles.tableHeaderText, styles.col6, { textAlign: 'right' }]}>TOTAL</Text>
          </View>
          {lineas.map((linea, i) => (
            <View key={linea.id} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <View style={styles.colImg}>
                {linea.producto?.imagen_url && (
                  <View style={styles.productImgBox}>
                    <Image src={linea.producto.imagen_url} style={styles.productImg} />
                  </View>
                )}
              </View>
              <Text style={styles.col1}>{linea.cantidad}</Text>
              <Text style={styles.col2}>SETS</Text>
              <Text style={styles.col3}>{linea.descripcion_pdf}</Text>
              <Text style={styles.col4}>{linea.codigo_pdf || ''}</Text>
              <Text style={styles.col5}>{formatUSD(linea.precio_cliente_usd || 0)}</Text>
              <Text style={styles.col6}>{formatUSD(linea.subtotal_cliente_usd || 0)}</Text>
            </View>
          ))}
        </View>

        {/* TOTALS */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL UNITS:</Text>
            <Text style={styles.totalValue}>{totalUnidades}</Text>
          </View>
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

        {/* FOOTER */}
        <View style={styles.footer}>
          {!esFactura && <Text>This proforma invoice is valid for 15 days from the date of issue.</Text>}
          <Text>All prices are in USD. Payment terms: 100% upon arrival notification.</Text>
          <Text style={{ marginTop: 4 }}>
            Europartners Global Investors Services S.A. — San Francisco Calle 78 PH The View, Panama City, Panama
          </Text>
        </View>
      </Page>
    </Document>
  )
}
