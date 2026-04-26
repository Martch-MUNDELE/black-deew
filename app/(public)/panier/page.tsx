'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCart } from '@/store/cart'
import { createClient } from '@/lib/supabase/client'
import FeaturesBar from '@/components/FeaturesBar'
import SlotPicker from '@/components/SlotPicker'
import PhoneInput from '@/components/PhoneInput'
import LeafletMap from '@/components/LeafletMap'
import type { Product } from '@/lib/types'

// ── Types ──────────────────────────────────────────────────────────────────────

interface DeliveryZone {
  id: string
  min_km: number
  max_km: number
  price: number
  min_order: number
  active: boolean
}

interface DeliverySettings {
  mode: 'all' | 'delivery_only' | 'pickup_only'
  shopLat: number | null
  shopLng: number | null
  shopAddress: string
  maxRadius: number
  tolerance: number
  minOrder: number
  freeAbove: number
  outOfZoneMessage: string
  pickupMessage: string
  minOrderStrategy: 'global' | 'per_zone'
}

interface DeliveryResult {
  mode: 'delivery' | 'pickup'
  fee: number
  distance: number | null
  zone: DeliveryZone | null
  inZone: boolean
  reason: 'ok' | 'pickup_only' | 'out_of_zone' | 'no_shop' | 'no_zones' | 'free'
}

// ── Haversine ─────────────────────────────────────────────────────────────────

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── calcDelivery ──────────────────────────────────────────────────────────────

