'use client'

// BLAC-P3-048 : accueil de l'espace livreur. Aucune lecture de table depuis le navigateur :
// les donnees initiales viennent du serveur, puis /api/driver/home est rappelee toutes les 20 secondes.
// BLAC-ACCUEIL-LIVREUR-MAQUETTE : mise en forme selon les maquettes (logo du site, course acceptee, barres de stock).
import { useCallback, useEffect, useRef, useState } from 'react'
import { signOutAction } from '@/app/actions/auth'
import DriverNavigationLinks from '@/components/driver/DriverNavigationLinks'
import DriverMarkDelivered from '@/components/driver/DriverMarkDelivered'
import {
  activeDelivery,
  buildMapsUrl,
  buildTelUrl,
  deliveryStepIndex,
  formatDayShort,
  formatMoney,
  formatSlot,
  formatTimeOfDay,
  initialOf,
  onlineBadge,
  splitDeliveries,
  stockBarRatio,
  type DriverDelivery,
  type DriverHomeData,
} from '@/lib/driver-space'

export const REFRESH_INTERVAL_MS = 20000

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
const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  gap: 12,
  fontFamily: SANS,
  fontSize: 14,
  color: C.text,
  padding: '8px 0',
  borderTop: `1px solid ${C.border}`,
}

type Props = {
  initial: DriverHomeData | null
  initialError: string | null
  driverName: string | null
  logoUrl?: string | null
}

