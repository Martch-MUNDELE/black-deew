import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const gold = '#E8A020'
const dark = '#0F0B04'
const card = '#1A1510'
const cream = '#F5EDD6'
const muted = '#C8B99A'
const border = '#2A2318'

type FactureOrder = {
  id?: string | null
  customer_name?: string | null
  customer_phone?: string | null
  customer_address?: string | null
  delivery_mode?: string | null
  delivery_fee?: number | null
}

type FactureItem = {
  quantity?: number | null
  product_name?: string | null
  unit_price?: number | null
  selected_variants?: unknown
}

type FactureSlot = {
  date?: string | null
  time_start?: string | null
  time_end?: string | null
} | null

type FacturePDFProps = {
  order: FactureOrder
  items: FactureItem[]
  slot?: FactureSlot
  siteName?: string
  siteBaseline?: string
  factureNum?: string
  currency?: string
}

const getItemQuantity = (item: FactureItem) => item.quantity ?? 0
const getItemUnitPrice = (item: FactureItem) => item.unit_price ?? 0
const getItemName = (item: FactureItem) => item.product_name ?? ''

const getItemVariantsLabel = (item: FactureItem) => {
  const variants = item.selected_variants
  if (!variants || typeof variants !== 'object' || Array.isArray(variants)) return ''

  const entries = Object.entries(variants as Record<string, unknown>)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([type, option]) => `${type}: ${String(option)}`)

  return entries.length > 0 ? '\n' + entries.join(' · ') : ''
}

const styles = StyleSheet.create({
  page: { padding: 0, fontFamily: 'Helvetica', backgroundColor: dark },

  // HEADER
  header: { backgroundColor: card, padding: 32, paddingBottom: 24, borderBottom: `2px solid ${border}` },
  logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  logoText: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: gold, letterSpacing: 1 },
  logoSub: { fontSize: 9, color: muted, marginTop: 2 },
  headerRight: { flex: 1, alignItems: 'flex-end' },
  factureLabel: { fontSize: 10, color: muted, textTransform: 'uppercase', letterSpacing: 1.5 },
  factureNum: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: gold, marginTop: 4 },
  factureDate: { fontSize: 9, color: muted, marginTop: 2 },

  // BODY
  body: { padding: 32 },

  // SECTION
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: gold, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 },
  sectionCard: { backgroundColor: card, borderRadius: 8, padding: 16, border: `1px solid ${border}` },

  // ROWS INFO
  infoRow: { flexDirection: 'row', paddingVertical: 6, borderBottom: `1px solid ${border}`, gap: 12 },
  infoRowLast: { flexDirection: 'row', paddingVertical: 6, gap: 12 },
  infoLabel: { fontSize: 9, color: muted, width: 55, flexShrink: 0 },
  infoValue: { fontSize: 9, color: cream, fontFamily: 'Helvetica-Bold', maxWidth: 280, textAlign: 'right' },

  // ITEMS
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 10, borderBottom: `1px solid ${border}` },
  itemRowLast: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 10 },
  itemQty: { fontSize: 9, color: gold, fontFamily: 'Helvetica-Bold', backgroundColor: '#2A1F08', padding: '3 8', borderRadius: 4, marginRight: 8 },
  itemName: { fontSize: 10, color: cream, flex: 1 },
  itemPrice: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: muted },

  // TOTAL
  totalCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 14, borderTop: '1.5px solid ' + gold },
  totalLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: cream },
  totalValue: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: gold },

  // FOOTER
  footer: { padding: 24, paddingTop: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLeft: { fontSize: 9, color: muted },
  footerRight: { fontSize: 9, color: muted, textAlign: 'right' },
  divider: { height: 1, backgroundColor: border, marginHorizontal: 32, marginBottom: 20 },
})

