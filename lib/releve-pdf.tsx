import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const gold = '#E8A020'
const dark = '#0F0B04'
const card = '#1A1510'
const cream = '#F5EDD6'
const muted = '#C8B99A'
const border = '#2A2318'
const green = '#5BC57A'
const blue = '#38B6FF'

const styles = StyleSheet.create({
  page: { padding: 0, fontFamily: 'Helvetica', backgroundColor: dark },
  header: { backgroundColor: card, padding: 32, paddingBottom: 24, borderBottom: `2px solid ${border}` },
  logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  logoText: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: gold, letterSpacing: 1 },
  logoSub: { fontSize: 9, color: muted, marginTop: 2 },
  headerRight: { flex: 1, alignItems: 'flex-end' },
  releveLabel: { fontSize: 10, color: muted, textTransform: 'uppercase', letterSpacing: 1.5 },
  releveNum: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: gold, marginTop: 4 },
  releveDate: { fontSize: 9, color: muted, marginTop: 2 },
  body: { padding: 32 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: gold, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 },
  sectionCard: { backgroundColor: card, borderRadius: 8, padding: 16, border: `1px solid ${border}` },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7, borderBottom: `1px solid ${border}` },
  rowLast: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 },
  rowLabel: { fontSize: 9, color: muted },
  rowValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: cream },
  totalCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 14, borderTop: `1.5px solid ${gold}` },
  totalLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: cream },
  totalValue: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: gold },
  paidBadge: { backgroundColor: 'rgba(91,197,122,0.15)', borderRadius: 4, padding: '4 10', marginTop: 8, alignSelf: 'flex-end' },
  paidText: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: green },
  statusBadge: { borderRadius: 4, padding: '3 8' },
  divider: { height: 1, backgroundColor: border, marginHorizontal: 32, marginBottom: 20 },
  footer: { padding: 24, paddingTop: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLeft: { fontSize: 9, color: muted },
  footerRight: { fontSize: 9, color: muted, textAlign: 'right' },
})

const STATUS_LABELS: Record<string, string> = {
  en_cours: 'En cours',
  cloture: 'Clôturé',
  facture: 'Facturé',
  paye: 'Payé',
}

export function RelevePDF({
  period,
  contract,
  siteName = 'Plateforme',
  siteBaseline = 'Relevé de facturation',
  clientEmail = '',
  currency = 'DH',
}: {
  period: any
  contract: any
  siteName?: string
  siteBaseline?: string
  clientEmail?: string
  currency?: string
}) {
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const periodStart = new Date(period.period_start + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const periodEnd = new Date(period.period_end + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const fmt = (n: number) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${currency}`

  const BILLING_MODE_LABELS: Record<string, string> = {
    flat_only: 'Abonnement fixe uniquement',
    flat_percent: 'Fixe + pourcentage simple',
    flat_tiered: 'Fixe + pourcentage par paliers',
    flat_category: 'Fixe + pourcentage par catégorie',
    flat_per_order: 'Fixe + montant fixe par commande',
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.logoText}>{siteName ?? 'Plateforme'}</Text>
              <Text style={styles.logoSub}>{siteBaseline ?? 'Relevé de facturation'}</Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.releveLabel}>Relevé de période</Text>
              <Text style={styles.releveNum}>{periodStart} au {periodEnd}</Text>
              <Text style={styles.releveDate}>Généré le {today}</Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {/* CLIENT */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Client</Text>
            <View style={styles.sectionCard}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Email</Text>
                <Text style={styles.rowValue}>{clientEmail}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Mode de facturation</Text>
                <Text style={styles.rowValue}>{BILLING_MODE_LABELS[contract?.billing_mode] ?? '—'}</Text>
              </View>
              <View style={styles.rowLast}>
                <Text style={styles.rowLabel}>Statut période</Text>
                <Text style={{ ...styles.rowValue, color: period.status === 'paye' ? green : period.status === 'facture' ? gold : cream }}>
                  {STATUS_LABELS[period.status] ?? period.status}
                </Text>
              </View>
            </View>
          </View>

          {/* ACTIVITÉ */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Activité</Text>
            <View style={styles.sectionCard}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Commandes livrées</Text>
                <Text style={styles.rowValue}>{period.orders_count}</Text>
              </View>
              <View style={styles.rowLast}>
                <Text style={styles.rowLabel}>Base de calcul</Text>
                <Text style={styles.rowValue}>{fmt(period.orders_base_amount)}</Text>
              </View>
            </View>
          </View>

          {/* FACTURATION */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Facturation</Text>
            <View style={styles.sectionCard}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Abonnement fixe</Text>
                <Text style={styles.rowValue}>{fmt(period.flat_fee_amount)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Commission</Text>
                <Text style={styles.rowValue}>{fmt(period.commission_amount)}</Text>
              </View>
              {period.adjustments_total !== 0 && (
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Ajustements</Text>
                  <Text style={{ ...styles.rowValue, color: period.adjustments_total < 0 ? green : '#FF6B6B' }}>
                    {period.adjustments_total > 0 ? '+' : ''}{fmt(period.adjustments_total)}
                  </Text>
                </View>
              )}
              <View style={styles.totalCard}>
                <Text style={styles.totalLabel}>Total dû</Text>
                <Text style={styles.totalValue}>{fmt(period.total_due)}</Text>
              </View>
              {period.total_paid > 0 && (
                <View style={styles.paidBadge}>
                  <Text style={styles.paidText}>✓ Payé : {fmt(period.total_paid)}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* FOOTER */}
        <View style={styles.divider} />
        <View style={styles.footer}>
          <Text style={styles.footerLeft}>Merci pour votre confiance !</Text>
          <Text style={styles.footerRight}>{siteName ?? 'Plateforme'} — Relevé généré automatiquement</Text>
        </View>
      </Page>
    </Document>
  )
}