function calcDelivery(
  clientLat: number,
  clientLng: number,
  settings: DeliverySettings,
  zones: DeliveryZone[],
  orderTotal: number
): DeliveryResult {
  if (!settings.shopLat || !settings.shopLng) {
    return { mode: 'delivery', fee: 0, distance: null, zone: null, inZone: true, reason: 'no_shop' }
  }
  if (settings.mode === 'pickup_only') {
    return { mode: 'pickup', fee: 0, distance: null, zone: null, inZone: true, reason: 'pickup_only' }
  }
  const distance = haversine(settings.shopLat, settings.shopLng, clientLat, clientLng)
  const maxR = settings.maxRadius + settings.tolerance
  if (distance > maxR) {
    return { mode: 'delivery', fee: 0, distance, zone: null, inZone: false, reason: 'out_of_zone' }
  }
  const activeZones = zones.filter(z => z.active).sort((a, b) => a.min_km - b.min_km)
  if (activeZones.length === 0) {
    return { mode: 'delivery', fee: 0, distance, zone: null, inZone: true, reason: 'no_zones' }
  }
  const matched = activeZones.find(z => distance >= z.min_km && distance < z.max_km + settings.tolerance)
  if (!matched) {
    return { mode: 'delivery', fee: 0, distance, zone: null, inZone: true, reason: 'no_zones' }
  }
  if (settings.freeAbove > 0 && orderTotal >= settings.freeAbove) {
    return { mode: 'delivery', fee: 0, distance, zone: matched, inZone: true, reason: 'free' }
  }
  return { mode: 'delivery', fee: matched.price, distance, zone: matched, inZone: true, reason: 'ok' }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PanierPage() {
  const { items, update, total, clear, add } = useCart()
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<'cart' | 'info' | 'slot'>('cart')
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [orderError, setOrderError] = useState('')

  // Delivery config loaded from Supabase
  const [deliverySettings, setDeliverySettings] = useState<DeliverySettings>({
    mode: 'all',
    shopLat: null,
    shopLng: null,
    shopAddress: '',
    maxRadius: 10,
    tolerance: 0.3,
    minOrder: 0,
    freeAbove: 0,
    outOfZoneMessage: 'Désolé, votre adresse est hors de notre zone de livraison.',
    pickupMessage: 'Venez récupérer votre commande directement à notre boutique.',
    minOrderStrategy: 'global',
  })
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([])
  const [deliveryLoaded, setDeliveryLoaded] = useState(false)
  const [suggestedProducts, setSuggestedProducts] = useState<Product[]>([])
  const wasAutoSwitchedRef = useRef(false)
  const initialCalcDoneRef = useRef(false)

  // Chosen delivery mode by user (when settings.mode === 'all')
  const [chosenMode, setChosenMode] = useState<'delivery' | 'pickup'>('delivery')

  // Delivery calculation result
  const [deliveryResult, setDeliveryResult] = useState<DeliveryResult | null>(null)

  const [form, setForm] = useState(() => {
    if (typeof window === 'undefined') return { name: '', phone: '', address: '', note: '', email: '', wantFacture: false, lat: null as number | null, lng: null as number | null, geo_address: '' }
    try {
      const saved = localStorage.getItem('aj_customer')
      if (saved) {
        const parsed = JSON.parse(saved)
        return { ...parsed, lat: parsed.lat || null, lng: parsed.lng || null, geo_address: parsed.geo_address || '' }
      }
    } catch {}
    return { name: '', phone: '', address: '', note: '', email: '', wantFacture: false, lat: null as number | null, lng: null as number | null, geo_address: '' }
  })
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState('')

  // ── Fetch delivery settings ────────────────────────────────────────────────

  useEffect(() => {
    async function loadDelivery() {
      const [{ data: settingsData }, { data: zonesData }] = await Promise.all([
        supabase.from('settings').select('key, value').like('key', 'delivery_%'),
        supabase.from('delivery_zones').select('*').eq('active', true).order('min_km', { ascending: true }),
      ])
      if (settingsData) {
        const map: Record<string, string> = {}
        settingsData.forEach((s: any) => { map[s.key] = s.value })
        setDeliverySettings({
          mode: (map.delivery_mode as any) || 'all',
          shopLat: map.delivery_shop_lat ? parseFloat(map.delivery_shop_lat) : null,
          shopLng: map.delivery_shop_lng ? parseFloat(map.delivery_shop_lng) : null,
          shopAddress: map.delivery_shop_address || '',
          maxRadius: parseFloat(map.delivery_max_radius) || 10,
          tolerance: parseFloat(map.delivery_tolerance) || 0.3,
          minOrder: parseFloat(map.delivery_min_order) || 0,
          freeAbove: parseFloat(map.delivery_free_above) || 0,
          outOfZoneMessage: map.delivery_out_of_zone_message || 'Désolé, votre adresse est hors de notre zone de livraison.',
          pickupMessage: map.delivery_pickup_message || 'Venez récupérer votre commande directement à notre boutique.',
          minOrderStrategy: (map.delivery_min_order_strategy as any) || 'global',
        })
        if (map.delivery_mode === 'pickup_only') setChosenMode('pickup')
        else if (map.delivery_mode === 'delivery_only') setChosenMode('delivery')
      }
      if (zonesData) setDeliveryZones(zonesData)
      setDeliveryLoaded(true)
    }
    loadDelivery()
  }, [])

  // ── Recompute delivery when lat/lng or mode changes ────────────────────────

  useEffect(() => {
    if (!deliveryLoaded) return
    if (chosenMode === 'pickup') {
      setDeliveryResult({ mode: 'pickup', fee: 0, distance: null, zone: null, inZone: true, reason: 'pickup_only' })
      return
    }
    if (form.lat && form.lng) {
      const result = calcDelivery(form.lat, form.lng, deliverySettings, deliveryZones, total())
      setDeliveryResult(result)
    } else {
      setDeliveryResult(null)
    }
  }, [form.lat, form.lng, chosenMode, deliveryLoaded, deliverySettings, deliveryZones])

  // ── Recalcul initial si position restaurée depuis localStorage ────────────

  useEffect(() => {
    if (initialCalcDoneRef.current) return
    if (form.lat && form.lng && deliveryLoaded && deliverySettings.shopLat) {
      initialCalcDoneRef.current = true
      const result = calcDelivery(form.lat, form.lng, deliverySettings, deliveryZones, total())
      setDeliveryResult(result)
    }
  }, [form.lat, form.lng, deliveryLoaded])

  // ── Min order ─────────────────────────────────────────────────────────────

  const subTotal = total()
  const isBelowMinOrder = deliverySettings.minOrder > 0 && subTotal < deliverySettings.minOrder && deliverySettings.mode !== 'pickup_only'
  const showSuggestions = deliverySettings.mode !== 'pickup_only' && (
    (deliverySettings.minOrder > 0 && subTotal < deliverySettings.minOrder) ||
    (deliverySettings.freeAbove > 0 && subTotal < deliverySettings.freeAbove)
  )

  useEffect(() => {
    if (!deliveryLoaded || deliverySettings.mode !== 'all') return
    if (isBelowMinOrder) {
      setChosenMode(prev => {
        if (prev === 'delivery') { wasAutoSwitchedRef.current = true; return 'pickup' }
        return prev
      })
    } else if (wasAutoSwitchedRef.current) {
      wasAutoSwitchedRef.current = false
      setChosenMode('delivery')
    }
  }, [isBelowMinOrder, deliveryLoaded, deliverySettings.mode])

  useEffect(() => {
    if (!showSuggestions) { setSuggestedProducts([]); return }
    const cartSubcategories = items.map(i => i.product.subcategory)
    const hasChaud = cartSubcategories.includes('chaudes')
    const hasFroid = cartSubcategories.includes('froides')
    const cartIds = items.map(i => i.product.id)
    supabase.from('products').select('*').eq('active', true).then(({ data }) => {
      if (!data) return
      const pool = data.filter((p: Product) => !cartIds.includes(p.id))
      const result: Product[] = []
      // 1. Un produit en promo
      const promo = pool.filter((p: Product) => (p.discount ?? 0) > 0)
      if (promo.length > 0) result.push(promo[Math.floor(Math.random() * promo.length)])
      // 2. Une boisson froide si pas dans le panier
      if (!hasFroid && result.length < 3) {
        const froides = pool.filter((p: Product) => p.subcategory === 'froides' && !result.find(r => r.id === p.id))
        if (froides.length > 0) result.push(froides[Math.floor(Math.random() * froides.length)])
      }
      // 3. Une boisson chaude si pas dans le panier
      if (!hasChaud && result.length < 3) {
        const chaudes = pool.filter((p: Product) => p.subcategory === 'chaudes' && !result.find(r => r.id === p.id))
        if (chaudes.length > 0) result.push(chaudes[Math.floor(Math.random() * chaudes.length)])
      }
      // 4. Compléter avec produits populaires
      if (result.length < 3) {
        const reste = pool.filter((p: Product) => !result.find(r => r.id === p.id)).sort((a: Product, b: Product) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0))
        result.push(...reste.slice(0, 3 - result.length))
      }
      setSuggestedProducts(result.slice(0, 3) as Product[])
    })
  }, [showSuggestions])

  // ── Form helpers ───────────────────────────────────────────────────────────

  const updateForm = (updater: (f: typeof form) => typeof form) => {
    setForm((prev: typeof form) => {
      const next = updater(prev)
      try { localStorage.setItem('aj_customer', JSON.stringify({ name: next.name, phone: next.phone, address: next.address, note: next.note, email: next.email, wantFacture: next.wantFacture, lat: next.lat, lng: next.lng, geo_address: next.geo_address })) } catch {}
      return next
    })
  }

  const localize = () => {
    if (!navigator.geolocation) { setGeoError('Géolocalisation non supportée'); return }
    setGeoLoading(true); setGeoError('')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=fr`, { headers: { 'User-Agent': 'AbouJoudia/1.0' } })
          const data = await res.json()
          updateForm(f => ({ ...f, lat, lng, address: data.display_name || '', geo_address: data.display_name || '' }))
        } catch { updateForm(f => ({ ...f, lat, lng })) }
        setGeoLoading(false)
      },
      (err) => {
        const msg = err.code === 1 ? 'Accès à la position refusé. Vous pouvez saisir votre adresse manuellement.' : 'Position introuvable. Veuillez saisir votre adresse manuellement.'
        setGeoError(msg)
        setGeoLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // Geocode address typed manually
  const geocodeAddress = async (addr: string) => {
    if (!addr.trim() || addr.length < 6) return
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr)}&format=json&limit=1&accept-language=fr`, { headers: { 'User-Agent': 'AbouJoudia/1.0' } })
      const data = await res.json()
      if (data && data.length > 0) {
        updateForm(f => ({ ...f, lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), geo_address: f.address }))
      }
    } catch {}
  }

  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleAddressChange = (val: string) => {
    updateForm(f => ({ ...f, address: val, lat: null, lng: null }))
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current)
    geocodeTimer.current = setTimeout(() => geocodeAddress(val), 1200)
  }

  // ── Order submission ───────────────────────────────────────────────────────

  const handleOrder = async () => {
    if (!selectedSlot || !form.name || !form.phone) return
    if (chosenMode === 'delivery' && !form.address) return
    setLoading(true)
    try {
      const isPickup = chosenMode === 'pickup'
      const fee = deliveryResult?.fee ?? 0
      const distance = deliveryResult?.distance ?? null
      const finalAddress = isPickup ? deliverySettings.shopAddress : form.address
      const finalLat = isPickup ? deliverySettings.shopLat : form.lat
      const finalLng = isPickup ? deliverySettings.shopLng : form.lng
      const finalGeoAddress = isPickup ? deliverySettings.shopAddress : form.geo_address

      const res = await fetch('/api/commandes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          address: finalAddress,
          lat: finalLat,
          lng: finalLng,
          geo_address: finalGeoAddress,
          slot_id: selectedSlot,
          items: items.map(i => ({ product_id: i.product.id, product_name: i.product.name, quantity: i.quantity, unit_price: i.product.price })),
          total: total() + fee,
          delivery_mode: chosenMode,
          delivery_fee: fee,
          distance_km: distance,
        })
      })
      const data = await res.json()
      if (data.error) { setOrderError(data.error); setLoading(false); return }
      if (data.id) { router.push(`/confirmation/${data.id}`) }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { if (items.length === 0) router.replace('/') }, [items.length, router])
  if (items.length === 0) return null

  // ── Derived values ─────────────────────────────────────────────────────────

  const isPickup = chosenMode === 'pickup'

  const step1LiveFeeResult = (() => {
    if (!deliveryLoaded || isPickup || !deliverySettings.shopLat || !form.lat || !form.lng) return null
    if (deliverySettings.freeAbove > 0 && subTotal >= deliverySettings.freeAbove) return 0
    const dist = haversine(deliverySettings.shopLat, deliverySettings.shopLng!, form.lat, form.lng)
    const activeZones = deliveryZones.filter(z => z.active).sort((a, b) => a.min_km - b.min_km)
    const matched = activeZones.find(z => dist >= z.min_km && dist < z.max_km + deliverySettings.tolerance)
    return matched?.price ?? null
  })()

  const step1FeeText = !deliveryLoaded
    ? '...'
    : isPickup
      ? 'Retrait'
      : !deliverySettings.shopLat || !form.lat || !form.lng
        ? "Calculé à l'étape suivante"
        : step1LiveFeeResult === null
          ? "Calculé à l'étape suivante"
          : step1LiveFeeResult === 0
            ? 'Gratuit'
            : `${step1LiveFeeResult} DH`

  const step1FeeColor = step1FeeText === 'Gratuit' || step1FeeText === 'Retrait' ? '#7DD87A' : '#C8B99A'

  const deliveryFee = isPickup ? 0 : step === 'cart' ? (step1LiveFeeResult ?? 0) : (deliveryResult?.fee ?? 0)
  const grandTotal = total() + deliveryFee
  const showModeSelector = deliverySettings.mode === 'all'
  const showAddressSection = !isPickup
  const canProceedFromInfo = !!(
    form.name &&
    form.phone &&
    (isPickup || (form.address && (!deliveryLoaded || !deliveryResult || deliveryResult.inZone))) &&
    !(isBelowMinOrder && !isPickup)
  )

  const stepIndex = ['cart', 'info', 'slot'].indexOf(step)
  const stepLabels = ['Panier', 'Infos', isPickup ? 'Horaire' : 'Horaire']
  const slotTitle = isPickup ? 'Quand récupérer ?' : 'Quand livrer ?'

  // ── Styles ─────────────────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '13px 16px', borderRadius: 12,
    border: '1.5px solid rgba(232,160,32,0.15)',
    background: 'rgba(255,255,255,0.03)', color: '#F5EDD6',
    fontFamily: 'DM Sans, sans-serif', fontSize: 14, outline: 'none',
    boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700, color: '#C8B99A',
    textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8,
  }

  const giftIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
      <path d="M20 12v10H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/>
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
    </svg>
  )

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', paddingBottom: 100 }}>

      {/* HEADER */}
      <div style={{ padding: '24px 20px 20px' }}>
        <h1 style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 24, fontWeight: 800, color: '#F5EDD6', margin: '0 0 20px', letterSpacing: '-0.5px' }}>
          {step === 'cart' ? 'Mon panier' : step === 'info' ? 'Vos informations' : slotTitle}
        </h1>

        {/* STEPPER */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {stepLabels.map((label, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 'none' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: stepIndex >= i ? 'linear-gradient(135deg,#F5C842,#FF6B20)' : 'rgba(255,255,255,0.05)', border: stepIndex >= i ? 'none' : '1.5px solid rgba(232,160,32,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: stepIndex >= i ? '#0A0804' : '#C8B99A', transition: 'all 0.3s', fontFamily: 'DM Sans, sans-serif' }}>
                  {stepIndex > i ? '✓' : i + 1}
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: stepIndex >= i ? '#E8A020' : '#C8B99A', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>{label}</div>
              </div>
              {i < 2 && <div style={{ flex: 1, height: 1.5, background: stepIndex > i ? 'linear-gradient(90deg,#F5C842,#FF6B20)' : 'rgba(232,160,32,0.1)', margin: '0 6px 16px', transition: 'background 0.3s', borderRadius: 2 }} />}
            </div>
          ))}
        </div>
      </div>

      {/* ══ STEP 1 — PANIER ══ */}
      {step === 'cart' && (
        <div style={{ padding: '0 20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {items.map((item) => (
              <div key={item.product.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '13px 0', borderBottom: '1px solid rgba(232,160,32,0.06)' }}>
                <div style={{ width: 'clamp(44px,12vw,56px)', height: 'clamp(44px,12vw,56px)', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '2px solid rgba(232,160,32,0.15)' }}>
                  <img src={item.product.image_url} alt={item.product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#F5EDD6', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product.name}</div>
                  <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 14, color: '#F5C842' }}>{(item.product.price * item.quantity).toFixed(2)} DH</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: 'rgba(255,255,255,0.04)', borderRadius: 50, border: '1px solid rgba(232,160,32,0.15)', flexShrink: 0 }}>
                  <button onClick={() => update(item.product.id, item.quantity - 1)} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'transparent', color: item.quantity === 1 ? '#FF6B6B' : '#C8B890', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 500, lineHeight: 1 }}>
                    {item.quantity === 1 ? '×' : '−'}
                  </button>
                  <span style={{ fontWeight: 800, fontSize: 14, color: '#F5EDD6', minWidth: 20, textAlign: 'center', fontFamily: 'DM Sans, sans-serif' }}>{item.quantity}</span>
                  <button onClick={() => update(item.product.id, item.quantity + 1)} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg,#F5C842,#FF6B20)', color: '#0A0804', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, lineHeight: 1 }}>+</button>
                </div>
              </div>
            ))}
          </div>

          {/* Récapitulatif livraison dans le panier */}
          <div style={{ marginTop: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid rgba(232,160,32,0.06)', fontSize: 13, color: '#C8B99A' }}>
              <span>Sous-total produits</span>
              <span style={{ color: '#F5EDD6', fontWeight: 600 }}>{total().toFixed(2)} DH</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid rgba(232,160,32,0.06)', fontSize: 13, color: '#C8B99A' }}>
              <span>Frais de livraison</span>
              <span style={{ color: step1FeeColor, fontWeight: 600 }}>{step1FeeText}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 0', fontSize: 15, fontWeight: 800, fontFamily: 'DM Sans, sans-serif' }}>
              <span style={{ color: '#C8B99A' }}>Total</span>
              <span style={{ color: '#F5C842' }}>{grandTotal.toFixed(2)} DH</span>
            </div>
          </div>

          {/* Badge livraison gratuite */}
          {deliverySettings.freeAbove > 0 && deliverySettings.mode !== 'pickup_only' && subTotal < deliverySettings.minOrder && subTotal < deliverySettings.freeAbove && (
            <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(91,197,122,0.06)', border: '1px solid rgba(91,197,122,0.2)', fontSize: 12, color: '#5BC57A', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {giftIcon} Livraison offerte dès {deliverySettings.freeAbove} DH
            </div>
          )}

          {/* Message minimum commande */}
          {deliverySettings.minOrder > 0 && subTotal < deliverySettings.minOrder && deliverySettings.mode !== 'pickup_only' && (
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,107,32,0.06)', border: '1px solid rgba(255,107,32,0.25)', fontSize: 13, color: '#F5A020', lineHeight: 1.5 }}>
              Livraison disponible à partir de {deliverySettings.minOrder} DH — il vous manque {Math.ceil(deliverySettings.minOrder - subTotal)} DH
            </div>
          )}

          {/* Message livraison gratuite */}
          {deliverySettings.freeAbove > 0 && subTotal >= deliverySettings.minOrder && subTotal < deliverySettings.freeAbove && deliverySettings.mode !== 'pickup_only' && (
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(91,197,122,0.06)', border: '1px solid rgba(91,197,122,0.25)', fontSize: 13, color: '#5BC57A', lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 8 }}>
              {giftIcon} Livraison gratuite à partir de {deliverySettings.freeAbove} DH — Ajoutez {Math.ceil(deliverySettings.freeAbove - subTotal)} DH de plus !
            </div>
          )}

          {/* Complète ta commande */}
          {showSuggestions && suggestedProducts.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#F5C842', marginBottom: 8 }}>Complète ta commande</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                {suggestedProducts.map(p => (
                  <div key={p.id} style={{ minWidth: 0, overflow: 'hidden', borderRadius: 12, display: 'flex', flexDirection: 'column', background: 'rgba(245,200,66,0.05)', border: '1px solid rgba(245,200,66,0.1)' }}>
                    <img src={p.image_url} alt={p.name} style={{ width: '100%', height: 90, objectFit: 'cover' }} loading="lazy" />
                    <div style={{ flex: 1, padding: '8px 10px 4px', fontSize: 10, color: '#F5EDD6', fontWeight: 600, lineHeight: 1.3, wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 10px 10px', marginTop: 'auto' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
                        {(p.discount ?? 0) > 0 && <span style={{ fontSize: 9, color: '#7A6E58', textDecoration: 'line-through', fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}>{p.price.toFixed(2)}</span>}
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#F5C842', fontFamily: 'Playfair Display, serif' }}>{(p.discount ?? 0) > 0 ? (p.price * (1 - (p.discount ?? 0) / 100)).toFixed(2) : p.price.toFixed(2)} DH</span>
                      </div>
                      <button type="button" onClick={() => add(p)} style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#F5C842,#FF6B20)', border: 'none', color: '#0A0804', fontSize: 18, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ STEP 2 — INFOS ══ */}
      {step === 'info' && (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Sélecteur mode livraison/retrait */}
          {showModeSelector && (
            <div>
              <label style={labelStyle}>Mode de commande</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => { if (!isBelowMinOrder) setChosenMode('delivery') }}
                  style={{ flex: 1, padding: '13px 16px', borderRadius: 12, border: isBelowMinOrder ? '2px solid rgba(200,185,154,0.25)' : `2px solid ${chosenMode === 'delivery' ? '#F5C842' : 'rgba(232,160,32,0.15)'}`, background: isBelowMinOrder ? 'rgba(255,255,255,0.01)' : chosenMode === 'delivery' ? 'rgba(245,200,66,0.08)' : 'rgba(255,255,255,0.02)', color: isBelowMinOrder ? 'rgba(200,185,154,0.4)' : chosenMode === 'delivery' ? '#F5C842' : '#C8B99A', fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 700, cursor: isBelowMinOrder ? 'not-allowed' : 'pointer', opacity: isBelowMinOrder ? 0.5 : 1, transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <span style={{ fontSize: 16 }}>🛵</span> Livraison
                </button>
                <button
                  type="button"
                  onClick={() => setChosenMode('pickup')}
                  style={{ flex: 1, padding: '13px 16px', borderRadius: 12, border: `2px solid ${chosenMode === 'pickup' ? '#F5C842' : 'rgba(232,160,32,0.15)'}`, background: chosenMode === 'pickup' ? 'rgba(245,200,66,0.08)' : 'rgba(255,255,255,0.02)', color: chosenMode === 'pickup' ? '#F5C842' : '#C8B99A', fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <span style={{ fontSize: 16 }}>🏪</span> Retrait sur place
                </button>
              </div>

            </div>
          )}

          {/* Nom */}
          <div>
            <label style={labelStyle}>Nom complet <span style={{ color: '#FF6B20' }}>*</span></label>
            <input type="text" placeholder="Mohamed Amine..." value={form.name} onChange={e => updateForm(f => ({ ...f, name: e.target.value }))} style={{ ...inputStyle, border: `1.5px solid ${form.name ? 'rgba(232,160,32,0.4)' : 'rgba(232,160,32,0.15)'}` }} />
          </div>

          {/* Téléphone */}
          <div>
            <label style={labelStyle}>Téléphone <span style={{ color: '#FF6B20' }}>*</span></label>
            <div style={{ position: 'relative', zIndex: 500 }}>
              <PhoneInput value={form.phone} initialValue={form.phone} onChange={v => updateForm(f => ({ ...f, phone: v }))} />
            </div>
          </div>

          {/* Section adresse — visible seulement en mode livraison */}
          {showAddressSection ? (
            <div>
              <label style={labelStyle}>Adresse de livraison <span style={{ color: '#FF6B20' }}>*</span></label>
              <button type="button" onClick={localize} disabled={geoLoading} style={{ width: '100%', padding: '13px 16px', borderRadius: 12, border: '1.5px dashed rgba(232,160,32,0.3)', background: form.lat ? 'rgba(125,216,122,0.06)' : 'rgba(232,160,32,0.04)', color: form.lat ? '#7DD87A' : '#E8A020', cursor: geoLoading ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600, textAlign: 'center', marginBottom: 10, fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }}>
                {geoLoading ? 'Localisation...' : form.lat ? '✓ Position détectée' : 'Me localiser automatiquement'}
              </button>
              {geoError && <div style={{ fontSize: 12, color: '#FF6B6B', marginBottom: 8 }}>{geoError}</div>}

              {form.lat && form.lng && (
                <div style={{ marginBottom: 10 }}>
                  <LeafletMap
                    lat={form.lat}
                    lng={form.lng}
                    onPositionChange={(newLat, newLng, addr) => {
                      updateForm(f => ({ ...f, lat: newLat, lng: newLng, address: addr || f.address, geo_address: addr }))
                    }}
                  />
                </div>
              )}

              <textarea
                placeholder="Ou saisissez votre adresse..."
                value={form.address}
                onChange={e => handleAddressChange(e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: 'none', lineHeight: 1.6, fontSize: 13 }}
              />

              {/* Résultat calcul livraison */}
              {deliveryLoaded && form.address && deliveryResult && (
                <div style={{ marginTop: 10, borderRadius: 12, border: `1px solid ${deliveryResult.inZone ? 'rgba(91,197,122,0.3)' : 'rgba(255,107,107,0.3)'}`, background: deliveryResult.inZone ? 'rgba(91,197,122,0.05)' : 'rgba(255,107,107,0.05)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {form.lat && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#A89880' }}>Adresse retenue</span>
                      <span style={{ fontSize: 12, color: '#F5EDD6', maxWidth: '60%', textAlign: 'right', lineHeight: 1.4 }}>{form.address}</span>
                    </div>
                  )}
                  {deliveryResult.distance !== null && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#A89880' }}>Distance</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#F5EDD6' }}>{deliveryResult.distance.toFixed(2)} km</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#A89880' }}>Frais de livraison</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: deliveryResult.fee === 0 ? '#7DD87A' : '#F5C842' }}>
                      {deliveryResult.fee === 0 ? 'Gratuit' : `${deliveryResult.fee} DH`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#A89880' }}>Zone</span>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: deliveryResult.inZone ? 'rgba(91,197,122,0.15)' : 'rgba(255,107,107,0.15)', color: deliveryResult.inZone ? '#5BC57A' : '#FF6B6B' }}>
                      {deliveryResult.inZone ? 'Dans la zone ✓' : 'Hors zone ✗'}
                    </span>
                  </div>
                  {!deliveryResult.inZone && (
                    <div style={{ marginTop: 4, padding: '10px 12px', borderRadius: 8, background: 'rgba(255,107,107,0.08)', fontSize: 12, color: '#FF6B6B', lineHeight: 1.5 }}>
                      {deliverySettings.outOfZoneMessage}
                      <div style={{ marginTop: 4, fontSize: 11, color: '#C8B99A', fontStyle: 'italic' }}>
                        Votre position a peut-être changé depuis votre dernière commande.
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                        <button type="button" onClick={() => {
                          setGeoLoading(true)
                          setGeoError('')
                          navigator.geolocation.getCurrentPosition(
                            async pos => {
                              const { latitude: lat, longitude: lng } = pos.coords
                              const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
                              const data = await res.json()
                              updateForm(f => ({ ...f, lat, lng, address: data.display_name || '', geo_address: data.display_name || '' }))
                              setGeoLoading(false)
                            },
                            () => { setGeoError('Géolocalisation refusée.'); setGeoLoading(false) }
                          )
                        }} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(91,197,122,0.3)', background: 'rgba(91,197,122,0.08)', color: '#5BC57A', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                          Utiliser ma position actuelle
                        </button>
                        <button type="button" onClick={() => updateForm(f => ({ ...f, address: '', lat: null, lng: null, geo_address: '' }))} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(232,160,32,0.3)', background: 'transparent', color: '#E8A020', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                          Modifier mon adresse
                        </button>
                        {deliverySettings.mode === 'all' && (
                          <button type="button" onClick={() => setChosenMode('pickup')} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(255,107,107,0.3)', background: 'transparent', color: '#FF6B6B', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                            Passer en retrait sur place
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Mode retrait */
            <div style={{ borderRadius: 12, border: '1px solid rgba(232,160,32,0.2)', background: 'rgba(232,160,32,0.04)', padding: '16px' }}>
              <div style={{ fontSize: 13, color: '#C8B890', lineHeight: 1.6, marginBottom: 10 }}>{deliverySettings.pickupMessage}</div>
              {deliverySettings.shopAddress && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>📍</span>
                  <div style={{ fontSize: 13, color: '#F5EDD6', lineHeight: 1.5 }}>{deliverySettings.shopAddress}</div>
                </div>
              )}
              <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(125,216,122,0.08)', border: '1px solid rgba(125,216,122,0.2)', fontSize: 12, color: '#7DD87A', fontWeight: 600 }}>
                Frais de livraison : Gratuit (retrait)
              </div>
            </div>
          )}

          {/* Note */}
          <div>
            <label style={labelStyle}>Note (optionnel)</label>
            <input type="text" placeholder="Étage, sonnette, instructions..." value={form.note} onChange={e => updateForm(f => ({ ...f, note: e.target.value }))} style={inputStyle} />
          </div>

          {/* Facturette */}
          <div style={{ background: 'rgba(232,160,32,0.04)', border: '1px solid rgba(232,160,32,0.12)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => updateForm(f => ({ ...f, wantFacture: !f.wantFacture }))}>
              <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${form.wantFacture ? '#F5C842' : 'rgba(232,160,32,0.3)'}`, background: form.wantFacture ? 'linear-gradient(135deg,#F5C842,#FF6B20)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
                {form.wantFacture && <span style={{ fontSize: 11, color: '#0A0804', fontWeight: 800 }}>✓</span>}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#C8B890' }}>Recevoir une facturette PDF</div>
                <div style={{ fontSize: 11, color: '#C8B99A', marginTop: 2 }}>Envoyée par email après commande</div>
              </div>
            </div>
            {form.wantFacture && (
              <input type="email" placeholder="votre@email.com" value={form.email} onChange={e => updateForm(f => ({ ...f, email: e.target.value }))} style={{ width: '100%', marginTop: 12, padding: '11px 14px', borderRadius: 10, border: '1.5px solid rgba(232,160,32,0.2)', background: 'rgba(255,255,255,0.03)', color: '#F5EDD6', fontFamily: 'DM Sans, sans-serif', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            )}
          </div>
        </div>
      )}

      {/* ══ STEP 3 — CRÉNEAU ══ */}
      {step === 'slot' && (
        <div style={{ padding: '0 20px' }}>
          <SlotPicker onSelect={setSelectedSlot} />
          {orderError && (
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', fontSize: 13, color: '#FF6B6B' }}>{orderError}</div>
          )}

          {/* Récap livraison en step 3 */}
          <div style={{ marginTop: 20, borderRadius: 12, border: '1px solid rgba(232,160,32,0.12)', background: 'rgba(255,255,255,0.02)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#C8B99A' }}>
              <span>Sous-total</span>
              <span style={{ color: '#F5EDD6', fontWeight: 600 }}>{total().toFixed(2)} DH</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#C8B99A' }}>
              <span>{isPickup ? 'Retrait sur place' : 'Frais de livraison'}</span>
              <span style={{ color: '#7DD87A', fontWeight: 600 }}>{isPickup ? 'Gratuit' : deliveryFee === 0 ? 'Gratuit' : `${deliveryFee} DH`}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 800, borderTop: '1px solid rgba(232,160,32,0.1)', paddingTop: 10, fontFamily: 'DM Sans, sans-serif' }}>
              <span style={{ color: '#C8B99A' }}>Total</span>
              <span style={{ color: '#F5C842' }}>{grandTotal.toFixed(2)} DH</span>
            </div>
          </div>

          <p style={{ textAlign: 'center', color: '#C8B99A', fontSize: 11, marginTop: 16, letterSpacing: '0.3px' }}>Paiement en cash à la {isPickup ? 'récupération' : 'livraison'} uniquement</p>
        </div>
      )}

      {step === 'cart' && !showSuggestions && <FeaturesBar alwaysShow />}

      {/* ══ BARRE STICKY BAS ══ */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(8,6,3,0.97)', backdropFilter: 'blur(20px)', padding: '16px 20px', zIndex: 40 }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          {step === 'cart' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: '#C8B99A', fontWeight: 500 }}>{items.reduce((acc, i) => acc + i.quantity, 0)} article{items.reduce((acc, i) => acc + i.quantity, 0) > 1 ? 's' : ''}</span>
              <span style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: 22, color: '#F5C842', letterSpacing: '-0.5px' }}>{grandTotal.toFixed(2)} DH</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            {step !== 'cart' && (
              <button onClick={() => setStep(step === 'slot' ? 'info' : 'cart')} style={{ padding: '14px 20px', borderRadius: 50, border: '1.5px solid rgba(232,160,32,0.2)', background: 'transparent', color: '#C8B890', fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', flexShrink: 0 }}>
                ← Retour
              </button>
            )}
            <button
              onClick={() => {
                if (step === 'cart') setStep('info')
                else if (step === 'info') setStep('slot')
                else handleOrder()
              }}
              disabled={
                (step === 'info' && !canProceedFromInfo) ||
                (step === 'slot' && (!selectedSlot || loading))
              }
              style={{ flex: 1, padding: '15px 20px', borderRadius: 50, border: 'none', background: 'linear-gradient(135deg,#F5C842,#FF6B20)', color: '#0A0804', fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: '0 4px 20px rgba(232,160,32,0.3)', transition: 'all 0.2s', opacity: (step === 'info' && !canProceedFromInfo) || (step === 'slot' && !selectedSlot) ? 0.4 : 1 }}
            >
              {step === 'cart' ? 'Continuer' : step === 'info' ? (isPickup ? 'Quand récupérer ?' : 'Quand livrer ?') : loading ? 'Envoi...' : 'Commander'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
