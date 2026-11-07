'use client'

// BLAC-P3-048 : accueil de l'espace livreur. Aucune lecture de table depuis le navigateur :
// les donnees initiales viennent du serveur, puis /api/driver/home est rappelee toutes les 20 secondes.
import { useCallback, useEffect, useRef, useState } from 'react'
import { signOutAction } from '@/app/actions/auth'
import {
  buildMapsUrl,
  buildTelUrl,
  formatDayShort,
  formatMoney,
  formatSlot,
  formatTimeOfDay,
  initialOf,
  splitDeliveries,
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
function IconCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

function Pill({ children, tone }: { children: React.ReactNode; tone: 'green' | 'alert' | 'gold' }) {
  const palette =
    tone === 'green' ? { fg: C.green, bg: C.greenBg } : tone === 'alert' ? { fg: C.alert, bg: C.alertBg } : { fg: C.gold, bg: '#2A2210' }
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

function TodoCard({ d }: { d: DriverDelivery }) {
  const slot = formatSlot(d.slotDate, d.slotStart, d.slotEnd)
  return (
    <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, color: C.gold }}>{slot || 'Créneau à confirmer'}</span>
        <Pill tone="gold">À livrer</Pill>
      </div>
      <div style={{ fontFamily: SANS, fontSize: 17, fontWeight: 600, color: C.text }}>{d.customerName}</div>
      {d.address ? <div style={{ fontFamily: SANS, fontSize: 14, color: C.muted }}>{d.address}</div> : null}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: SANS, fontSize: 14, color: C.text }}>
        <span style={{ color: C.muted }}>À encaisser</span>
        <strong>{formatMoney(d.amountToCollect)}</strong>
      </div>
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

export default function DriverHome({ initial, initialError, driverName }: Props) {
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

  return (
    <div style={{ background: C.bg, margin: '-24px -16px', padding: 16, minHeight: '100vh', color: C.text, fontFamily: SANS }}>
      <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            aria-hidden="true"
            style={{ width: 44, height: 44, borderRadius: '50%', border: `2px solid ${C.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SERIF, fontSize: 20, fontWeight: 700, color: C.gold, flexShrink: 0 }}
          >
            {initialOf(name)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={labelStyle}>Espace livreur</div>
            <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              aria-label="Déconnexion"
              title="Déconnexion"
              style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <IconLogout />
            </button>
          </form>
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
            <section style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: SANS, fontSize: 15, fontWeight: 600 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: C.green, display: 'inline-block' }} />
                  Session ouverte
                </div>
                <div style={{ fontFamily: SANS, fontSize: 13, color: C.muted, marginTop: 4 }}>
                  depuis {formatTimeOfDay(data.session.startedAt)} · {formatDayShort(data.session.startedAt)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={labelStyle}>Fonds d&apos;ouverture</div>
                <div style={{ fontFamily: SANS, fontSize: 16, fontWeight: 700, color: C.text }}>{formatMoney(data.session.openingCash)}</div>
              </div>
            </section>

            {data.cash ? (
              <section style={cardStyle}>
                <div style={labelStyle}>Mes chiffres du jour</div>
                <div style={{ fontFamily: SERIF, fontSize: 44, fontWeight: 800, color: C.gold, lineHeight: 1.1, marginTop: 8 }}>{formatMoney(data.cash.netToRemit)}</div>
                <div style={{ fontFamily: SANS, fontSize: 12, color: C.muted, margin: '4px 0 12px' }}>Net à remettre · fonds + encaisse − frais</div>
                <div style={rowStyle}>
                  <span style={{ color: C.muted }}>Encaissé auprès des clients</span>
                  <strong>{formatMoney(data.cash.collected)}</strong>
                </div>
                <div style={rowStyle}>
                  <span style={{ color: C.muted }}>Mes frais de livraison</span>
                  <strong>{formatMoney(data.cash.driverFees)}</strong>
                </div>
                <div style={rowStyle}>
                  <span style={{ color: C.muted }}>Livraisons faites</span>
                  <strong>
                    {done.length} sur {done.length + todo.length}
                  </strong>
                </div>
              </section>
            ) : null}

            <section style={cardStyle}>
              <div style={labelStyle}>Mon stock VIP restant</div>
              {data.stock.length === 0 ? (
                <div style={{ fontFamily: SANS, fontSize: 14, color: C.muted, marginTop: 8 }}>Aucun stock chargé pour cette session.</div>
              ) : (
                <div style={{ marginTop: 8 }}>
                  {data.stock.map((line) => (
                    <div key={line.productId} style={{ ...rowStyle, alignItems: 'center' }}>
                      <span>{line.name}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        {line.level === 'empty' ? <Pill tone="alert">Épuisé</Pill> : line.level === 'low' ? <Pill tone="alert">Stock bas</Pill> : null}
                        <strong>{line.onHand}</strong>
                      </span>
                    </div>
                  ))}
                </div>
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

        {data ? (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={labelStyle}>Livraisons du jour</div>
              <div style={{ fontFamily: SANS, fontSize: 13, color: C.gold, fontWeight: 600 }}>{todo.length} à faire</div>
            </div>
            {todo.length === 0 && done.length === 0 ? (
              <div style={{ ...cardStyle, fontFamily: SANS, fontSize: 14, color: C.muted }}>
                Aucune livraison pour l&apos;instant. Tu recevras une notification à chaque nouvelle livraison.
              </div>
            ) : null}
            {todo.map((d) => (
              <TodoCard key={d.id} d={d} />
            ))}
            {done.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={labelStyle}>Déjà livrées</div>
                {done.map((d) => (
                  <div key={d.id} style={{ ...cardStyle, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>
                    <IconCheck />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.customerName}</div>
                      <div style={{ fontFamily: SANS, fontSize: 12, color: C.muted }}>{formatSlot(d.slotDate, d.slotStart, d.slotEnd)}</div>
                    </div>
                    <strong style={{ fontFamily: SANS, fontSize: 14 }}>{formatMoney(d.amountCollected || d.amountToCollect)}</strong>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  )
}
