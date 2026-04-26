'use client'
import { useEffect, useRef } from 'react'

interface LeafletMapProps {
  lat: number
  lng: number
  onPositionChange: (lat: number, lng: number, address: string) => void
  height?: number
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

export default function LeafletMap({ lat, lng, onPositionChange, height = 250 }: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const onChangeRef = useRef(onPositionChange)
  const latRef = useRef(lat)
  const lngRef = useRef(lng)
  const mapId = useRef('')

  onChangeRef.current = onPositionChange
  latRef.current = lat
  lngRef.current = lng

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return
    if (!mapId.current) mapId.current = `lmap-${Math.random().toString(36).slice(2, 8)}`
    let cancelled = false

    loadLeaflet().then(() => {
      if (cancelled || !containerRef.current || mapRef.current) return
      const L = (window as any).L

      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = L.map(containerRef.current).setView([latRef.current, lngRef.current], 15)
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map)

      const marker = L.marker([latRef.current, lngRef.current], { draggable: true }).addTo(map)
      markerRef.current = marker

      const reverseGeocode = async (rlat: number, rlng: number): Promise<string> => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${rlat}&lon=${rlng}&format=json&accept-language=fr`,
            { headers: { 'User-Agent': 'AbouJoudia/1.0' } }
          )
          const data = await res.json()
          return data.display_name || ''
        } catch {
          return ''
        }
      }

      marker.on('dragend', async () => {
        const pos = marker.getLatLng()
        const address = await reverseGeocode(pos.lat, pos.lng)
        onChangeRef.current(pos.lat, pos.lng, address)
      })

      map.on('click', async (e: any) => {
        marker.setLatLng(e.latlng)
        const address = await reverseGeocode(e.latlng.lat, e.latlng.lng)
        onChangeRef.current(e.latlng.lat, e.latlng.lng, address)
      })
    })

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (mapRef.current && markerRef.current) {
      markerRef.current.setLatLng([lat, lng])
      mapRef.current.setView([lat, lng], mapRef.current.getZoom())
    }
  }, [lat, lng])

  return (
    <div>
      <div
        ref={containerRef}
        id={mapId.current}
        suppressHydrationWarning
        style={{ height, borderRadius: 12, overflow: 'hidden' }}
      />
      <div style={{ fontSize: 11, color: '#7A6E58', marginTop: 6, textAlign: 'center' }}>
        Touchez la carte ou déplacez le pin pour ajuster votre position
      </div>
    </div>
  )
}
