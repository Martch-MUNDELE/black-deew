import CampaignsPanel from '@/components/admin/CampaignsPanel'
import CampaignResults from '@/components/admin/CampaignResults'
import ClientOffersPanel from '@/components/admin/ClientOffersPanel'

// Message affiché quand il n'y a aucune campagne (transmis au panneau).
const EMPTY_TITLE = "Aucune campagne pour l'instant"
const EMPTY_TEXT = 'Prépare une première campagne avec le formulaire ci-dessus. Rien n’est envoyé à ce stade.'

export default function MarketingPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 960, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#E8A020', margin: '0 0 6px' }}>Marketing</h1>
      <p style={{ fontSize: 14, color: '#8A7A5C', margin: '0 0 24px' }}>
        Envoie des offres aux clients VIP par WhatsApp, avec leur accord.
      </p>

      <CampaignsPanel emptyTitle={EMPTY_TITLE} emptyText={EMPTY_TEXT} />

      <CampaignResults />

      <ClientOffersPanel />
    </div>
  )
}
