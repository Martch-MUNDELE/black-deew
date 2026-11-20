// BLAC-P3-049 puis BLAC-ECRAN-COURSE-MAQUETTE : detail d'une livraison pour le livreur (maquette 2 · Nouvelle course).
// Lecture seule : aucun appel navigateur a la base ; le comportement des boutons existants ne change pas.
import {
  buildTelUrl,
  formatDistanceKm,
  formatLongDate,
  formatMoney,
  formatSlot,
  type DriverDeliveryDetail as DriverDeliveryDetailData,
} from '@/lib/driver-space'
import {
  actionBarKind,
  collectLabel,
  deliverLabel,
  headerBadge,
  LABEL_COLOR,
  LABEL_FONT_SIZE,
  steps,
  stockNote,
  type StockBalanceInput,
} from '@/lib/driver-delivery-view'
import DriverMarkDelivered from '@/components/driver/DriverMarkDelivered'
import DriverAcceptDelivery from '@/components/driver/DriverAcceptDelivery'
import DriverReportProblem from '@/components/driver/DriverReportProblem'
import DriverNavigationLinks from '@/components/driver/DriverNavigationLinks'
import DriverRouteMap from '@/components/driver/DriverRouteMap'

const C = {
  bg: '#0B0906',
  card: '#15110B',
  border: '#2A2216',
  text: '#F5EDD6',
  muted: '#BFAF8F',
  gold: '#F5C842',
  orange: '#FF6B20',
  green: '#7FD6A0',
  greenBg: '#10241A',
  alert: '#FFA566',
  alertBg: '#2E1809',
  dark: '#1A1206',
}
const SANS = "'DM Sans', sans-serif"
const SERIF = "'Playfair Display', serif"

// Les fonctions pures renvoient les libelles de la spec (sans accents) : l'affichage remet les accents.
const ACCENTS: Record<string, string> = { 'A accepter': 'À accepter', Acceptee: 'Acceptée', Livree: 'Livrée', Annulee: 'Annulée' }
const show = (label: string) => ACCENTS[label] ?? label

const cardStyle: React.CSSProperties = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  padding: 16,
}
const labelStyle: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: LABEL_FONT_SIZE,
  fontWeight: 600,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: LABEL_COLOR,
}

function BackArrow() {
  return (
    <a
      href="/admin/driver"
      aria-label="Retour à mes livraisons"
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, minWidth: 44, borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, color: C.gold, textDecoration: 'none' }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </a>
  )
}

function Shell({ children, withBar = false }: { children: React.ReactNode; withBar?: boolean }) {
  return (
    <div style={{ background: C.bg, margin: '-24px -16px', padding: 16, minHeight: '100vh', color: C.text, fontFamily: SANS }}>
      <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: withBar ? 'calc(140px + env(safe-area-inset-bottom))' : 'calc(32px + env(safe-area-inset-bottom))' }}>
        {children}
      </div>
    </div>
  )
}

