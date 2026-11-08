// BLAC-P3-049 : detail d'une livraison pour le livreur (lecture seule, aucun appel navigateur a la base).
import {
  buildMapsUrl,
  buildTelUrl,
  formatDistanceKm,
  formatLongDate,
  formatMoney,
  formatSlot,
  type DriverDeliveryDetail as DriverDeliveryDetailData,
} from '@/lib/driver-space'
import DriverMarkDelivered from '@/components/driver/DriverMarkDelivered'

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

const cardStyle: React.CSSProperties = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  padding: 16,
}
const labelStyle: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: C.muted,
}

function BackLink() {
  return (
    <a
      href="/admin/driver"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, fontFamily: SANS, fontSize: 15, fontWeight: 600, color: C.gold, textDecoration: 'none' }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      Mes livraisons
    </a>
  )
}

function Shell({ children, tall }: { children: React.ReactNode; tall?: boolean }) {
  return (
    <div style={{ background: C.bg, margin: '-24px -16px', padding: 16, minHeight: '100vh', color: C.text, fontFamily: SANS }}>
      <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: tall ? 'calc(260px + env(safe-area-inset-bottom))' : 'calc(52px + 48px + env(safe-area-inset-bottom))' }}>
        {children}
      </div>
    </div>
  )
}

const actionBase: React.CSSProperties = {
  flex: 1,
  minHeight: 52,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  borderRadius: 14,
  fontFamily: SANS,
  fontSize: 16,
  fontWeight: 700,
  textDecoration: 'none',
}

function ActionLink({ href, primary, label, children }: { href: string | null; primary?: boolean; label: string; children: React.ReactNode }) {
  const style: React.CSSProperties = primary
    ? { ...actionBase, background: `linear-gradient(135deg, ${C.gold}, ${C.orange})`, color: C.dark }
    : { ...actionBase, background: C.card, color: C.gold, border: `1px solid ${C.gold}` }
  if (!href) {
    return (
      <span aria-disabled="true" style={{ ...style, opacity: 0.4 }}>
        {children}
        {label}
      </span>
    )
  }
  const external = href.startsWith('http')
  return (
    <a href={href} style={style} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {children}
      {label}
    </a>
  )
}

export default function DriverDeliveryDetail({ delivery, error }: { delivery: DriverDeliveryDetailData | null; error?: string | null }) {
  if (!delivery) {
    return (
      <Shell>
        <BackLink />
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
  const dateText = formatLongDate(delivery.slotDate)
  const slotText = formatSlot(delivery.slotDate, delivery.slotStart, delivery.slotEnd)
  const distance = formatDistanceKm(delivery.distanceKm)
  const telHref = buildTelUrl(delivery.customerPhone)
  const mapsHref = buildMapsUrl({ address: delivery.address, lat: delivery.lat, lng: delivery.lng })

  return (
    <>
      <Shell tall={!delivered}>
        <BackLink />

        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={labelStyle}>Commande {delivery.orderRef}</div>
            <h1 style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 700, color: C.text, margin: '4px 0 0', lineHeight: 1.15, overflowWrap: 'anywhere' }}>
              {delivery.customerName}
            </h1>
          </div>
          <span
            style={{
              fontFamily: SANS,
              fontSize: 12,
              fontWeight: 600,
              color: delivered ? C.green : C.alert,
              background: delivered ? C.greenBg : C.alertBg,
              borderRadius: 999,
              padding: '4px 10px',
              whiteSpace: 'nowrap',
              marginTop: 4,
            }}
          >
            {delivered ? 'Livrée' : 'À livrer'}
          </span>
        </header>

        <section style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={labelStyle}>Créneau et adresse</div>
          <div style={{ fontFamily: SANS, fontSize: 17, fontWeight: 700, color: C.gold }}>
            {[dateText, slotText].filter(Boolean).join(' · ') || 'Créneau à confirmer'}
          </div>
          {delivery.address ? (
            <div style={{ fontFamily: SANS, fontSize: 15, color: C.text }}>
              {delivery.address}
              {distance ? <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{distance} depuis le dépôt</div> : null}
            </div>
          ) : (
            <div style={{ fontFamily: SANS, fontSize: 14, color: C.muted }}>Adresse non renseignée</div>
          )}
          {delivery.note ? (
            <div style={{ background: C.alertBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
              <div style={{ ...labelStyle, color: C.alert }}>Note du client</div>
              <div style={{ fontFamily: SANS, fontSize: 14, color: C.text, marginTop: 4, overflowWrap: 'anywhere' }}>{delivery.note}</div>
            </div>
          ) : null}
        </section>

        <section style={cardStyle}>
          <div style={labelStyle}>Contenu et montant</div>
          <div style={{ marginTop: 8 }}>
            {delivery.items.map((item, index) => (
              <div
                key={`${item.name}-${index}`}
                style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontFamily: SANS, fontSize: 14, color: C.text, padding: '8px 0', borderTop: index === 0 ? 'none' : `1px solid ${C.border}` }}
              >
                <span>
                  {item.quantity} × {item.name}
                </span>
                <strong>{formatMoney(item.quantity * item.unitPrice)}</strong>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontFamily: SANS, fontSize: 14, color: C.text, padding: '8px 0', borderTop: delivery.items.length ? `1px solid ${C.border}` : 'none' }}>
              <span style={{ color: C.muted }}>Livraison</span>
              <strong>{formatMoney(delivery.deliveryFee)}</strong>
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${C.gold}`, marginTop: 8, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontFamily: SANS, fontSize: 14, color: C.muted }}>À encaisser</span>
            <span style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 800, color: C.gold }}>{formatMoney(delivery.amountToCollect)}</span>
          </div>
        </section>
      </Shell>

      <nav
        aria-label="Actions de la livraison"
        style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: C.bg, borderTop: `1px solid ${C.border}`, padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', zIndex: 20 }}
      >
        <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!delivered ? <DriverMarkDelivered deliveryId={delivery.id} amount={delivery.amountToCollect} /> : null}
          <div style={{ display: 'flex', gap: 12 }}>
          <ActionLink href={telHref} label="Appeler">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
            </svg>
          </ActionLink>
          <ActionLink href={mapsHref} primary label="Itinéraire">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 11l18-8-8 18-2-8-8-2z" />
            </svg>
          </ActionLink>
          </div>
        </div>
      </nav>
    </>
  )
}
