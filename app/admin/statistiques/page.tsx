'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCurrency } from '@/lib/currency'
import { getMonthlyStatistics, type MonthlyStatistics } from '@/lib/data/statistiques'
import StatsDeliveryMap from '@/components/StatsDeliveryMap'
import Accordion from '@/components/Accordion'

function currentMonthStr(): string {
  return new Date().toISOString().slice(0, 7)
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1, 1))
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

const SECTION_TITLE_STYLE: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#8A7A5C', margin: '0 0 10px',
  textTransform: 'uppercase', letterSpacing: 0.5,
}

const CARD_STYLE: React.CSSProperties = {
  background: '#131009', border: '1px solid rgba(232,160,32,0.15)', borderRadius: 12, padding: '1rem',
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={CARD_STYLE}>
      <div style={{ fontSize: 11, color: '#8A7A5C', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#6A5A40', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function ListCard({ title, rows }: { title: string; rows: Array<{ left: string; right: string }> }) {
  return (
    <div style={{ ...CARD_STYLE, padding: '1rem 1.25rem' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#E8DCC0', marginBottom: 10 }}>{title}</div>
      {rows.length === 0 && <div style={{ fontSize: 12, color: '#6A5A40' }}>Aucune donnee ce mois-ci.</div>}
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < rows.length - 1 ? '1px solid rgba(232,160,32,0.08)' : 'none' }}>
          <span style={{ fontSize: 13, color: '#E8DCC0' }}>{r.left}</span>
          <span style={{ fontSize: 13, color: '#8A7A5C' }}>{r.right}</span>
        </div>
      ))}
    </div>
  )
}

const BILLING_STATUS_LABELS: Record<string, string> = {
  en_cours: 'En cours',
  cloture: 'Cloture',
  facture: 'Facture',
  paye: 'Paye',
}

