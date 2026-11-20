'use client'
// BLAC-CARTE-LIVRAISON : vraie carte (Leaflet + tuiles OpenStreetMap) pour le detail de course du livreur.
// Position du livreur : lecture seule via le navigateur, jamais transmise depuis ce composant.
// Repli : illustration SVG si coordonnees absentes/invalides ou si Leaflet ne se charge pas.
import { useCallback, useEffect, useRef, useState } from 'react'
import DriverRouteIllustration from '@/components/driver/DriverRouteIllustration'
import {
  computeView,
  MAP_HEIGHT_PX,
  OSM_ATTRIBUTION_HTML,
  OSM_MAX_ZOOM,
  OSM_TILE_URL,
  toLatLng,
  type LatLng,
} from '@/lib/driver-route-map'

interface LMap {
  setView: (center: [number, number], zoom: number) => LMap
  fitBounds: (bounds: [[number, number], [number, number]], options?: { padding: [number, number]; maxZoom: number }) => LMap
  remove: () => void
}
interface LMarker {
  addTo: (map: LMap) => LMarker
  setLatLng: (position: [number, number]) => LMarker
}
interface LLib {
  map: (element: HTMLElement, options: Record<string, unknown>) => LMap
  tileLayer: (url: string, options: Record<string, unknown>) => { addTo: (map: LMap) => void }
  marker: (position: [number, number], options: Record<string, unknown>) => LMarker
  divIcon: (options: Record<string, unknown>) => unknown
  Browser: { mobile: boolean }
}
type WindowWithLeaflet = Window & { L?: LLib }

const LEAFLET_CSS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const LEAFLET_JS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
const LOAD_TIMEOUT_MS = 8000

const C = { bg: '#120E08', card: '#15110B', border: '#2A2216', text: '#F5EDD6', muted: '#BFAF8F', gold: '#F5C842', orange: '#FF6B20', green: '#7FD6A0' }

const PIN_HTML =
  '<svg width="28" height="38" viewBox="0 0 28 38" aria-hidden="true"><path d="M14 0C6.3 0 0 6.1 0 13.6 0 24 14 38 14 38s14-14 14-24.4C28 6.1 21.7 0 14 0z" fill="#FF6B20"/><circle cx="14" cy="13.5" r="5" fill="#120E08"/></svg>'
const DRIVER_HTML =
  '<div style="width:18px;height:18px;border-radius:50%;background:#7FD6A0;border:3px solid #120E08;box-shadow:0 0 0 2px #7FD6A0"></div>'

const MAP_CSS = `
.drm-map .leaflet-container{background:${C.bg};font-family:'DM Sans',sans-serif}
.drm-map .leaflet-tile-pane{filter:invert(1) hue-rotate(180deg) brightness(.9) contrast(.9) saturate(.6)}
.drm-map .drm-icon{background:transparent!important;border:none!important}
.drm-map .leaflet-bar{border:1px solid ${C.border}!important;box-shadow:none!important}
.drm-map .leaflet-bar a{width:44px!important;height:44px!important;line-height:44px!important;background:${C.card}!important;color:${C.gold}!important;border-bottom:1px solid ${C.border}!important}
.drm-map .leaflet-control-attribution{background:rgba(21,17,11,.85)!important;color:${C.muted}!important}
.drm-map .leaflet-control-attribution a{color:${C.gold}!important}
`

// Chargement unique : une seule promesse partagee par toutes les cartes de la page.
let leafletLoadPromise: Promise<LLib> | null = null