function IconLogout() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  )
}
function IconPhone() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
    </svg>
  )
}
function IconRoute() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11l18-8-8 18-2-8-8-2z" />
    </svg>
  )
}
function IconCheck({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

function Pill({ children, tone }: { children: React.ReactNode; tone: 'green' | 'alert' | 'gold' | 'muted' }) {
  const palette =
    tone === 'green'
      ? { fg: C.green, bg: C.greenBg }
      : tone === 'alert'
        ? { fg: C.alert, bg: C.alertBg }
        : tone === 'muted'
          ? { fg: C.muted, bg: C.border }
          : { fg: C.gold, bg: '#2A2210' }
  return (
    <span style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: palette.fg, background: palette.bg, borderRadius: 999, padding: '4px 10px', whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

const buttonBase: React.CSSProperties = {
  flex: 1,
  minHeight: 48,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  borderRadius: 12,
  fontFamily: SANS,
  fontSize: 15,
  fontWeight: 600,
  textDecoration: 'none',
}

function ActionLink({ href, primary, icon, children }: { href: string | null; primary?: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  const style: React.CSSProperties = primary
    ? { ...buttonBase, background: `linear-gradient(135deg, ${C.gold}, ${C.orange})`, color: C.dark }
    : { ...buttonBase, background: 'transparent', color: C.gold, border: `1px solid ${C.gold}` }
  if (!href) {
    return (
      <span aria-disabled="true" style={{ ...style, opacity: 0.4 }}>
        {icon}
        {children}
      </span>
    )
  }
  const external = href.startsWith('http')
  return (
    <a href={href} style={style} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {icon}
      {children}
    </a>
  )
}

function Tile({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div style={{ ...cardStyle, flex: 1, minWidth: 0, padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ ...labelStyle, fontSize: 10, letterSpacing: '0.12em' }}>{label}</div>
      <div style={{ fontFamily: SANS, fontSize: 17, fontWeight: 700, color: accent ? C.gold : C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
      {hint ? <div style={{ fontFamily: SANS, fontSize: 12, color: C.muted }}>{hint}</div> : null}
    </div>
  )
}

const STEPS = ['Acceptée', 'En route', 'Livrée']

function StepBar({ status }: { status: string }) {
  // Acceptee = course prise en charge (picked_up) ; En route = etape courante ; Livree = fin.
  const current = deliveryStepIndex(status)
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', gap: 6 }}>
      {STEPS.map((label, i) => {
        const reached = i <= current
        return (
          <li key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ height: 4, borderRadius: 2, background: reached ? C.gold : C.border }} />
            <span style={{ fontFamily: SANS, fontSize: 12, fontWeight: reached ? 700 : 500, color: reached ? C.gold : C.muted }}>{label}</span>
          </li>
        )
      })}
    </ol>
  )
}

function ActiveCard({ d }: { d: DriverDelivery }) {
  const slot = formatSlot(d.slotDate, d.slotStart, d.slotEnd)
  return (
    <section style={{ ...cardStyle, borderColor: C.gold, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <StepBar status={d.status} />
      <a
        href={`/admin/driver/livraison/${d.id}`}
        style={{ display: 'flex', flexDirection: 'column', gap: 6, textDecoration: 'none', color: 'inherit' }}
      >
        <div style={{ fontFamily: SANS, fontSize: 18, fontWeight: 700, color: C.text }}>{d.customerName}</div>
        {d.address ? <div style={{ fontFamily: SANS, fontSize: 14, color: C.muted }}>{d.address}</div> : null}
        {slot ? <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, color: C.gold }}>{slot}</div> : null}
      </a>
      <div>
        <div style={labelStyle}>À encaisser</div>
        <div style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 800, color: C.gold, lineHeight: 1.1, marginTop: 4 }}>{formatMoney(d.amountToCollect)}</div>
      </div>
      <DriverNavigationLinks address={d.address} lat={d.lat} lng={d.lng} />
      <div style={{ display: 'flex', gap: 10 }}>
        <ActionLink href={buildTelUrl(d.customerPhone)} primary icon={<IconPhone />}>
          Appeler
        </ActionLink>
      </div>
      <DriverMarkDelivered deliveryId={d.id} amount={d.amountToCollect} />
    </section>
  )
}

function TodoCard({ d }: { d: DriverDelivery }) {
  const slot = formatSlot(d.slotDate, d.slotStart, d.slotEnd)
  return (
    <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, color: C.gold }}>{slot || 'Créneau à confirmer'}</span>
        <Pill tone="gold">À livrer</Pill>
      </div>
      <a
        href={`/admin/driver/livraison/${d.id}`}
        style={{ display: 'flex', flexDirection: 'column', gap: 10, textDecoration: 'none', color: 'inherit' }}
      >
        <div style={{ fontFamily: SANS, fontSize: 17, fontWeight: 600, color: C.text }}>{d.customerName}</div>
        {d.address ? <div style={{ fontFamily: SANS, fontSize: 14, color: C.muted }}>{d.address}</div> : null}
      </a>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: SANS, fontSize: 14, color: C.text }}>
        <span style={{ color: C.muted }}>À encaisser</span>
        <strong>{formatMoney(d.amountToCollect)}</strong>
      </div>
      <a
        href={`/admin/driver/livraison/${d.id}`}
        style={{
          minHeight: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 12,
          fontFamily: SANS,
          fontSize: 16,
          fontWeight: 700,
          textDecoration: 'none',
          background: C.gold,
          color: '#1A1206',
        }}
      >
        Voir et accepter la course
      </a>
      <div style={{ display: 'flex', gap: 10 }}>
        <ActionLink href={buildTelUrl(d.customerPhone)} primary icon={<IconPhone />}>
          Appeler
        </ActionLink>
        <ActionLink href={buildMapsUrl({ address: d.address, lat: d.lat, lng: d.lng })} icon={<IconRoute />}>
          Itinéraire
        </ActionLink>
      </div>
    </div>
  )
}