function StepsBanner({ status }: { status: string }) {
  const list = steps(status)
  if (list.length === 0) return null
  return (
    <ol aria-label="Étapes de la course" style={{ ...cardStyle, listStyle: 'none', margin: 0, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      {list.map((step) => (
        <li key={step.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {step.state === 'done' ? (
            <span style={{ width: 28, height: 28, borderRadius: 999, background: C.greenBg, color: C.green, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </span>
          ) : step.state === 'current' ? (
            <span style={{ width: 28, height: 28, borderRadius: 999, background: C.gold, display: 'inline-block' }} />
          ) : (
            <span style={{ width: 28, height: 28, borderRadius: 999, border: `2px solid ${C.border}`, boxSizing: 'border-box', display: 'inline-block' }} />
          )}
          <span style={{ fontFamily: SANS, fontSize: 12, fontWeight: step.state === 'current' ? 700 : 500, color: step.state === 'upcoming' ? C.muted : C.text, textAlign: 'center' }}>
            {show(step.label)}
          </span>
        </li>
      ))}
    </ol>
  )
}

export default function DriverDeliveryDetail({
  delivery,
  error,
  stockBalances = [],
}: {
  delivery: DriverDeliveryDetailData | null
  error?: string | null
  stockBalances?: StockBalanceInput[]
}) {
  if (!delivery) {
    return (
      <Shell>
        <div>
          <BackArrow />
        </div>
        <section style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h1 style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 700, color: C.text, margin: 0 }}>
            {error ? 'Lecture impossible' : 'Livraison introuvable'}
          </h1>
          <p style={{ fontFamily: SANS, fontSize: 14, color: error ? C.alert : C.muted, margin: 0 }}>
            {error ?? "Cette livraison n'existe pas ou ne fait pas partie de tes livraisons."}
          </p>
        </section>
      </Shell>
    )
  }

  const delivered = delivery.status.trim().toLowerCase() === 'delivered'
  // BLAC-P3-058 : la course doit etre acceptee (picked_up) avant de pouvoir etre marquee livree
  const accepted = delivery.status.trim().toLowerCase() === 'picked_up'
  const cancelled = delivery.status.trim().toLowerCase() === 'cancelled'
  const notYetAccepted = !accepted && !delivered && !cancelled
  const bar = actionBarKind(delivery.status)

  const badge = headerBadge(delivery.status)
  const badgeColors =
    badge.tone === 'green'
      ? { fg: C.green, bg: C.greenBg }
      : badge.tone === 'alert'
        ? { fg: C.alert, bg: C.alertBg }
        : { fg: C.gold, bg: C.dark }
  const eyebrow = delivered ? 'Course livrée' : accepted ? 'Course en cours' : 'Nouvelle course'

  const dateText = formatLongDate(delivery.slotDate)
  const slotText = formatSlot(delivery.slotDate, delivery.slotStart, delivery.slotEnd)
  const distance = formatDistanceKm(delivery.distanceKm)
  const telHref = buildTelUrl(delivery.customerPhone)
  const stockLines = stockNote(delivery.items, stockBalances)

  return (
    <Shell withBar={bar !== null}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <BackArrow />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={labelStyle}>{eyebrow}</div>
          <h1 style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 700, color: C.text, margin: '2px 0 0', lineHeight: 1.15, overflowWrap: 'anywhere' }}>
            Commande #{delivery.orderRef}
          </h1>
        </div>
        <span style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: badgeColors.fg, background: badgeColors.bg, border: `1px solid ${badgeColors.fg}`, borderRadius: 999, padding: '4px 10px', whiteSpace: 'nowrap' }}>
          {show(badge.label)}
        </span>
      </header>

      <section style={{ ...cardStyle, padding: 12 }}>
        <DriverRouteMap lat={delivery.lat} lng={delivery.lng} distanceText={distance || undefined} />
      </section>

      <section style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={labelStyle}>Client</div>
        <div style={{ fontFamily: SANS, fontSize: 18, fontWeight: 700, color: C.text, overflowWrap: 'anywhere' }}>{delivery.customerName}</div>
        <div style={{ fontFamily: SANS, fontSize: 14, color: delivery.address ? C.muted : C.muted }}>
          {delivery.address || 'Adresse non renseignée'}
        </div>
        {telHref && !delivered && !cancelled ? <CallLink href={telHref} phone={delivery.customerPhone} /> : null}
        {delivery.note ? (
          <div style={{ background: C.alertBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
            <div style={{ ...labelStyle, color: C.alert }}>Note du client</div>
            <div style={{ fontFamily: SANS, fontSize: 14, color: C.text, marginTop: 4, overflowWrap: 'anywhere' }}>{delivery.note}</div>
          </div>
        ) : null}
        <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 4, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <span style={labelStyle}>{collectLabel(delivery.status)}</span>
          <span style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 800, color: C.gold }}>{formatMoney(delivery.amountToCollect)}</span>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <section style={{ ...cardStyle, padding: 14 }}>
          <div style={labelStyle}>Créneau</div>
          <div style={{ fontFamily: SANS, fontSize: 16, fontWeight: 700, color: C.text, marginTop: 6 }}>{slotText || 'À confirmer'}</div>
          {dateText ? <div style={{ fontFamily: SANS, fontSize: 12, color: C.muted, marginTop: 2 }}>{dateText}</div> : null}
        </section>
        <section style={{ ...cardStyle, padding: 14 }}>
          <div style={labelStyle}>Mes frais</div>
          <div style={{ fontFamily: SANS, fontSize: 16, fontWeight: 700, color: C.green, marginTop: 6 }}>+{formatMoney(delivery.deliveryFee)}</div>
        </section>
      </div>

      <section style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={labelStyle}>{deliverLabel(delivery.status)}</div>
        {delivery.items.map((item, index) => (
          <div
            key={`${item.name}-${index}`}
            style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontFamily: SANS, fontSize: 15, color: C.text, padding: '6px 0', borderTop: index === 0 ? 'none' : `1px solid ${C.border}` }}
          >
            <span>{item.name}</span>
            <strong>x{item.quantity}</strong>
          </div>
        ))}
        {stockLines.map((line) => (
          <div
            key={`stock-${line.name}`}
            style={{
              fontFamily: SANS,
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 999,
              padding: '8px 12px',
              color: line.enough ? C.green : C.alert,
              background: line.enough ? C.greenBg : C.alertBg,
            }}
          >
            {line.enough ? 'Stock VIP suffisant' : 'Stock insuffisant'} : il te reste {line.onHand} {line.name}
          </div>
        ))}
      </section>

      {notYetAccepted ? (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontFamily: SANS, fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.5 }}>
            En acceptant, la commande passe en livraison, WhatsApp s&apos;ouvre avec le message prêt pour la cliente et ton suivi en direct démarre.
          </p>
          <ActionBar>
            <DriverAcceptDelivery deliveryId={delivery.id} />
          </ActionBar>
          <DriverReportProblem deliveryId={delivery.id} />
        </section>
      ) : null}

      {accepted ? (
        <>
          <StepsBanner status={delivery.status} />
          <DriverNavigationLinks address={delivery.address} lat={delivery.lat} lng={delivery.lng} />
          <ActionBar>
            <DriverMarkDelivered deliveryId={delivery.id} amount={delivery.amountToCollect} />
          </ActionBar>
          <DriverReportProblem deliveryId={delivery.id} />
        </>
      ) : null}

      {delivered ? <StepsBanner status={delivery.status} /> : null}

    </Shell>
  )
}

// Barre d'action fixe en bas de l'ecran : hors du flux, donc l'ordre dans le source n'a pas d'effet visuel.
function ActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-testid="driver-action-bar"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        background: C.bg,
        borderTop: `1px solid ${C.border}`,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 12, maxHeight: '80vh', overflowY: 'auto', boxSizing: 'border-box' }}>{children}</div>
    </div>
  )
}

function CallLink({ href, phone }: { href: string; phone: string | null | undefined }) {
  return (
    <a
      href={href}
      style={{
        minHeight: 52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        borderRadius: 14,
        padding: '0 16px',
        fontFamily: SANS,
        fontSize: 16,
        fontWeight: 700,
        textDecoration: 'none',
        background: C.dark,
        color: C.gold,
        border: `1px solid ${C.gold}`,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
        </svg>
        Appeler
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{phone}</span>
    </a>
  )
}
