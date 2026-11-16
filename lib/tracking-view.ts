export type TrackingView = {
  active: boolean;
  lat?: number | null;
  lng?: number | null;
  updated_at?: string | null;
  fresh?: boolean;
};

const BBOX_DELTA = 0.005;

export function osmEmbedUrl(lat: number, lng: number): string {
  const left = (lng - BBOX_DELTA).toFixed(6);
  const bottom = (lat - BBOX_DELTA).toFixed(6);
  const right = (lng + BBOX_DELTA).toFixed(6);
  const top = (lat + BBOX_DELTA).toFixed(6);
  return `https://www.openstreetmap.org/export/embed.html?bbox=${left},${bottom},${right},${top}&layer=mapnik&marker=${lat},${lng}`;
}

export function googleMapsUrl(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

export function trackingStatusText(view: TrackingView, now: number = Date.now()): string {
  if (!view.active) return "Livraison terminée";
  if (typeof view.lat !== "number" || typeof view.lng !== "number") {
    return "Position en attente du livreur";
  }
  if (view.fresh) return "Le livreur est en route";
  const t = view.updated_at ? new Date(view.updated_at).getTime() : NaN;
  const minutes = Number.isFinite(t) ? Math.max(0, Math.round((now - t) / 60000)) : 0;
  return `Dernière position il y a ${minutes} min`;
}