function StockBars({ stock }: { stock: DriverHomeData['stock'] }) {
  const max = stock.reduce((m, l) => Math.max(m, l.onHand), 0)
  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {stock.map((line) => {
        const ratio = stockBarRatio(line.onHand, max)
        const barColor = line.level === 'low' ? C.orange : C.green
        return (
          <div key={line.productId} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontFamily: SANS, fontSize: 14, color: C.text }}>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{line.name}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {line.level === 'empty' ? <Pill tone="alert">Épuisé</Pill> : null}
                <strong style={{ fontWeight: 800 }}>{line.onHand}</strong>
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: C.border, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round(ratio * 100)}%`, height: '100%', background: barColor, borderRadius: 3 }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function DriverHome({ initial, initialError, driverName, logoUrl = null }: Props) {
  const [data, setData] = useState<DriverHomeData | null>(initial)
  const [lost, setLost] = useState<boolean>(initial === null)
  const busy = useRef(false)

  const refresh = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    try {
      const res = await fetch('/api/driver/home', { cache: 'no-store', credentials: 'same-origin' })
      if (!res.ok) throw new Error('http')
      const next = (await res.json()) as DriverHomeData
      setData(next)
      setLost(false)
    } catch {
      setLost(true)
    } finally {
      busy.current = false
    }
  }, [])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    const timer = window.setInterval(onVisible, REFRESH_INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  const name = data?.driver.fullName ?? driverName ?? 'Livreur'
  const { todo, done } = splitDeliveries(data?.deliveries ?? [])
  const active = activeDelivery(todo)
  const waiting = active ? todo.filter((d) => d.id !== active.id) : todo
  const badge = onlineBadge(data?.session ?? null)
  const total = done.length + todo.length

  return (
    <div style={{ background: C.bg, margin: '-24px -16px', padding: 16, minHeight: '100vh', color: C.text, fontFamily: SANS }}>
      <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" width={44} height={44} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${C.gold}`, flexShrink: 0 }} />
          ) : (
            <div
              aria-hidden="true"
              style={{ width: 44, height: 44, borderRadius: '50%', border: `2px solid ${C.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SERIF, fontSize: 20, fontWeight: 700, color: C.gold, flexShrink: 0 }}
            >
              {initialOf(name)}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={labelStyle}>Espace livreur</div>
            <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          </div>
          <Pill tone={badge.tone}>{badge.label}</Pill>
        </header>

        {lost && data ? (
          <div role="status" style={{ fontFamily: SANS, fontSize: 12, color: C.alert }}>
            Connexion perdue, nouvel essai...
          </div>
        ) : null}

        {!data ? (
          <div style={{ ...cardStyle, fontFamily: SANS, fontSize: 14, color: C.alert }}>
            {initialError ?? 'Impossible de lire tes données pour le moment.'} Nouvel essai automatique...
          </div>
        ) : data.session ? (
          <>
            {active ? (
              <div style={{ display: 'flex', gap: 10 }}>
                <Tile label="Encaissé" value={formatMoney(data.cash?.collected ?? 0)} />
                <Tile label="Livraisons" value={`${done.length} sur ${total}`} />
                <Tile label="À remettre" value={formatMoney(data.cash?.netToRemit ?? 0)} accent />
              </div>
            ) : (
              <>
                <section style={cardStyle}>
                  <div style={labelStyle}>Net à remettre aujourd&apos;hui</div>
                  <div style={{ fontFamily: SERIF, fontSize: 44, fontWeight: 800, color: C.gold, lineHeight: 1.1, marginTop: 8 }}>
                    {formatMoney(data.cash?.netToRemit ?? 0)}
                  </div>
                  <div style={{ fontFamily: SANS, fontSize: 12, color: C.muted, marginTop: 4 }}>fonds + encaisse − frais</div>
                </section>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Tile label="Livraisons" value={`${done.length} sur ${total}`} />
                  <Tile label="Session" value={`depuis ${formatTimeOfDay(data.session.startedAt)}`} hint={formatDayShort(data.session.startedAt)} />
                </div>
              </>
            )}

            {active ? <ActiveCard d={active} /> : null}

            <section style={cardStyle}>
              <div style={labelStyle}>Mon stock VIP restant</div>
              {data.stock.length === 0 ? (
                <div style={{ fontFamily: SANS, fontSize: 14, color: C.muted, marginTop: 8 }}>Aucun stock chargé pour cette session.</div>
              ) : (
                <StockBars stock={data.stock} />
              )}
            </section>
          </>
        ) : (
          <>
            <section style={cardStyle}>
              <div style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: C.muted, display: 'inline-block' }} />
                Aucune session ouverte
              </div>
              <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700, color: C.text, marginTop: 8 }}>Ta session n&apos;est pas encore ouverte</div>
              <p style={{ fontFamily: SANS, fontSize: 14, color: C.muted, margin: '8px 0 0' }}>
                Ton responsable l&apos;ouvre avant ton départ, avec ton fonds d&apos;ouverture. Tes chiffres et tes livraisons apparaîtront ici dès qu&apos;elle est ouverte.
              </p>
            </section>
            {data.lastSession ? (
              <section style={cardStyle}>
                <div style={labelStyle}>Ma dernière session</div>
                <div style={{ marginTop: 8 }}>
                  <div style={rowStyle}>
                    <span style={{ color: C.muted }}>Date</span>
                    <strong>{formatDayShort(data.lastSession.startedAt)}</strong>
                  </div>
                  <div style={rowStyle}>
                    <span style={{ color: C.muted }}>Livraisons</span>
                    <strong>{data.lastSession.deliveriesCount}</strong>
                  </div>
                  <div style={rowStyle}>
                    <span style={{ color: C.muted }}>Encaissé</span>
                    <strong>{formatMoney(data.lastSession.collected)}</strong>
                  </div>
                  <div style={rowStyle}>
                    <span style={{ color: C.muted }}>Mes frais de livraison</span>
                    <strong>{formatMoney(data.lastSession.driverFees)}</strong>
                  </div>
                  <div style={rowStyle}>
                    <span style={{ color: C.muted }}>Remis à la clôture</span>
                    <strong>{formatMoney(data.lastSession.netToRemit)}</strong>
                  </div>
                </div>
              </section>
            ) : null}
          </>
        )}

        {data && data.session && !active && todo.length === 0 ? (
          <section style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10, padding: 24 }}>
            <span style={{ width: 56, height: 56, borderRadius: '50%', background: C.greenBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconCheck size={28} />
            </span>
            <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700, color: C.text }}>Aucune course en attente</div>
            <div style={{ fontFamily: SANS, fontSize: 14, color: C.muted }}>Les nouvelles courses apparaissent ici et sonnent sur ton téléphone.</div>
          </section>
        ) : null}

        {data && (waiting.length > 0 || done.length > 0) ? (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={labelStyle}>Livraisons du jour</div>
              <div style={{ fontFamily: SANS, fontSize: 13, color: C.gold, fontWeight: 600 }}>{todo.length} à faire</div>
            </div>
            {waiting.map((d) => (
              <TodoCard key={d.id} d={d} />
            ))}
            {done.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={labelStyle}>Déjà livrées</div>
                {done.map((d) => (
                  <a
                    key={d.id}
                    href={`/admin/driver/livraison/${d.id}`}
                    style={{ ...cardStyle, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, textDecoration: 'none', color: 'inherit' }}
                  >
                    <IconCheck />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.customerName}</div>
                      <div style={{ fontFamily: SANS, fontSize: 12, color: C.muted }}>{formatSlot(d.slotDate, d.slotStart, d.slotEnd)}</div>
                    </div>
                    <strong style={{ fontFamily: SANS, fontSize: 14 }}>{formatMoney(d.amountCollected || d.amountToCollect)}</strong>
                  </a>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <form action={signOutAction}>
          <button
            type="submit"
            style={{ width: '100%', minHeight: 44, borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, color: C.gold, fontFamily: SANS, fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}
          >
            <IconLogout />
            Se déconnecter
          </button>
        </form>
      </div>
    </div>
  )
}
