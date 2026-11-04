// BLAC-P2-027 : page publique d'une offre de campagne (offre?c=<id>), apercu WhatsApp via Open Graph.
// Composant serveur. Aucune donnee client : seulement le contenu de la campagne et de sa promotion.
import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { loadPublicCampaign, resolveCampaignOgImage, type PublicCampaign } from '@/lib/campaign-public'
import { isValidCampaignImageUrl } from '@/lib/campaigns'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://black-deew.vercel.app'
const OG_IMAGE = 'https://black-deew.vercel.app/og-image.png'
const UNAVAILABLE_TITLE = "Cette offre n'est plus disponible"

function readCampaignId(sp: Record<string, string | string[] | undefined>): string {
  const raw = sp?.c
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === 'string' ? value.trim().slice(0, 100) : ''
}

async function loadOffer(id: string): Promise<PublicCampaign | null> {
  if (!id) return null
  try {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    return await loadPublicCampaign(db, id)
  } catch {
    return null
  }
}

function formatFr(value: string | null): string | null {
  if (!value) return null
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) return null
  return new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function describeDates(offer: PublicCampaign): string | null {
  const from = formatFr(offer.startsAt)
  const to = formatFr(offer.endsAt)
  if (from && to) return `Du ${from} au ${to}`
  if (to) return `Jusqu'au ${to}`
  if (from) return `À partir du ${from}`
  return null
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const id = readCampaignId(await searchParams)
  const offer = await loadOffer(id)
  if (!offer) {
    return {
      title: UNAVAILABLE_TITLE,
      robots: { index: false, follow: false },
    }
  }
  const title = offer.name || 'Offre Black Deew'
  const description = (offer.message || offer.promotionName || 'Une offre Black Deew pour toi.').slice(0, 200)
  const ogImage = resolveCampaignOgImage(offer.imageUrl, OG_IMAGE)
  const ogImages =
    ogImage === OG_IMAGE
      ? [{ url: ogImage, width: 800, height: 800, alt: title }]
      : [{ url: ogImage, alt: title }]
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE_URL.replace(/\/+$/, '')}/offre?c=${encodeURIComponent(id)}`,
      siteName: 'Black Deew',
      images: ogImages,
      locale: 'fr_FR',
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
  }
}


const WRAP: React.CSSProperties = {
  minHeight: '100vh', background: '#080603', color: '#F0E6CC', display: 'flex',
  alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
}
const CARD: React.CSSProperties = {
  width: '100%', maxWidth: 480, background: '#131009', border: '1px solid rgba(232,160,32,0.2)',
  borderRadius: 16, padding: '1.5rem', textAlign: 'center',
}
const BUTTON: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 48, padding: '0 1.5rem',
  borderRadius: 10, background: '#E8A020', color: '#080603', fontWeight: 700, fontSize: 16, textDecoration: 'none',
}
const OFFER_WRAP: React.CSSProperties = {
  minHeight: '100vh', background: '#080603', color: '#F0E6CC', display: 'flex',
  justifyContent: 'center', padding: '1rem',
}
const OFFER_COL: React.CSSProperties = { width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 16 }
const HEADER: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, padding: '0 4px',
}
const BADGE: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', minHeight: 28, padding: '0 12px', borderRadius: 999,
  background: 'rgba(232,160,32,0.15)', border: '1px solid rgba(232,160,32,0.4)', color: '#E8A020',
  fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
}
const OFFER_CARD: React.CSSProperties = {
  background: '#131009', border: '1px solid rgba(232,160,32,0.2)', borderRadius: 16, overflow: 'hidden',
}
const VISUAL: React.CSSProperties = { display: 'block', width: '100%', height: 'auto', maxHeight: 360, objectFit: 'cover' }
const BODY: React.CSSProperties = { padding: '1.25rem', textAlign: 'center' }
const VALIDITY: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, fontSize: 14, color: '#8A7A5C', margin: '0 0 16px',
}
const NOTICE: React.CSSProperties = {
  background: 'rgba(232,160,32,0.08)', border: '1px solid rgba(232,160,32,0.3)', borderRadius: 12,
  padding: '12px 16px', fontSize: 14, lineHeight: 1.5, color: '#F0E6CC', margin: '0 0 20px',
}
const BIG_BUTTON: React.CSSProperties = { ...BUTTON, width: '100%', minHeight: 52, fontSize: 17 }

function ClockIcon() {
  return (
    <svg data-icon="validity-clock" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E8A020"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

export default async function OffrePage({ searchParams }: { searchParams: SearchParams }) {
  const id = readCampaignId(await searchParams)
  const offer = await loadOffer(id)

  if (!offer) {
    return (
      <main style={WRAP}>
        <div style={CARD}>
          <h1 style={{ fontSize: 22, color: '#E8A020', margin: '0 0 12px' }}>{UNAVAILABLE_TITLE}</h1>
          <p style={{ fontSize: 14, color: '#8A7A5C', margin: '0 0 20px' }}>
            Cette offre est terminée ou n&apos;existe pas. Découvre notre carte du moment.
          </p>
          <a href="/" style={BUTTON}>Voir la carte</a>
        </div>
      </main>
    )
  }

  const dates = describeDates(offer)
  const imageUrl = isValidCampaignImageUrl(offer.imageUrl) ? offer.imageUrl.trim() : null
  return (
    <main style={OFFER_WRAP}>
      <div style={OFFER_COL}>
        <header style={HEADER}>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#E8A020' }}>Black Deew</span>
          <span style={BADGE}>Offre VIP</span>
        </header>
        <section style={OFFER_CARD}>
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={`Visuel de l'offre : ${offer.name}`} style={VISUAL} />
          )}
          <div style={BODY}>
            <h1 style={{ fontSize: 26, color: '#E8A020', margin: '0 0 8px' }}>{offer.name}</h1>
            {offer.promotionName && (
              <p style={{ fontSize: 15, color: '#F0E6CC', margin: '0 0 16px' }}>
                Profite de la promotion « {offer.promotionName} ».
              </p>
            )}
            <p style={{ fontSize: 16, lineHeight: 1.6, whiteSpace: 'pre-line', margin: '0 0 16px' }}>{offer.message}</p>
            {dates && (
              <p style={VALIDITY}>
                <ClockIcon />
                <span>{dates}</span>
              </p>
            )}
            <div style={NOTICE}>Ton offre est déjà dans ton compte : elle s&apos;ajoutera à ton panier.</div>
            <a href="/panier" style={BIG_BUTTON}>Commander avec l&apos;offre</a>
            <p style={{ fontSize: 12, color: '#8A7A5C', margin: '12px 0 0', minHeight: 20 }}>
              Connexion VIP demandée si tu n&apos;es pas déjà connecté.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