function loadLeaflet(): Promise<LLib> {
  if (leafletLoadPromise) return leafletLoadPromise
  const promise = new Promise<LLib>((resolve, reject) => {
    const w = window as WindowWithLeaflet
    if (w.L) {
      resolve(w.L)
      return
    }
    if (!document.querySelector(`link[href="${LEAFLET_CSS_URL}"]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = LEAFLET_CSS_URL
      document.head.appendChild(link)
    }
    let script = document.querySelector<HTMLScriptElement>(`script[src="${LEAFLET_JS_URL}"]`)
    if (!script) {
      script = document.createElement('script')
      script.src = LEAFLET_JS_URL
      document.head.appendChild(script)
    }
    const current = script
    const timer = window.setTimeout(() => reject(new Error('leaflet-timeout')), LOAD_TIMEOUT_MS)
    current.addEventListener('load', () => {
      window.clearTimeout(timer)
      if (w.L) resolve(w.L)
      else reject(new Error('leaflet-missing'))
    })
    current.addEventListener('error', () => {
      window.clearTimeout(timer)
      current.remove()
      reject(new Error('leaflet-error'))
    })
  })
  leafletLoadPromise = promise
  promise.catch(() => {
    if (leafletLoadPromise === promise) leafletLoadPromise = null
  })
  return promise
}

export default function DriverRouteMap({
  lat,
  lng,
  distanceText,
}: {
  lat?: number | null
  lng?: number | null
  distanceText?: string
}) {
  const dest = toLatLng(lat, lng)
  const destLat = dest ? dest.lat : null
  const destLng = dest ? dest.lng : null
  const hasDest = destLat !== null && destLng !== null

  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [driver, setDriver] = useState<LatLng | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LMap | null>(null)
  const libRef = useRef<LLib | null>(null)
  const driverMarkerRef = useRef<LMarker | null>(null)
  const driverRef = useRef<LatLng | null>(null)
  const didFitDriverRef = useRef(false)

  // Cadrage automatique sur la destination et, si connue, la position du livreur.
  const fit = useCallback(() => {
    const map = mapRef.current
    if (!map || destLat === null || destLng === null) return
    const view = computeView({ lat: destLat, lng: destLng }, driverRef.current)
    if (!view) return
    if (view.kind === 'point') {
      map.setView([view.center.lat, view.center.lng], view.zoom)
    } else {
      const b = view.bounds
      map.fitBounds([[b.south, b.west], [b.north, b.east]], { padding: [48, 48], maxZoom: 17 })
    }
  }, [destLat, destLng])

  // Creation de la carte (une fois Leaflet charge).
  useEffect(() => {
    if (destLat === null || destLng === null) return
    let cancelled = false
    loadLeaflet()
      .then((L) => {
        const el = containerRef.current
        if (cancelled || !el || mapRef.current) return
        libRef.current = L
        const map = L.map(el, {
          zoomControl: true,
          scrollWheelZoom: false,
          dragging: !L.Browser.mobile,
          touchZoom: true,
          doubleClickZoom: true,
          attributionControl: true,
          maxZoom: OSM_MAX_ZOOM,
        })
        mapRef.current = map
        L.tileLayer(OSM_TILE_URL, { attribution: OSM_ATTRIBUTION_HTML, maxZoom: OSM_MAX_ZOOM }).addTo(map)
        L.marker([destLat, destLng], {
          icon: L.divIcon({ className: 'drm-icon', html: PIN_HTML, iconSize: [28, 38], iconAnchor: [14, 38] }),
          interactive: false,
          keyboard: false,
        }).addTo(map)
        fit()
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('failed')
      })
    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      driverMarkerRef.current = null
      didFitDriverRef.current = false
    }
  }, [destLat, destLng, fit])

  // Position du livreur : lecture seule. Refus ou erreur : on garde seulement la destination.
  useEffect(() => {
    if (!hasDest || typeof navigator === 'undefined' || !navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const p = toLatLng(pos.coords.latitude, pos.coords.longitude)
        if (p) {
          driverRef.current = p
          setDriver(p)
        }
      },
      () => {},
      { enableHighAccuracy: false, maximumAge: 15000, timeout: 20000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [hasDest])

  // Point vert du livreur + cadrage sur les deux points au premier releve.
  useEffect(() => {
    const L = libRef.current
    const map = mapRef.current
    if (status !== 'ready' || !driver || !L || !map) return
    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLatLng([driver.lat, driver.lng])
    } else {
      driverMarkerRef.current = L.marker([driver.lat, driver.lng], {
        icon: L.divIcon({ className: 'drm-icon', html: DRIVER_HTML, iconSize: [18, 18], iconAnchor: [9, 9] }),
        interactive: false,
        keyboard: false,
      }).addTo(map)
    }
    if (!didFitDriverRef.current) {
      didFitDriverRef.current = true
      fit()
    }
  }, [driver, status, fit])

  if (!dest || status === 'failed') {
    return <DriverRouteIllustration distanceText={distanceText} />
  }

  return (
    <div
      className="drm-map"
      role="region"
      aria-label="Carte du trajet"
      style={{ position: 'relative', isolation: 'isolate', height: MAP_HEIGHT_PX, borderRadius: 12, overflow: 'hidden', background: C.bg }}
    >
      <style>{MAP_CSS}</style>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      <button
        type="button"
        aria-label="Recentrer la carte"
        onClick={fit}
        disabled={status !== 'ready'}
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 1100,
          width: 44,
          height: 44,
          minWidth: 44,
          minHeight: 44,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 12,
          background: C.card,
          border: `1px solid ${C.border}`,
          color: C.gold,
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
      </button>
      {distanceText ? (
        <span
          style={{
            position: 'absolute',
            left: 10,
            bottom: 10,
            zIndex: 1100,
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 999,
            padding: '4px 10px',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            fontWeight: 700,
            color: C.text,
          }}
        >
          {distanceText}
        </span>
      ) : null}
    </div>
  )
}