export default function StatistiquesPage() {
  const currency = useCurrency()
  const [month, setMonth] = useState(currentMonthStr())
  const [stats, setStats] = useState<MonthlyStatistics | null>(null)
  const [shopCoords, setShopCoords] = useState<{ lat?: number; lng?: number }>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hoveredDay, setHoveredDay] = useState<number | null>(null)
  const [mapFilter, setMapFilter] = useState<'tout' | 'classique' | 'vip' | 'mixte'>('tout')
  const chartRef = useRef<HTMLDivElement>(null)
  const [sessionInfo, setSessionInfo] = useState<string>('verification...')

  const load = useCallback(async (m: string) => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()

      const { data: sessionData } = await supabase.auth.getSession()
      if (sessionData.session) {
        setSessionInfo('Connecte : ' + (sessionData.session.user.email || 'sans email') + ' (role JWT : ' + (sessionData.session.user.role || 'inconnu') + ')')
      } else {
        setSessionInfo('AUCUNE SESSION ACTIVE - vous naviguez en anonyme')
      }

      const [data, settingsRes] = await Promise.all([
        getMonthlyStatistics(supabase, m),
        supabase.from('settings').select('key, value').in('key', ['delivery_shop_lat', 'delivery_shop_lng']),
      ])
      setStats(data)
      const rows = settingsRes.data || []
      const lat = rows.find(r => r.key === 'delivery_shop_lat')?.value
      const lng = rows.find(r => r.key === 'delivery_shop_lng')?.value
      setShopCoords({
        lat: lat ? parseFloat(lat) : undefined,
        lng: lng ? parseFloat(lng) : undefined,
      })
    } catch {
      setError('Erreur de chargement des statistiques.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(month) }, [month, load])

  if (loading) {
    return <div style={{ padding: '24px 20px', color: '#8A7A5C', fontSize: 14 }}>Chargement...</div>
  }
  if (error || !stats) {
    return <div style={{ padding: '24px 20px', color: '#FF6B6B', fontSize: 14 }}>{error || 'Erreur inconnue.'}</div>
  }

  const maxCA = Math.max(...stats.dailyBreakdown.map(d => d.caClassique + d.caVip + d.caMixed), 1)
  const SLOT_W = 280 / Math.max(stats.dailyBreakdown.length, 1)
  const MAX_H = 90
  const BASE_Y = 102
  const BAR_W = Math.max(SLOT_W / 4, 1.2)

  const handleChartTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!chartRef.current || !stats) return
    const touch = e.touches[0]
    if (!touch) return
    const rect = chartRef.current.getBoundingClientRect()
    const relativeX = touch.clientX - rect.left
    const svgX = (relativeX / rect.width) * 320
    const dayIndex = Math.floor(svgX / SLOT_W)
    const clamped = Math.max(0, Math.min(stats.dailyBreakdown.length - 1, dayIndex))
    setHoveredDay(clamped)
  }

  const maxHourly = Math.max(...stats.hourlyBreakdown.map(h => h.commandes), 1)

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#F5C842', margin: 0 }}>Statistiques</h1>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.25)', borderRadius: 8, padding: '8px 12px', color: '#E8DCC0', fontSize: 13 }}
        />
      </div>

      <div style={{ fontSize: 13, color: '#8A7A5C', marginBottom: 20, textTransform: 'capitalize' }}>{monthLabel(stats.month)}</div>

      <div style={{ fontSize: 11, color: '#8A7A5C', marginBottom: 12 }}>{sessionInfo}</div>

      {stats.debugErrors.length > 0 && (
        <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.4)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#FF6B6B' }}>
          {stats.debugErrors.map((e, i) => <div key={i}>{e}</div>)}
        </div>
      )}

      {/* Facturation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={SECTION_TITLE_STYLE}>Facturation plateforme</div>
        {stats.facturation.available && (
          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, background: 'rgba(232,160,32,0.15)', color: '#F5C842' }}>
            {BILLING_STATUS_LABELS[stats.facturation.status || ''] || stats.facturation.status}
          </span>
        )}
      </div>
      {!stats.facturation.available ? (
        <div style={{ ...CARD_STYLE, marginBottom: 20, color: '#6A5A40', fontSize: 13 }}>Aucune periode de facturation trouvee pour ce mois.</div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: '#6A5A40', marginBottom: 10 }}>
            Periode de facturation : {stats.facturation.periodStart} au {stats.facturation.periodEnd} (peut differer du mois calendaire ci-dessus)
          </div>
          {stats.facturation.recalculNecessaire && (
            <div style={{ background: 'rgba(255,159,69,0.1)', border: '1px solid rgba(255,159,69,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#FF9F45' }}>
              Le CA base a evolue depuis le dernier recalcul de facturation ({stats.facturation.caBaseAuDernierRecalcul.toFixed(0)} {currency} au dernier calcul, {stats.facturation.caBasePeriode.toFixed(0)} {currency} a date). La commission ci-dessous reste celle du dernier recalcul — relancez un recalcul de periode pour la mettre a jour.
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <KpiCard label="CA base a date" value={`${stats.facturation.caBasePeriode.toFixed(0)} ${currency}`} sub="hors frais livraison" color="#E8DCC0" />
            <KpiCard label="Frais fixe" value={`${stats.facturation.flatFee.toFixed(0)} ${currency}`} color="#E8DCC0" />
            <KpiCard label="Commission (dernier calcul)" value={`${stats.facturation.commission.toFixed(0)} ${currency}`} sub={`${stats.facturation.commissionRatePercent}% de ${stats.facturation.caBaseAuDernierRecalcul.toFixed(0)} ${currency}`} color="#F5C842" />
            <KpiCard label="Ajustements" value={`${stats.facturation.adjustments.toFixed(0)} ${currency}`} color="#E8DCC0" />
            <KpiCard label="Total du" value={`${stats.facturation.totalDue.toFixed(0)} ${currency}`} sub={`${stats.facturation.ordersCount} commandes`} color="#F5C842" />
          </div>
        </>
      )}

      {/* CA */}
      <div style={SECTION_TITLE_STYLE}>Chiffre d&apos;affaires</div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <KpiCard label="CA total" value={`${stats.ca.total.toFixed(0)} ${currency}`} color="#E8DCC0" />
        <KpiCard label="CA classique" value={`${stats.ca.classique.toFixed(0)} ${currency}`} sub={`${stats.ventes.classique.count} ventes`} color="#F5C842" />
        <KpiCard label="CA VIP" value={`${stats.ca.vip.toFixed(0)} ${currency}`} sub={`${stats.ventes.vip.count} ventes`} color="#FF6EB4" />
        <KpiCard label="CA mixte" value={`${stats.ca.mixed.toFixed(0)} ${currency}`} sub={`${stats.ventes.mixed.count} ventes`} color="#A078FF" />
        <KpiCard label="Panier moy. classique" value={`${stats.ca.panierMoyenClassique.toFixed(2)} ${currency}`} color="#F5C842" />
        <KpiCard label="Panier moy. VIP" value={`${stats.ca.panierMoyenVip.toFixed(2)} ${currency}`} color="#FF6EB4" />
      </div>

      {/* Graphique CA journalier */}
      <div style={{ ...CARD_STYLE, padding: '1rem 1.25rem', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 11 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#F5C842' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#F5C842', display: 'inline-block' }}></span>Classique
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#FF6EB4' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#FF6EB4', display: 'inline-block' }}></span>VIP
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#A078FF' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#A078FF', display: 'inline-block' }}></span>Mixte
          </span>
        </div>
        <div
          ref={chartRef}
          style={{ position: 'relative', touchAction: 'pan-y' }}
          onTouchStart={handleChartTouch}
          onTouchMove={handleChartTouch}
          onTouchEnd={() => setHoveredDay(null)}
        >
          <svg viewBox="0 0 320 140" style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
            <line x1={0} y1={BASE_Y} x2={320} y2={BASE_Y} stroke="rgba(232,160,32,0.15)" strokeWidth={1} />
            {stats.dailyBreakdown.map((d, i) => {
              const xSlot = i * SLOT_W
              const hC = d.caClassique > 0 ? Math.max((d.caClassique / maxCA) * MAX_H, 2) : 0
              const hV = d.caVip > 0 ? Math.max((d.caVip / maxCA) * MAX_H, 2) : 0
              const hM = d.caMixed > 0 ? Math.max((d.caMixed / maxCA) * MAX_H, 2) : 0
              const totalW = BAR_W * 3 + 4
              const xC = xSlot + (SLOT_W - totalW) / 2
              const xV = xC + BAR_W + 2
              const xM = xV + BAR_W + 2
              const dayNum = Number(d.date.slice(-2))
              const showLabel = dayNum === 1 || dayNum % 5 === 0
              const isHovered = hoveredDay === i
              return (
                <g key={i}>
                  <rect
                    x={xSlot} y={0} width={SLOT_W} height={BASE_Y}
                    fill={isHovered ? 'rgba(232,160,32,0.06)' : 'transparent'}
                    onMouseEnter={() => setHoveredDay(i)}
                    onMouseLeave={() => setHoveredDay(null)}
                    style={{ cursor: 'default' }}
                  />
                  {hC > 0 && <rect x={xC} y={BASE_Y - hC} width={BAR_W} height={hC} rx={1} fill="#F5C842" style={{ pointerEvents: 'none' }} />}
                  {hV > 0 && <rect x={xV} y={BASE_Y - hV} width={BAR_W} height={hV} rx={1} fill="#FF6EB4" style={{ pointerEvents: 'none' }} />}
                  {hM > 0 && <rect x={xM} y={BASE_Y - hM} width={BAR_W} height={hM} rx={1} fill="#A078FF" style={{ pointerEvents: 'none' }} />}
                  {showLabel && (
                    <text x={xSlot + SLOT_W / 2} y={BASE_Y + 14} textAnchor="middle" fill="#6A5A40" fontSize="8" style={{ pointerEvents: 'none' }}>{dayNum}</text>
                  )}
                </g>
              )
            })}
          </svg>
          {hoveredDay != null && stats.dailyBreakdown[hoveredDay] && (() => {
            const d = stats.dailyBreakdown[hoveredDay]
            const dayTotal = d.caClassique + d.caVip + d.caMixed
            const leftPercent = ((hoveredDay * SLOT_W + SLOT_W / 2) / 320) * 100
            return (
              <div style={{
                position: 'absolute', top: 0, left: `${leftPercent}%`, transform: 'translate(-50%, -100%)',
                background: '#1F1A10', border: '1px solid rgba(232,160,32,0.35)', borderRadius: 6,
                padding: '8px 10px', fontSize: 11, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 10,
              }}>
                <div style={{ color: '#E8DCC0', fontWeight: 700, marginBottom: 4 }}>{d.date} - {dayTotal.toFixed(0)} {currency}</div>
                <div style={{ color: '#F5C842' }}>Classique : {d.caClassique.toFixed(0)} {currency}</div>
                <div style={{ color: '#FF6EB4' }}>VIP : {d.caVip.toFixed(0)} {currency}</div>
                <div style={{ color: '#A078FF' }}>Mixte : {d.caMixed.toFixed(0)} {currency}</div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Clients */}
      <div style={SECTION_TITLE_STYLE}>Clients</div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <KpiCard label="Clients uniques" value={String(stats.clients.uniqueTotal)} sub={`${stats.clients.uniqueClassique} classique / ${stats.clients.uniqueVip} VIP`} color="#E8DCC0" />
        <KpiCard label="Taux de recurrence" value={`${stats.clients.recurrenceRatePercent}%`} sub="2+ commandes" color="#F5C842" />
        <KpiCard label="Nouveaux clients" value={String(stats.clients.nouveauxClients)} sub="1ere commande ce mois" color="#F5C842" />
        <KpiCard label="Clients a risque" value={String(stats.clients.clientsARisque)} sub="actifs mois dernier, absents ce mois" color="#FF9F45" />
      </div>

      {/* Top produits / clients */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <ListCard
          title="Top produits"
          rows={stats.topProduits.map(p => ({ left: p.name, right: `${p.quantity} vendus - ${p.ca.toFixed(0)} ${currency}` }))}
        />
        <ListCard
          title="Top clients"
          rows={stats.topClients.map(c => ({ left: c.label, right: `${c.commandes} cmd - ${c.ca.toFixed(0)} ${currency}` }))}
        />
      </div>

      {/* Zones / categories */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <ListCard
          title="Performance par zone"
          rows={stats.zones.map(z => ({ left: z.label, right: `${z.commandes} cmd - ${z.ca.toFixed(0)} ${currency}` }))}
        />
        <ListCard
          title="Repartition sous-categories"
          rows={stats.categories.map(c => ({ left: c.subcategory, right: `${c.percent}% - ${c.ca.toFixed(0)} ${currency}` }))}
        />
      </div>

      {/* Carte livraisons */}
      <div style={SECTION_TITLE_STYLE}>Carte des livraisons</div>
      <div style={{ ...CARD_STYLE, padding: '1rem 1.25rem', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {(['tout', 'classique', 'vip', 'mixte'] as const).map(f => {
            const count = f === 'tout' ? stats.pointsLivraison.length : stats.pointsLivraison.filter(p => p.typeClient === f).length
            return (
              <button
                key={f}
                onClick={() => setMapFilter(f)}
                style={{
                  fontSize: 12, padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
                  border: mapFilter === f ? '1px solid #F5C842' : '1px solid rgba(232,160,32,0.2)',
                  background: mapFilter === f ? 'rgba(245,200,66,0.12)' : 'transparent',
                  color: mapFilter === f ? '#F5C842' : '#8A7A5C',
                  textTransform: 'capitalize',
                }}
              >
                {f === 'tout' ? 'Tout afficher' : f} ({count})
              </button>
            )
          })}
        </div>
        {(() => {
          const filteredPoints = mapFilter === 'tout' ? stats.pointsLivraison : stats.pointsLivraison.filter(p => p.typeClient === mapFilter)
          return (
            <>
              <div style={{ fontSize: 13, color: '#8A7A5C', marginBottom: 10 }}>{filteredPoints.length} point(s) de livraison</div>
              {filteredPoints.length > 0 ? (
                <StatsDeliveryMap points={filteredPoints} currency={currency} shopLat={shopCoords.lat} shopLng={shopCoords.lng} />
              ) : (
                <div style={{ fontSize: 12, color: '#6A5A40', marginBottom: 12 }}>Aucune coordonnee de livraison pour ce filtre.</div>
              )}
              <div style={{ marginTop: 16 }}>
                <Accordion
                  header={<div style={{ fontSize: 13, fontWeight: 700, color: '#E8DCC0' }}>Afficher les clients ({filteredPoints.length})</div>}
                >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
                {filteredPoints
                  .slice()
                  .sort((a, b) => b.total - a.total)
                  .map((p, idx) => (
                    <Accordion
                      key={idx}
                      header={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 8 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#E8DCC0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.customerName}</div>
                            <div style={{ fontSize: 11, color: '#6A5A40' }}>{p.phone} - {p.commandes} commande(s)</div>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#F5C842', flexShrink: 0 }}>{p.total.toFixed(0)} {currency}</div>
                        </div>
                      }
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
                        {p.orders.map(o => (
                          <div key={o.id} style={{ borderBottom: '1px solid rgba(232,160,32,0.08)', paddingBottom: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                              <span style={{ color: '#8A7A5C' }}>{new Date(o.date).toLocaleDateString('fr-FR')}</span>
                              <span style={{ color: '#E8DCC0', fontWeight: 700 }}>{o.total.toFixed(0)} {currency}</span>
                            </div>
                            {o.deliveryMinutes != null && (
                              <div style={{ fontSize: 11, color: '#F5C842', marginBottom: 4 }}>
                                Livre en {Math.floor(o.deliveryMinutes / 60) > 0 ? `${Math.floor(o.deliveryMinutes / 60)}h ${o.deliveryMinutes % 60}min` : `${o.deliveryMinutes} min`}
                              </div>
                            )}
                            {o.items.map((item, i) => (
                              <div key={i} style={{ fontSize: 11, color: '#6A5A40', display: 'flex', justifyContent: 'space-between' }}>
                                <span>{item.quantity}x {item.name}</span>
                                <span>{(item.unitPrice * item.quantity).toFixed(0)} {currency}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </Accordion>
                  ))}
                </div>
                </Accordion>
              </div>
            </>
          )
        })()}
      </div>

      {/* Operationnel */}
      <div style={SECTION_TITLE_STYLE}>Operationnel</div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <KpiCard label="Taux de livraison" value={`${stats.operationnel.tauxLivraisonPercent}%`} color="#E8DCC0" />
        <KpiCard label="Taux annulation" value={`${stats.operationnel.tauxAnnulationPercent}%`} color="#FF6B6B" />
        <KpiCard label="Livraison vs retrait" value={`${stats.operationnel.livraisonPercent}% / ${stats.operationnel.retraitPercent}%`} color="#E8DCC0" />
        <KpiCard label="Distance moy." value={`${stats.operationnel.distanceMoyenneKm} km`} color="#E8DCC0" />
        <KpiCard label="Revenu frais livraison" value={`${stats.operationnel.revenuFraisLivraison.toFixed(0)} ${currency}`} color="#F5C842" />
        <KpiCard label="Remplissage creneaux" value={`${stats.operationnel.remplissageCreneauxPercent}%`} color="#E8DCC0" />
        <KpiCard label="Connexions" value={String(stats.connexions.total)} sub={`${stats.connexions.classique} classique / ${stats.connexions.vip} VIP`} color="#E8DCC0" />
        <KpiCard
          label="Delai livraison moyen"
          value={stats.delaiMoyenLivraisonTotalMinutes > 0
            ? (Math.floor(stats.delaiMoyenLivraisonTotalMinutes / 60) > 0
                ? `${Math.floor(stats.delaiMoyenLivraisonTotalMinutes / 60)}h ${stats.delaiMoyenLivraisonTotalMinutes % 60}min`
                : `${stats.delaiMoyenLivraisonTotalMinutes} min`)
            : 'N/A'}
          sub="nouvelle -> livree"
          color="#F5C842"
        />
      </div>

      {/* Funnel statuts */}
      <div style={SECTION_TITLE_STYLE}>Funnel des statuts</div>
      <div style={{ ...CARD_STYLE, padding: '1rem 1.25rem', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {stats.funnel.map(f => (
            <div key={f.status} style={{ flex: 1, minWidth: 100, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#E8DCC0' }}>{f.count}</div>
              <div style={{ fontSize: 11, color: '#8A7A5C', marginTop: 4, textTransform: 'capitalize' }}>{f.status}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: '#6A5A40', marginTop: 12 }}>Nombre de commandes ayant atteint chaque statut ce mois-ci (tracking actif depuis la mise en place).</div>

        {stats.delaisMoyens.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(232,160,32,0.08)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#E8DCC0', marginBottom: 10 }}>Delais moyens entre statuts</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {stats.delaisMoyens.map((d, i) => {
                const h = Math.floor(d.avgMinutes / 60)
                const m = d.avgMinutes % 60
                const label = h > 0 ? `${h}h ${m}min` : `${m} min`
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#8A7A5C', textTransform: 'capitalize' }}>{d.from} &rarr; {d.to}</span>
                    <span style={{ color: '#F5C842', fontWeight: 700 }}>{label} <span style={{ color: '#6A5A40', fontWeight: 400, fontSize: 11 }}>({d.count} commande{d.count > 1 ? 's' : ''})</span></span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Repartition horaire */}
      <div style={SECTION_TITLE_STYLE}>Repartition par heure</div>
      <div style={{ ...CARD_STYLE, padding: '1rem 1.25rem' }}>
        <svg viewBox="0 0 480 100" style={{ width: '100%', height: 'auto', display: 'block' }}>
          {stats.hourlyBreakdown.map((h, i) => {
            const barW = 480 / 24 - 2
            const barH = h.commandes > 0 ? Math.max((h.commandes / maxHourly) * 70, 2) : 0
            const x = i * (480 / 24) + 1
            return (
              <g key={h.hour}>
                {barH > 0 && <rect x={x} y={80 - barH} width={barW} height={barH} rx={1} fill="#F5C842" />}
                {h.hour % 3 === 0 && <text x={x + barW / 2} y={95} textAnchor="middle" fill="#6A5A40" fontSize="8">{h.hour}h</text>}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
