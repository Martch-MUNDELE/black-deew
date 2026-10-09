import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendOrderNotification } from '@/lib/notifications'
import { loadVipSettings, phonesMatch } from '@/lib/vip-server'
import { readVipSessionPhone } from '@/lib/vip-session'

type CommandeItemInput = {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  isVip?: boolean
  selected_variants?: unknown
  variant_price_extra?: number
  variant_name?: string | null
  variant_price?: number | null
}

type CommandeRequestBody = {
  name?: string
  phone?: string
  address?: string
  note?: string | null
  slot_id?: string
  items?: CommandeItemInput[]
  lat?: number | null
  lng?: number | null
  geo_address?: string | null
  email?: string | null
  wantFacture?: boolean
  delivery_mode?: string | null
  delivery_fee?: number | null
  distance_km?: number | null
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function getRequestBaseUrl(req: Request) {
  const forwardedProto = req.headers.get('x-forwarded-proto')
  const forwardedHost = req.headers.get('x-forwarded-host')
  if (forwardedHost) return `${forwardedProto || 'https'}://${forwardedHost}`
  return new URL(req.url).origin
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CommandeRequestBody

  const { data: shopStatus } = await supabase.from('settings').select('value').eq('key', 'status').single()
  if (shopStatus?.value === 'closed') {
    return NextResponse.json({ error: 'Le shop est actuellement fermé' }, { status: 403 })
  }
  const { data: currencyRow } = await supabase.from('settings').select('value').eq('key', 'currency').single()
  const currency = currencyRow?.value || 'USD'
  const { data: siteNameRow } = await supabase.from('settings').select('value').eq('key', 'site_name').single()
  const siteName = siteNameRow?.value || 'Black Deew'
  const { data: adminEmailRow } = await supabase.from('settings').select('value').eq('key', 'notification_email').single()
  const adminEmail = adminEmailRow?.value || undefined
  const { name, phone, address, note, slot_id, lat, lng, geo_address, email, wantFacture, delivery_mode } = body
  const rawItems = Array.isArray(body.items) ? body.items : []
  if (!name || !String(name).trim() || !phone || !String(phone).trim() || rawItems.length === 0) {
    return NextResponse.json({ error: 'Commande incomplète : nom, téléphone et articles requis' }, { status: 400 })
  }
  if (rawItems.some((i) => !i || typeof i.product_id !== 'string' || !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 99)) {
    return NextResponse.json({ error: 'Articles invalides' }, { status: 400 })
  }
  // A15 : prix recalcules cote serveur depuis la base, jamais depuis le client
  const productIds = Array.from(new Set(rawItems.map((i) => i.product_id)))
  const { data: dbProducts, error: productsError } = await supabase
    .from('products')
    .select('id, name, price, discount, variants, is_vip, active')
    .in('id', productIds)
  if (productsError || !dbProducts) {
    return NextResponse.json({ error: 'Erreur lecture produits' }, { status: 500 })
  }
  const productById = new Map<string, { id: string; name: string; price: number; discount: number | null; variants: { type: string; prices?: Record<string, number> }[] | null; is_vip: boolean | null; active: boolean | null }>(
    dbProducts.map((p) => [p.id as string, p as never])
  )
  const items: CommandeItemInput[] = []
  for (const raw of rawItems) {
    const prod = productById.get(raw.product_id)
    if (!prod || prod.active === false) {
      return NextResponse.json({ error: `Produit indisponible : ${raw.product_name ?? raw.product_id}` }, { status: 400 })
    }
    const selected = (raw.selected_variants && typeof raw.selected_variants === 'object')
      ? (raw.selected_variants as Record<string, string>)
      : null
    let variantExtra = 0
    if (selected && Array.isArray(prod.variants)) {
      for (const vt of prod.variants) {
        const chosen = selected[vt.type]
        if (chosen && vt.prices && vt.prices[chosen] !== undefined) variantExtra += Number(vt.prices[chosen]) || 0
      }
    }
    const basePrice = (prod.discount ?? 0) > 0
      ? Math.ceil(prod.price * (1 - (prod.discount ?? 0) / 100))
      : prod.price
    items.push({
      ...raw,
      product_name: prod.name,
      unit_price: Math.ceil(basePrice + variantExtra),
      variant_price_extra: variantExtra,
      variant_price: variantExtra > 0 ? variantExtra : null,
      isVip: prod.is_vip === true,
    })
  }
  // A4 : controle VIP cote serveur, base sur products.is_vip et sur le numero du cookie de session signee (jamais le numero declare dans le corps)
  const vipItems = items.filter((i) => i.isVip)
  if (vipItems.length > 0) {
    const sessionPhone = readVipSessionPhone(req)
    if (!sessionPhone) {
      return NextResponse.json({ error: 'Cette commande contient des articles VIP : veuillez vous reconnecter à l’espace VIP (session expirée ou absente) puis réessayer.' }, { status: 401 })
    }
    const vipSettings = await loadVipSettings(supabase)
    if (!vipSettings) {
      return NextResponse.json({ error: 'Vérification VIP indisponible. Réessayez dans quelques instants.' }, { status: 500 })
    }
    const authorized = vipSettings.enabled && vipSettings.allowedPhones.length > 0 && phonesMatch(sessionPhone, vipSettings.allowedPhones)
    if (!authorized) {
      return NextResponse.json({ error: 'Cette commande contient des articles VIP : votre accès VIP n’est plus autorisé. Reconnectez-vous ou contactez la boutique.' }, { status: 403 })
    }
  }
  const vipTotal = vipItems.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  // A15 : frais de livraison recalcules cote serveur (meme logique que le panier : retrait, zones, distance, gratuite au-dessus d'un seuil)
  const { data: deliverySettingRows } = await supabase.from('settings').select('key, value').like('key', 'delivery_%')
  const dset: Record<string, string> = {}
  for (const r of deliverySettingRows ?? []) dset[r.key as string] = (r.value as string | null) ?? ''
  const dMode = ['all', 'delivery_only', 'pickup_only'].includes(dset.delivery_mode) ? dset.delivery_mode : 'all'
  const shopLat = dset.delivery_shop_lat ? parseFloat(dset.delivery_shop_lat) : null
  const shopLng = dset.delivery_shop_lng ? parseFloat(dset.delivery_shop_lng) : null
  const maxRadius = parseFloat(dset.delivery_max_radius) || 10
  const tolerance = parseFloat(dset.delivery_tolerance) || 0.3
  const freeAbove = parseFloat(dset.delivery_free_above) || 0
  const itemsSubtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  let safeDeliveryFee = 0
  let serverDistanceKm: number | null = null
  const isPickup = delivery_mode === 'pickup' && dMode !== 'delivery_only'
  if (!isPickup && dMode !== 'pickup_only' && shopLat && shopLng) {
    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: 'Adresse de livraison géolocalisée requise' }, { status: 400 })
    }
    const distance = haversine(shopLat, shopLng, lat, lng)
    serverDistanceKm = distance
    if (distance > maxRadius + tolerance) {
      return NextResponse.json({ error: 'Adresse hors de la zone de livraison' }, { status: 400 })
    }
    const { data: zoneRows } = await supabase.from('delivery_zones').select('min_km, max_km, price, active').eq('active', true).order('min_km', { ascending: true })
    const matched = (zoneRows ?? []).find((z) => distance >= Number(z.min_km) && distance < Number(z.max_km) + tolerance)
    if (matched && !(freeAbove > 0 && itemsSubtotal >= freeAbove)) safeDeliveryFee = Number(matched.price) || 0
  }

  const { data: slot } = await supabase.from('delivery_slots').select('*').eq('id', slot_id).single()
  if (!slot || slot.blocked || slot.booked >= slot.capacity) {
    return NextResponse.json({ error: 'Créneau non disponible' }, { status: 400 })
  }

  // Verification stock si module actif
  const { data: stockEnabledRow } = await supabase.from('settings').select('value').eq('key', 'stock_enabled').single()
  if (stockEnabledRow?.value === 'true') {
    for (const item of items) {
      const { data: prod } = await supabase.from('products').select('stock').eq('id', item.product_id).single()
      if (prod && prod.stock !== null) {
        if (prod.stock <= 0) {
          return NextResponse.json({ error: `${item.product_name} est epuise` }, { status: 409 })
        }
        if (prod.stock < item.quantity) {
          return NextResponse.json({ error: `Stock insuffisant pour ${item.product_name} (${prod.stock} disponible(s))`, stock: prod.stock }, { status: 409 })
        }
      }
    }
  }

  const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
  const calculatedTotal = subtotal + safeDeliveryFee

  const today = new Date().toISOString().split('T')[0]
  const dateKey = today.replace(/-/g, '')
  const { data: seqData, error: seqError } = await supabase.rpc('get_next_invoice_seq', { p_date_key: dateKey })
  if (seqError || seqData == null) {
    return NextResponse.json({ error: 'Erreur generation numero de commande' }, { status: 500 })
  }
  const seqNum = String(seqData).padStart(4, '0')
  const invoice_number = `BD-${dateKey}-${seqNum}`

  const { data: order, error } = await supabase.from('orders').insert({
    customer_name: name, customer_phone: phone, customer_address: address,
    customer_note: note, slot_id, total: calculatedTotal, payment_method: 'livraison', status: 'nouvelle',
    lat: lat || null, lng: lng || null, geo_address: geo_address || null,
    customer_email: (wantFacture && email) ? email : null,
    delivery_mode: delivery_mode || null, delivery_fee: safeDeliveryFee, distance_km: serverDistanceKm,
    invoice_number,
  }).select().single()

  if (error || !order) { return NextResponse.json({ error: 'Erreur création commande' }, { status: 500 }) }

  // BF-P2-013 : tracking connexion - commande classique
  supabase.from('platform_connexions').insert({
    type: 'classique_commande',
    client_phone: phone || null,
    shop_id: null,
  }).then(() => {}, () => {})

  // BF-P2-013 : point de depart du funnel statuts
  supabase.from('order_status_history').insert({
    order_id: order.id,
    from_status: null,
    to_status: 'nouvelle',
  }).then(() => {}, () => {})

  const { error: itemsError } = await supabase.from('order_items').insert(items.map((item) => ({ order_id: order.id, product_id: item.product_id, product_name: item.product_name, quantity: item.quantity, unit_price: item.unit_price, is_vip: item.isVip ?? false, selected_variants: item.selected_variants ?? null, variant_price_extra: item.variant_price_extra ?? 0, variant_name: item.variant_name ?? null, variant_price: item.variant_price ?? null })))
  if (itemsError) {
    // A15 : ne jamais laisser une commande sans lignes
    await supabase.from('orders').delete().eq('id', order.id)
    return NextResponse.json({ error: 'Erreur enregistrement des articles de la commande' }, { status: 500 })
  }
  await supabase.from('delivery_slots').update({ booked: slot.booked + 1 }).eq('id', slot_id)

  // Decrementation stock si module actif
  if (stockEnabledRow?.value === 'true') {
    for (const item of items) {
      await supabase.rpc('decrement_stock', { product_id: item.product_id, qty: item.quantity })
    }
  }
  await sendOrderNotification({ ...order, items, slot, vipItems, vipTotal }, currency, siteName, adminEmail)

  // Push notification PWA
  try {
    const hasVip = items.some((i: CommandeItemInput) => i.isVip)
    await fetch(`${getRequestBaseUrl(req)}/api/push/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: hasVip ? '⭐ Nouvelle commande VIP !' : '🛒 Nouvelle commande !',
        body: `${body.name || 'Client'} — ${items.length} article(s)`,
        tag: 'nouvelle-commande',
        url: '/admin/commandes'
      })
    })
  } catch (e) { console.error('[Push commande]', e) }

  if (wantFacture && email) {
    try {
      await fetch(`${getRequestBaseUrl(req)}/api/facture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: order.id, excludeVip: true })
      })
    } catch (e) { console.error('Facture error:', e) }
  }

  return NextResponse.json(order)
}
