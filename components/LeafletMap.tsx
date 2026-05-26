'use client'

import { useEffect, useId, useRef } from 'react'

interface LeafletMapProps {
  lat: number
  lng: number
  onPositionChange: (lat: number, lng: number, address: string) => void
  height?: number
}

interface LeafletLatLng {
  lat: number
  lng: number
}

interface LeafletClickEvent {
  latlng: LeafletLatLng
}

interface LeafletMarker {
  addTo: (map: LeafletMapInstance) => LeafletMarker
  getLatLng: () => LeafletLatLng
  setLatLng: (position: [number, number] | LeafletLatLng) => LeafletMarker
  on: (eventName: 'dragend', handler: () => void) => void
}

interface LeafletMapInstance {
  setView: (position: [number, number], zoom?: number) => LeafletMapInstance
  getZoom: () => number
  on: (eventName: 'click', handler: (event: LeafletClickEvent) => void) => void
  remove: () => void
}

interface LeafletNamespace {
  Icon: {
    Default: {
      prototype: Record<string, unknown>
      mergeOptions: (options: Record<string, string>) => void
    }
  }
  map: (element: HTMLElement) => LeafletMapInstance
  marker: (position: [number, number], options: { draggable: boolean }) => LeafletMarker
  tileLayer: (
    url: string,
    options: { attribution: string }
  ) => { addTo: (map: LeafletMapInstance) => void }
}

type WindowWithLeaflet = Window & {
  L?: LeafletNamespace
}

let leafletLoadPromise: Promise<void> | null = null

function loadLeaflet(): Promise<void> {
  if (leafletLoadPromise) return leafletLoadPromise

  leafletLoadPromise = new Promise<void>((resolve) => {
    const leafletWindow = window as WindowWithLeaflet

    if (leafletWindow.L) {
      resolve()
      return
    }

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
  const mapRef = useRef<LeafletMapInstance | null>(null)
  const markerRef = useRef<LeafletMarker | null>(null)
  const onChangeRef = useRef(onPositionChange)
  const latRef = useRef(lat)
  const lngRef = useRef(lng)
  const reactId = useId()
  const mapId = `lmap-${reactId.replace(/:/g, '')}`

  useEffect(() => {
    onChangeRef.current = onPositionChange
  }, [onPositionChange])

  useEffect(() => {
    latRef.current = lat
    lngRef.current = lng
  }, [lat, lng])

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return

    let cancelled = false

    loadLeaflet().then(() => {
      if (cancelled || !containerRef.current || mapRef.current) return

      const leafletWindow = window as WindowWithLeaflet
      const L = leafletWindow.L
      if (!L) return

      delete L.Icon.Default.prototype._getIconUrl
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
            { headers: { 'User-Agent': 'BlackDeew/1.0' } }
          )
          const data = await res.json() as { display_name?: string }
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

      map.on('click', async (event: LeafletClickEvent) => {
        marker.setLatLng(event.latlng)
        const address = await reverseGeocode(event.latlng.lat, event.latlng.lng)
        onChangeRef.current(event.latlng.lat, event.latlng.lng, address)
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
        id={mapId}
        suppressHydrationWarning
        style={{ height, borderRadius: 12, overflow: 'hidden' }}
      />
      <div style={{ fontSize: 11, color: '#7A6E58', marginTop: 6, textAlign: 'center' }}>
        Touchez la carte ou déplacez le pin pour ajuster votre position
      </div>
    </div>
  )
}
