'use client'
import ProductCard from '@/components/ProductCard'
import { useCatalogue } from '@/store/catalogue'
import type { Product } from '@/lib/types'

type GroupeFilter = { id: string; sous: { id: string }[] }

const GROUPES_FALLBACK: GroupeFilter[] = [
  { id: 'boissons', sous: [{ id: 'chaudes' }, { id: 'froides' }] },
  { id: 'sandwichs', sous: [{ id: 'sandwichs_chauds' }, { id: 'sandwichs_froids' }] },
  { id: 'salades', sous: [] },
]

export default function CatalogueClient({ products, isOpen, groupes: groupesProp }: { products: Product[], isOpen: boolean, groupes?: GroupeFilter[] }) {
  const { activeGroupe, activeSous, hasSelected } = useCatalogue()
  const groupes = (groupesProp && groupesProp.length > 0) ? groupesProp : GROUPES_FALLBACK
  const groupe = groupes.find(g => g.id === activeGroupe) ?? { id: activeGroupe, sous: [] as { id: string }[] }

  const popularId = products.find(p => p.subcategory === activeSous && p.popular)?.id
  const filtered = (groupe.sous.length === 0
    ? products.filter(p => p.subcategory === activeGroupe)
    : products.filter(p => p.subcategory === activeSous)
  ).filter(p => p.id !== popularId)

  if (!hasSelected) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 16px clamp(120px, 30vh, 240px)', maxWidth: 600, margin: '0 auto' }}>
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#C8B99A', padding: '40px 0', fontSize: 14 }}>Aucun produit disponible</div>
      ) : filtered.map((p, i) => (
        <ProductCard key={p.id} product={p} featured={false} isOpen={isOpen} allProducts={products} />
      ))}
    </div>
  )
}
