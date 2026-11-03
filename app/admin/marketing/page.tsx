import ClientOffersPanel from '@/components/admin/ClientOffersPanel'

const SECTION_TITLE_STYLE: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#8A7A5C', margin: '0 0 10px',
  textTransform: 'uppercase', letterSpacing: 0.5,
}

const CARD_STYLE: React.CSSProperties = {
  background: '#131009', border: '1px solid rgba(232,160,32,0.15)', borderRadius: 12, padding: '1rem',
}

export default function MarketingPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 960, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#E8A020', margin: '0 0 6px' }}>Marketing</h1>
      <p style={{ fontSize: 14, color: '#8A7A5C', margin: '0 0 24px' }}>
        Envoie des offres aux clients VIP par WhatsApp, avec leur accord.
      </p>

      <h2 style={SECTION_TITLE_STYLE}>Campagnes</h2>
      <div style={{ ...CARD_STYLE, padding: '2rem 1.25rem', textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#E8A020', marginBottom: 8 }}>
          Aucune campagne pour l'instant
        </div>
        <p style={{ fontSize: 13, color: '#6A5A40', margin: '0 auto', maxWidth: 480, lineHeight: 1.5 }}>
          La création de campagnes arrive bientôt. Tu pourras alors préparer une offre et l'envoyer
          uniquement aux clients VIP qui ont accepté de recevoir des offres.
        </p>
      </div>

      <ClientOffersPanel />
    </div>
  )
}
