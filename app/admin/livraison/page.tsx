'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import LeafletMap from '@/components/LeafletMap'

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

interface Zone {
  id: string
  min_km: number
  max_km: number
  price: number
  min_order: number
  active: boolean
  isNew?: boolean
}

const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#C8B99A', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }
const inputStyle: React.CSSProperties = { width: '100%', maxWidth: '100%', minWidth: 0, padding: '10px 14px', boxSizing: 'border-box', borderRadius: 10, border: '1px solid rgba(232,160,32,0.2)', background: 'rgba(255,255,255,0.03)', color: '#F5EDD6', fontSize: 13, outline: 'none', fontFamily: 'DM Sans, sans-serif', appearance: 'none' }
const sectionStyle: React.CSSProperties = { background: '#131009', border: '1px solid rgba(232,160,32,0.12)', borderRadius: 16, padding: '22px 16px', marginBottom: 14, overflow: 'hidden' }
const sectionTitleStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#C8B99A', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 16 }

const TABS = [
  { key: 'mode', label: 'Mode' },
  { key: 'position', label: 'Position boutique' },
  { key: 'zone', label: 'Zone & tarifs' },
  { key: 'simulateur', label: 'Simulateur' },
]

function LivraisonContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeTab = searchParams.get('tab') || 'mode'
  const supabase = createClient()

  const [deliveryMode, setDeliveryMode] = useState<'all' | 'delivery_only' | 'pickup_only'>('all')
  const [shopLat, setShopLat] = useState('30.4202')
  const [shopLng, setShopLng] = useState('-9.5981')
  const [shopAddress, setShopAddress] = useState('Agadir, Maroc')
  const [maxRadius, setMaxRadius] = useState('10')
  const [tolerance, setTolerance] = useState('0.3')
  const [minOrder, setMinOrder] = useState('50')
  const [freeAbove, setFreeAbove] = useState('0')
  const [outOfZoneMessage, setOutOfZoneMessage] = useState('Désolé, votre adresse est hors de notre zone de livraison. Vous pouvez commander en retrait sur place.')
  const [pickupMessage, setPickupMessage] = useState('Venez récupérer votre commande directement à notre boutique.')
  const [minOrderStrategy, setMinOrderStrategy] = useState<'global' | 'per_zone'>('global')
  const [zones, setZones] = useState<Zone[]>([])
  const [deletedZoneIds, setDeletedZoneIds] = useState<string[]>([])
  const [mapSearch, setMapSearch] = useState('')
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState('')
  const [simAddress, setSimAddress] = useState('')
  const [simResult, setSimResult] = useState<any>(null)
  const [simLoading, setSimLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    supabase.from('settings').select('*').then(({ data }) => {
      data?.forEach((s: any) => {
        if (s.key === 'delivery_mode') setDeliveryMode(s.value || 'all')
        if (s.key === 'delivery_shop_lat') setShopLat(s.value || '30.4202')
        if (s.key === 'delivery_shop_lng') setShopLng(s.value || '-9.5981')
        if (s.key === 'delivery_shop_address') setShopAddress(s.value || '')
        if (s.key === 'delivery_max_radius') setMaxRadius(s.value || '10')
        if (s.key === 'delivery_tolerance') setTolerance(s.value || '0.3')
        if (s.key === 'delivery_min_order') setMinOrder(s.value || '50')
        if (s.key === 'delivery_free_above') setFreeAbove(s.value || '0')
        if (s.key === 'delivery_out_of_zone_message') setOutOfZoneMessage(s.value || '')
        if (s.key === 'delivery_pickup_message') setPickupMessage(s.value || '')
        if (s.key === 'delivery_min_order_strategy') setMinOrderStrategy((s.value === 'per_zone' ? 'per_zone' : 'global') as 'global' | 'per_zone')
      })
    })
    supabase.from('delivery_zones').select('*').order('min_km', { ascending: true }).then(({ data }) => {
      setZones((data || []).map((z: any) => ({ ...z, isNew: false })))
    })
  }, [])

  const useGPS = () => {
    if (!navigator.geolocation) { setGeoError('Géolocalisation non supportée'); return }
    setGeoLoading(true); setGeoError('')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=fr`, { headers: { 'User-Agent': 'AbouJoudia/1.0' } })
          const d = await res.json()
          setShopLat(lat.toFixed(6)); setShopLng(lng.toFixed(6))
          setShopAddress(d.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`)
        } catch {
          setShopLat(lat.toFixed(6)); setShopLng(lng.toFixed(6))
        }
        setGeoLoading(false)
      },
      (err) => { setGeoError(err.code === 1 ? 'Accès refusé.' : 'Position introuvable.'); setGeoLoading(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const searchAddress = async () => {
    if (!mapSearch.trim()) return
    setGeoLoading(true); setGeoError('')
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(mapSearch)}&format=json&limit=1&accept-language=fr`, { headers: { 'User-Agent': 'AbouJoudia/1.0' } })
      const d = await res.json()
      if (d && d.length > 0) {
        setShopLat(parseFloat(d[0].lat).toFixed(6)); setShopLng(parseFloat(d[0].lon).toFixed(6))
        setShopAddress(d[0].display_name || mapSearch)
      } else { setGeoError('Adresse introuvable.') }
    } catch { setGeoError('Erreur de géocodage.') }
    setGeoLoading(false)
  }

  const addZone = () => {
    const sorted = [...zones].sort((a, b) => a.min_km - b.min_km)
    const lastMax = sorted.length > 0 ? sorted[sorted.length - 1].max_km : 0
    setZones(prev => [...prev, { id: `temp-${Date.now()}`, min_km: lastMax, max_km: lastMax + 3, price: 15, min_order: 0, active: true, isNew: true }])
  }

  const updateZone = (id: string, field: keyof Zone, value: any) => {
    setZones(prev => prev.map(z => z.id === id ? { ...z, [field]: value } : z))
  }

  const removeZone = (id: string) => {
    if (!id.startsWith('temp-')) setDeletedZoneIds(prev => [...prev, id])
    setZones(prev => prev.filter(z => z.id !== id))
  }

  const hasOverlap = (): boolean => {
    const sorted = [...zones].sort((a, b) => a.min_km - b.min_km)
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].min_km < sorted[i - 1].max_km) return true
    }
    return false
  }

  const simulate = async () => {
    if (!simAddress.trim()) { setSimResult({ error: 'Entrez une adresse.' }); return }
    setSimLoading(true); setSimResult(null)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(simAddress)}&format=json&limit=1&accept-language=fr`, { headers: { 'User-Agent': 'AbouJoudia/1.0' } })
      const d = await res.json()
      if (!d || d.length === 0) { setSimResult({ error: 'Adresse introuvable.' }); setSimLoading(false); return }
      const lat = parseFloat(d[0].lat), lng = parseFloat(d[0].lon)
      const dist = haversine(parseFloat(shopLat), parseFloat(shopLng), lat, lng)
      const tol = parseFloat(tolerance) || 0.3
      const radius = parseFloat(maxRadius) || 10
      if (dist > radius + tol) {
        setSimResult({ dist, inZone: false, message: outOfZoneMessage })
      } else {
        const activeZones = zones.filter(z => z.active).sort((a, b) => a.min_km - b.min_km)
        const match = activeZones.find(z => dist >= z.min_km && dist < z.max_km + tol)
        if (!match) setSimResult({ dist, inZone: true, noZone: true })
        else setSimResult({ dist, inZone: true, zone: match, fee: match.price })
      }
    } catch { setSimResult({ error: 'Erreur lors du test.' }) }
    setSimLoading(false)
  }

  const save = async () => {
    if (hasOverlap()) { setSaveError('Les tranches tarifaires se chevauchent. Corrigez avant d\'enregistrer.'); return }
    const _maxRadiusNum = parseFloat(maxRadius) || 0
    if (_maxRadiusNum > 0 && zones.some(z => z.max_km > _maxRadiusNum || z.min_km >= _maxRadiusNum)) {
      setSaveError(`Des tranches dépassent le rayon maximum de ${_maxRadiusNum} km.`)
      return
    }
    setSaving(true); setSaveError('')
    await Promise.all([
      supabase.from('settings').upsert({ key: 'delivery_mode', value: deliveryMode }),
      supabase.from('settings').upsert({ key: 'delivery_shop_lat', value: shopLat }),
      supabase.from('settings').upsert({ key: 'delivery_shop_lng', value: shopLng }),
      supabase.from('settings').upsert({ key: 'delivery_shop_address', value: shopAddress }),
      supabase.from('settings').upsert({ key: 'delivery_max_radius', value: maxRadius }),
      supabase.from('settings').upsert({ key: 'delivery_tolerance', value: tolerance }),
      supabase.from('settings').upsert({ key: 'delivery_min_order', value: minOrder }),
      supabase.from('settings').upsert({ key: 'delivery_free_above', value: freeAbove }),
      supabase.from('settings').upsert({ key: 'delivery_out_of_zone_message', value: outOfZoneMessage }),
      supabase.from('settings').upsert({ key: 'delivery_pickup_message', value: pickupMessage }),
      supabase.from('settings').upsert({ key: 'delivery_min_order_strategy', value: minOrderStrategy }),
    ])
    if (deletedZoneIds.length > 0) {
      await supabase.from('delivery_zones').delete().in('id', deletedZoneIds)
      setDeletedZoneIds([])
    }
    const newZones: Zone[] = []
    for (const zone of zones) {
      if (zone.isNew || zone.id.startsWith('temp-')) {
        const { data } = await supabase.from('delivery_zones').insert({ min_km: zone.min_km, max_km: zone.max_km, price: zone.price, min_order: zone.min_order, active: zone.active }).select().single()
        if (data) newZones.push({ ...data, isNew: false })
        else newZones.push(zone)
      } else {
        await supabase.from('delivery_zones').upsert({ id: zone.id, min_km: zone.min_km, max_km: zone.max_km, price: zone.price, min_order: zone.min_order, active: zone.active })
        newZones.push({ ...zone, isNew: false })
      }
    }
    setZones(newZones)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const mapLat = parseFloat(shopLat) || 30.4202
  const mapLng = parseFloat(shopLng) || -9.5981
  const overlapErr = hasOverlap()
  const maxRadiusNum = parseFloat(maxRadius) || 0
  const hasZoneExceedingRadius = maxRadiusNum > 0 && zones.some(z => z.max_km > maxRadiusNum || z.min_km >= maxRadiusNum)

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 20px 120px', fontFamily: 'DM Sans, sans-serif', color: '#F5EDD6' }}>
      <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 700, marginBottom: 20, background: 'linear-gradient(135deg,#F5C842,#FF6B20)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Livraison</h1>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 24, paddingBottom: 4 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => router.push(`/admin/livraison?tab=${t.key}`)} style={{ padding: '8px 14px', borderRadius: 50, border: '1px solid', borderColor: activeTab === t.key ? 'rgba(232,160,32,0.4)' : 'rgba(232,160,32,0.12)', background: activeTab === t.key ? 'rgba(232,160,32,0.12)' : 'transparent', color: activeTab === t.key ? '#E8A020' : '#C8B99A', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' as const }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* MODE */}
      {activeTab === 'mode' && (
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Mode de livraison</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {([
              { value: 'all', label: 'Livraison + Retrait' },
              { value: 'delivery_only', label: 'Livraison uniquement' },
              { value: 'pickup_only', label: 'Retrait uniquement' },
            ] as const).map(opt => (
              <button key={opt.value} onClick={() => setDeliveryMode(opt.value)} style={{ padding: '10px 18px', borderRadius: 10, border: `1.5px solid ${deliveryMode === opt.value ? '#F5C842' : 'rgba(232,160,32,0.15)'}`, background: deliveryMode === opt.value ? 'rgba(245,200,66,0.1)' : 'transparent', color: deliveryMode === opt.value ? '#F5C842' : '#A89880', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', gap: 8 }}>
                {deliveryMode === opt.value && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F5C842', display: 'inline-block', flexShrink: 0 }} />}
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* POSITION */}
      {activeTab === 'position' && (
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Position de la boutique</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <button onClick={useGPS} disabled={geoLoading} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(232,160,32,0.3)', background: 'rgba(232,160,32,0.07)', color: '#E8A020', fontSize: 12, fontWeight: 700, cursor: geoLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'DM Sans, sans-serif' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" /></svg>
              {geoLoading ? 'Localisation...' : 'Utiliser ma position GPS'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: geoError ? 10 : 14 }}>
            <input value={mapSearch} onChange={e => setMapSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchAddress()} placeholder="Rechercher une adresse manuellement..." style={{ ...inputStyle, flex: 1 }} />
            <button onClick={searchAddress} disabled={geoLoading} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', flexShrink: 0, background: 'linear-gradient(135deg,#F5C842,#FF6B20)', color: '#0A0804', fontSize: 12, fontWeight: 700, cursor: geoLoading ? 'wait' : 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Rechercher</button>
          </div>
          {geoError && <div style={{ fontSize: 12, color: '#FF6B6B', marginBottom: 12 }}>{geoError}</div>}
          <div style={{ marginBottom: 14, position: 'relative', zIndex: 0 }}>
            <LeafletMap lat={mapLat} lng={mapLng} onPositionChange={(newLat, newLng, addr) => { setShopLat(newLat.toFixed(6)); setShopLng(newLng.toFixed(6)); if (addr) setShopAddress(addr) }} />
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '12px 14px', marginBottom: 14, border: '1px solid rgba(232,160,32,0.08)' }}>
            <div style={{ fontSize: 10, color: '#8A7A60', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700 }}>Adresse retenue</div>
            <div style={{ fontSize: 13, color: '#F5EDD6' }}>{shopAddress || '—'}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={labelStyle}>Latitude</label><input value={shopLat} readOnly style={{ ...inputStyle, color: '#8A7A60' }} /></div>
            <div><label style={labelStyle}>Longitude</label><input value={shopLng} readOnly style={{ ...inputStyle, color: '#8A7A60' }} /></div>
          </div>
        </div>
      )}

      {/* ZONE & TARIFS */}
      {activeTab === 'zone' && (
        <>
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Zone de livraison</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div><label style={labelStyle}>Rayon maximum (km)</label><input type="number" value={maxRadius} onChange={e => setMaxRadius(e.target.value)} min="0" step="0.5" style={inputStyle} /></div>
              <div><label style={labelStyle}>Tolérance GPS (km)</label><input type="number" value={tolerance} onChange={e => setTolerance(e.target.value)} min="0" step="0.1" style={inputStyle} /></div>
            </div>
            <div style={{ background: 'rgba(232,160,32,0.06)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#C8B99A', border: '1px solid rgba(232,160,32,0.1)' }}>
              Vous couvrez un rayon de <strong style={{ color: '#F5C842' }}>{maxRadius} km</strong> autour de votre boutique{tolerance !== '0' ? ` (±${tolerance} km de tolérance GPS)` : ''}
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Stratégie de commande minimum</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {([{ value: 'global' as const, label: 'Globale', desc: 'Un seul montant minimum s\'applique à toute livraison.' }, { value: 'per_zone' as const, label: 'Par tranche', desc: 'Chaque tranche tarifaire définit son propre montant minimum.' }]).map(opt => {
                const selected = minOrderStrategy === opt.value
                return (
                  <button key={opt.value} onClick={() => setMinOrderStrategy(opt.value)} style={{ borderRadius: 12, padding: '12px 16px', cursor: 'pointer', width: '100%', textAlign: 'left', border: `1.5px solid ${selected ? '#F5C842' : 'rgba(232,160,32,0.2)'}`, background: selected ? 'rgba(245,200,66,0.08)' : 'transparent', color: selected ? '#F5EDD6' : '#C8B99A', fontFamily: 'DM Sans, sans-serif' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 14, color: '#F5C842' }}>{selected ? '●' : '○'}</span>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{opt.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#7A6E58', lineHeight: 1.5 }}>{opt.desc}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Tranches tarifaires</div>
            {hasZoneExceedingRadius && <div style={{ background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.25)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#FF6B6B', marginBottom: 10 }}>⚠ Certaines tranches dépassent votre rayon maximum de {maxRadiusNum} km</div>}
            {zones.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#8A7A60', fontSize: 13 }}>Aucune tranche définie.</div>
            ) : (
              <div style={{ marginBottom: 12 }}>
                {[...zones].sort((a, b) => a.min_km - b.min_km).map(zone => {
                  const prev = [...zones].sort((a, b) => a.min_km - b.min_km).find((z, i, arr) => arr[i + 1]?.id === zone.id)
                  const overlap = prev && zone.min_km < prev.max_km
                  return (
                    <div key={zone.id} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '14px', marginBottom: 8, border: `1px solid ${overlap ? 'rgba(255,107,107,0.3)' : 'rgba(232,160,32,0.08)'}` }}>
                      <div style={{ display: 'grid', gridTemplateColumns: minOrderStrategy === 'per_zone' ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
                        <div>
                          <label style={labelStyle}>De (km)</label>
                          <input type="number" value={zone.min_km} onChange={e => updateZone(zone.id, 'min_km', parseFloat(e.target.value) || 0)} min="0" step="0.1" style={{ ...inputStyle, borderColor: (maxRadiusNum > 0 && zone.min_km >= maxRadiusNum) ? 'rgba(255,107,107,0.5)' : undefined }} />
                        </div>
                        <div>
                          <label style={labelStyle}>À (km)</label>
                          <input type="number" value={zone.max_km} onChange={e => updateZone(zone.id, 'max_km', parseFloat(e.target.value) || 0)} min="0" step="0.1" style={{ ...inputStyle, borderColor: (maxRadiusNum > 0 && zone.max_km > maxRadiusNum) ? 'rgba(255,107,107,0.5)' : undefined }} />
                        </div>
                        <div><label style={labelStyle}>Prix (DH)</label><input type="number" value={zone.price} onChange={e => updateZone(zone.id, 'price', parseFloat(e.target.value) || 0)} min="0" style={inputStyle} /></div>
                        {minOrderStrategy === 'per_zone' && <div><label style={labelStyle}>Min. commande (DH)</label><input type="number" value={zone.min_order} onChange={e => updateZone(zone.id, 'min_order', parseFloat(e.target.value) || 0)} min="0" style={inputStyle} /></div>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <button onClick={() => updateZone(zone.id, 'active', !zone.active)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                          <div style={{ width: 36, height: 20, borderRadius: 10, position: 'relative', background: zone.active ? 'linear-gradient(135deg,#F5C842,#FF6B20)' : 'rgba(255,255,255,0.08)', border: zone.active ? 'none' : '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
                            <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: zone.active ? 19 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                          </div>
                          <span style={{ fontSize: 12, color: zone.active ? '#F5C842' : '#8A7A60', fontFamily: 'DM Sans, sans-serif' }}>{zone.active ? 'Actif' : 'Inactif'}</span>
                        </button>
                        <button onClick={() => removeZone(zone.id)} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(255,107,107,0.25)', background: 'rgba(255,107,107,0.08)', color: '#FF6B6B', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Supprimer</button>
                      </div>
                      {overlap && <div style={{ marginTop: 8, fontSize: 11, color: '#FF6B6B' }}>⚠ Chevauchement avec la tranche précédente</div>}
                    </div>
                  )
                })}
              </div>
            )}
            {overlapErr && <div style={{ background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.25)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#FF6B6B', marginBottom: 10 }}>⚠ Des tranches se chevauchent — corrigez avant d'enregistrer.</div>}
            <button onClick={addZone} style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1.5px dashed rgba(232,160,32,0.3)', background: 'transparent', color: '#E8A020', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>+ Ajouter une tranche</button>
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Règles commerciales</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                {minOrderStrategy === 'global' ? (
                  <><label style={labelStyle}>Commande minimum pour livraison (DH)</label><input type="number" value={minOrder} onChange={e => setMinOrder(e.target.value)} min="0" style={inputStyle} /></>
                ) : (
                  <><div style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Commande minimum</div><div style={{ fontSize: 12, color: '#7A6E58', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(232,160,32,0.1)', background: 'rgba(255,255,255,0.02)' }}>Défini par tranche tarifaire</div></>
                )}
              </div>
              <div><label style={labelStyle}>Livraison gratuite à partir de (DH)</label><input type="number" value={freeAbove} onChange={e => setFreeAbove(e.target.value)} min="0" style={inputStyle} /><div style={{ fontSize: 11, color: '#8A7A60', marginTop: 5 }}>0 = désactivé</div></div>
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Messages personnalisables</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label style={labelStyle}>Message hors zone</label><textarea value={outOfZoneMessage} onChange={e => setOutOfZoneMessage(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' as const }} /></div>
              <div><label style={labelStyle}>Message retrait sur place</label><textarea value={pickupMessage} onChange={e => setPickupMessage(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' as const }} /></div>
            </div>
          </div>
        </>
      )}

      {/* SIMULATEUR */}
      {activeTab === 'simulateur' && (
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Simulateur de test</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <input value={simAddress} onChange={e => setSimAddress(e.target.value)} onKeyDown={e => e.key === 'Enter' && simulate()} placeholder="Ex : 12 rue Allal Ben Abdellah, Agadir" style={{ ...inputStyle, flex: 1 }} />
            <button onClick={simulate} disabled={simLoading} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', flexShrink: 0, background: 'linear-gradient(135deg,#F5C842,#FF6B20)', color: '#0A0804', fontSize: 12, fontWeight: 700, cursor: simLoading ? 'wait' : 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              {simLoading ? '...' : 'Tester'}
            </button>
          </div>
          {simResult && (
            <div style={{ background: simResult.error ? 'rgba(255,107,107,0.08)' : simResult.inZone ? 'rgba(91,197,122,0.08)' : 'rgba(255,107,107,0.08)', border: `1px solid ${simResult.error ? 'rgba(255,107,107,0.25)' : simResult.inZone ? 'rgba(91,197,122,0.25)' : 'rgba(255,107,107,0.25)'}`, borderRadius: 10, padding: '14px' }}>
              {simResult.error ? (
                <div style={{ fontSize: 13, color: '#FF6B6B' }}>{simResult.error}</div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 8 }}>
                    <div style={{ fontSize: 13 }}><span style={{ color: '#A89880' }}>Distance : </span><strong style={{ color: '#F5EDD6' }}>{simResult.dist?.toFixed(2)} km</strong></div>
                    <div style={{ fontSize: 13 }}><span style={{ color: '#A89880' }}>Zone : </span><strong style={{ color: simResult.inZone ? '#5BC57A' : '#FF6B6B' }}>{simResult.inZone ? 'Dans la zone ✓' : 'Hors zone ✗'}</strong></div>
                    {simResult.zone && <div style={{ fontSize: 13 }}><span style={{ color: '#A89880' }}>Tranche : </span><strong style={{ color: '#F5EDD6' }}>{simResult.zone.min_km}–{simResult.zone.max_km} km</strong></div>}
                    {simResult.zone && <div style={{ fontSize: 13 }}><span style={{ color: '#A89880' }}>Frais : </span><strong style={{ color: '#F5C842' }}>{simResult.fee} DH</strong></div>}
                  </div>
                  {(!simResult.inZone || simResult.noZone) && (
                    <div style={{ fontSize: 12, color: '#A89880', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                      {!simResult.inZone ? outOfZoneMessage : 'Adresse dans le rayon mais aucune tranche tarifaire ne correspond.'}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* BOUTON BAS FIXE */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '14px 20px', background: 'rgba(10,8,4,0.96)', borderTop: '1px solid rgba(232,160,32,0.1)', backdropFilter: 'blur(12px)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, zIndex: 40 }}>
        {saveError && <div style={{ fontSize: 12, color: '#FF6B6B' }}>{saveError}</div>}
        <button onClick={save} disabled={saving || overlapErr || hasZoneExceedingRadius} style={{ padding: '12px 40px', borderRadius: 12, border: 'none', background: saved ? 'rgba(91,197,122,0.15)' : (overlapErr || hasZoneExceedingRadius) ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#F5C842,#FF6B20)', color: saved ? '#5BC57A' : (overlapErr || hasZoneExceedingRadius) ? '#555' : '#0A0804', fontSize: 14, fontWeight: 700, cursor: (saving || overlapErr || hasZoneExceedingRadius) ? 'not-allowed' : 'pointer', minWidth: 220, fontFamily: 'DM Sans, sans-serif' }}>
          {saving ? 'Enregistrement...' : saved ? '✓ Enregistré' : 'Enregistrer la configuration'}
        </button>
      </div>
    </div>
  )
}

export default function LivraisonAdmin() {
  return (
    <Suspense fallback={<div style={{ color: '#C8B99A', padding: 40 }}>Chargement...</div>}>
      <LivraisonContent />
    </Suspense>
  )
}
