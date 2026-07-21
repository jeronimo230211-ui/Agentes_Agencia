import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
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
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#1E3A5F',
  },
  headerLeft: { flex: 1 },
  headerRight: { alignItems: 'flex-end' },
  companyName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1E3A5F' },
  proformaTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#D4A017', marginBottom: 4 },
  proformaNum: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#1E3A5F' },
  sectionTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6b7280', marginBottom: 2 },
  value: { fontSize: 9 },
  infoGrid: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  infoBlock: { flex: 1 },
  table: { marginTop: 12 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1E3A5F',
    padding: '4 6',
  },
  tableHeaderText: { color: 'white', fontFamily: 'Helvetica-Bold', fontSize: 8 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb', padding: '3 6' },
  tableRowAlt: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb', padding: '3 6', backgroundColor: '#f9fafb' },
  col1: { width: '10%' },
  col2: { width: '8%' },
  col3: { width: '44%' },
  col4: { width: '12%', textAlign: 'right' },
  col5: { width: '12%', textAlign: 'right' },
  col6: { width: '14%', textAlign: 'right' },
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

export function ProformaPDF({ proforma }: Props) {
  const cliente = proforma.cliente!
  const lineas = proforma.lineas || []
  const params = proforma.parametros_precio

  const totalFob = proforma.total_fob_usd || 0
  const totalFlete = proforma.total_flete_usd || 0
  const totalFinal = proforma.total_cif_usd || proforma.total_fob_usd || 0
  const labelTotal = proforma.incoterm === 'FOB' ? 'TOTAL FOB' : `TOTAL ${proforma.incoterm}`

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.companyName}>{cliente.issuer_pdf}</Text>
            <Text style={{ fontSize: 7, color: '#6b7280', marginTop: 2 }}>
              San Francisco Calle 78, PH The View Apto 22A
            </Text>
            <Text style={{ fontSize: 7, color: '#6b7280' }}>Panama City, Panama</Text>
            <Text style={{ fontSize: 7, color: '#6b7280' }}>egispty@gmail.com · +507 6608-5639</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.proformaTitle}>PROFORMA INVOICE</Text>
            <Text style={styles.proformaNum}>{proforma.numero}</Text>
            <Text style={{ fontSize: 8, color: '#6b7280', marginTop: 4 }}>
              Date: {new Date(proforma.fecha).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </Text>
            {proforma.fecha_vencimiento && (
              <Text style={{ fontSize: 7, color: '#9ca3af' }}>
                Valid until: {new Date(proforma.fecha_vencimiento).toLocaleDateString('en-US')}
              </Text>
            )}
          </View>
        </View>

        {/* BUYER INFO */}
        <View style={styles.infoGrid}>
          <View style={styles.infoBlock}>
            <Text style={styles.sectionTitle}>BUYER / CONSIGNEE</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>{cliente.nombre}</Text>
            {cliente.ciudad && <Text style={styles.value}>{cliente.ciudad}</Text>}
            <Text style={styles.value}>{cliente.pais}</Text>
            {cliente.contacto_email && <Text style={styles.value}>{cliente.contacto_email}</Text>}
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.sectionTitle}>SHIPPING TERMS</Text>
            <Text style={styles.value}>Incoterm: {proforma.incoterm}</Text>
            <Text style={styles.value}>Via: Maritime</Text>
            <Text style={styles.value}>Shipped from: Xingang, China</Text>
            <Text style={styles.value}>Destination: Kingston, Jamaica</Text>
            {params && (
              <Text style={{ marginTop: 4, fontSize: 7, color: '#6b7280' }}>
                Freight: {formatUSD(params.flete_usd)} / {params.cbm_total_contenedor} CBM container
              </Text>
            )}
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.sectionTitle}>PAYMENT TERMS</Text>
            <Text style={styles.value}>100% Arrival Notification</Text>
            <Text style={styles.value}>of Shipment to Jamaica</Text>
          </View>
        </View>

        {/* TABLE */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.col1]}>QTY</Text>
            <Text style={[styles.tableHeaderText, styles.col2]}>UNIT</Text>
            <Text style={[styles.tableHeaderText, styles.col3]}>DESCRIPTION</Text>
            <Text style={[styles.tableHeaderText, styles.col4, { textAlign: 'right' }]}>CODE</Text>
            <Text style={[styles.tableHeaderText, styles.col5, { textAlign: 'right' }]}>UNIT PRICE</Text>
            <Text style={[styles.tableHeaderText, styles.col6, { textAlign: 'right' }]}>TOTAL</Text>
          </View>
          {lineas.map((linea, i) => (
            <View key={linea.id} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
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
            <Text style={styles.totalLabel}>TOTAL AMOUNT FOB:</Text>
            <Text style={styles.totalValue}>{formatUSD(totalFob)}</Text>
          </View>
          {totalFlete > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>FREIGHT (Xingang → Kingston):</Text>
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
          <Text>This proforma invoice is valid for 15 days from the date of issue.</Text>
          <Text>All prices are in USD. Payment terms: 100% upon arrival notification.</Text>
          <Text style={{ marginTop: 4 }}>
            Europartners International — San Francisco Calle 78 PH The View Apto 22A, Panama City, Panama
          </Text>
        </View>
      </Page>
    </Document>
  )
}
