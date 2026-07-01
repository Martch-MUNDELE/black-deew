/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import { useEffect, useRef } from 'react'

type DeliveryPoint = {
  phone: string
  customerName: string
  lat: number
  lng: number
  commandes: number
  total: number
  typeClient: 'classique' | 'vip' | 'mixte'
}

type StatsDeliveryMapProps = {
  points: DeliveryPoint[]
  currency: string
  shopLat?: number
  shopLng?: number
  height?: number
}

const TYPE_COLORS: Record<string, string> = {
  classique: '#F5C842',
  vip: '#FF6EB4',
  mixte: '#A078FF',
}

let leafletLoadPromise: Promise<void> | null = null
function loadLeaflet(): Promise<void> {
  if (leafletLoadPromise) return leafletLoadPromise
  leafletLoadPromise = new Promise<void>((resolve) => {
    if ((window as any).L) { resolve(); return }
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => resolve()
    document.head.appendChild(script)
  })
  return leafletLoadPromise
}

export default function StatsDeliveryMap({ points, currency, shopLat, shopLng, height = 320 }: StatsDeliveryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const mapId = useRef('')

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return
    if (!mapId.current) mapId.current = `stats-map-${Math.random().toString(36).slice(2, 8)}`
    let cancelled = false

    loadLeaflet().then(() => {
      if (cancelled || !containerRef.current) return
      const L = (window as any).L

      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }

      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const centerLat = shopLat ?? (points[0]?.lat ?? 0)
      const centerLng = shopLng ?? (points[0]?.lng ?? 0)
      const map = L.map(containerRef.current).setView([centerLat, centerLng], 12)
      mapRef.current = map
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(map)

      if (shopLat != null && shopLng != null) {
        const houseSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 11L12 3L21 11" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 9.5V20H18.5V9.5" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><rect x="10" y="13" width="4" height="7" fill="white"/></svg>'
        const shopIcon = L.divIcon({
          className: '',
          html: `<div style="width:26px;height:26px;border-radius:50%;background:#2a78d6;border:2px solid white;display:flex;align-items:center;justify-content:center;">${houseSvg}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        })
        L.marker([shopLat, shopLng], { icon: shopIcon }).addTo(map).bindPopup('Boutique')
      }

      points.forEach(p => {
        const color = TYPE_COLORS[p.typeClient] || '#8A7A5C'
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:22px;height:22px;border-radius:50%;background:${color};border:3px solid white;"></div>`,
          iconSize: [22, 22],
        })
        L.marker([p.lat, p.lng], { icon }).addTo(map).bindPopup(
          `<b>${p.customerName}</b><br>${p.phone}<br>${p.commandes} livraison(s)<br>${p.total.toFixed(0)} ${currency}`
        )
      })

      if (points.length > 0) {
        const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]))
        if (shopLat != null && shopLng != null) bounds.extend([shopLat, shopLng])
        map.fitBounds(bounds, { padding: [24, 24] })
      } else if (shopLat != null && shopLng != null) {
        map.setView([shopLat, shopLng], 13)
      }
    })

    return () => {
      cancelled = true
    }
  }, [points, currency, shopLat, shopLng])

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  return <div ref={containerRef} style={{ width: '100%', height, borderRadius: 8 }} />
}