export function FacturePDF({ order, items, slot, siteName, siteBaseline, factureNum, currency = 'DH' }: FacturePDFProps) {
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const slotDate = slot?.date
    ? new Date(slot.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    : '—'
  const orderId = factureNum ?? order.id?.slice(0, 8).toUpperCase() ?? 'FACTURE'
  const deliveryFee = order.delivery_fee ?? 0
  const subtotal = items.reduce((sum, item) => sum + getItemQuantity(item) * getItemUnitPrice(item), 0)

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* HEADER */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text style={styles.logoText}>{siteName ?? 'BLACK DEEW'}</Text>
              <Text style={styles.logoSub}>{siteBaseline ?? 'Kinshasa · Livraison à domicile'}</Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.factureLabel}>Facture</Text>
              <Text style={styles.factureNum}>{orderId}</Text>
              <Text style={styles.factureDate}>{date}</Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>

          {/* CLIENT + LIVRAISON empilés */}
          <View style={{ flexDirection: 'column', gap: 16, marginBottom: 24 }}>
            <View>
              <Text style={styles.sectionTitle}>Client</Text>
              <View style={styles.sectionCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Nom</Text>
                  <Text style={styles.infoValue}>{order.customer_name}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Téléphone</Text>
                  <Text style={styles.infoValue}>{order.customer_phone}</Text>
                </View>
                <View style={styles.infoRowLast}>
                  <Text style={styles.infoLabel}>Adresse</Text>
                  <Text style={styles.infoValue}>{order.customer_address || '—'}</Text>
                </View>
              </View>
            </View>

            <View>
              <Text style={styles.sectionTitle}>Livraison</Text>
              <View style={styles.sectionCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Date</Text>
                  <Text style={styles.infoValue}>{slotDate}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Heure</Text>
                  <Text style={styles.infoValue}>{slot?.time_start?.slice(0,5)} – {slot?.time_end?.slice(0,5)}</Text>
                </View>
                <View style={styles.infoRowLast}>
                  <Text style={styles.infoLabel}>Paiement</Text>
                  <Text style={styles.infoValue}>Cash à la livraison</Text>
                </View>
              </View>
            </View>
          </View>

          {/* COMMANDE */}
          <Text style={styles.sectionTitle}>Commande</Text>
          <View style={styles.sectionCard}>
            {items.map((item, i) => (
              <View key={i} style={i < items.length - 1 ? styles.itemRow : styles.itemRowLast}>
                <Text style={styles.itemQty}>{getItemQuantity(item)}x</Text>
                <Text style={styles.itemName}>{getItemName(item)}{getItemVariantsLabel(item)}</Text>
                <Text style={styles.itemPrice}>{(getItemQuantity(item) * getItemUnitPrice(item)).toFixed(2)} {currency}</Text>
              </View>
            ))}
          </View>

          {/* TOTAL */}
          {/* FRAIS DE LIVRAISON */}
          {order.delivery_mode === 'pickup' ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
              <Text style={{ fontSize: 10, color: '#C8B99A', fontFamily: 'Helvetica' }}>Mode</Text>
              <Text style={{ fontSize: 10, color: '#F5EDD6', fontFamily: 'Helvetica-Bold' }}>Retrait sur place</Text>
            </View>
          ) : deliveryFee > 0 ? (
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                <Text style={{ fontSize: 10, color: '#C8B99A', fontFamily: 'Helvetica' }}>Sous-total</Text>
                <Text style={{ fontSize: 10, color: '#F5EDD6', fontFamily: 'Helvetica' }}>{subtotal.toFixed(2)} {currency}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                <Text style={{ fontSize: 10, color: '#C8B99A', fontFamily: 'Helvetica' }}>Frais de livraison</Text>
                <Text style={{ fontSize: 10, color: '#F5C842', fontFamily: 'Helvetica-Bold' }}>{deliveryFee.toFixed(2)} {currency}</Text>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
              <Text style={{ fontSize: 10, color: '#C8B99A', fontFamily: 'Helvetica' }}>Frais de livraison</Text>
              <Text style={{ fontSize: 10, color: '#5BC57A', fontFamily: 'Helvetica-Bold' }}>Gratuit</Text>
            </View>
          )}
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total à payer</Text>
            <Text style={styles.totalValue}>{(subtotal + deliveryFee).toFixed(2)} {currency}</Text>
          </View>

        </View>

        {/* FOOTER */}
        <View style={styles.divider}/>
        <View style={styles.footer}>
          <Text style={styles.footerLeft}>Merci pour votre confiance !</Text>
          <Text style={styles.footerRight}>{siteName ?? 'Black Deew'} — Kinshasa, RDC</Text>
        </View>

      </Page>
    </Document>
  )
}
