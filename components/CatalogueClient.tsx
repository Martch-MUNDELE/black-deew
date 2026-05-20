'use client'
import { useEffect } from 'react'
import ProductCard from '@/components/ProductCard'
import { useCatalogue } from '@/store/catalogue'
import type { Product } from '@/lib/types'

type GroupeFilter = { id: string; label?: string; sous: { id: string; label?: string }[] }

const GROUPES_FALLBACK: GroupeFilter[] = [
  { id: 'boissons', label: 'Boissons', sous: [{ id: 'chaudes', label: 'Chaudes' }, { id: 'froides', label: 'Froides' }] },
  { id: 'sandwichs', label: 'Sandwichs', sous: [{ id: 'sandwichs_chauds', label: 'Chauds' }, { id: 'sandwichs_froids', label: 'Froids' }] },
  { id: 'salades', label: 'Salades', sous: [] },
]

export default function CatalogueClient({ products, isOpen, groupes: groupesProp }: { products: Product[], isOpen: boolean, groupes?: GroupeFilter[] }) {
  const { activeGroupe, activeSous, hasSelected, setGroupe, reset, setMenuGroupes } = useCatalogue()
  const groupes = (groupesProp && groupesProp.length > 0) ? groupesProp : GROUPES_FALLBACK

  // Synchroniser menuGroupes dans le store pour la Navbar
  useEffect(() => {
    if (groupes.length > 0) {
      setMenuGroupes(groupes.map(g => ({ id: g.id, label: g.label ?? g.id, sous: g.sous.map(s => ({ id: s.id, label: s.label ?? s.id })) })))
    }
  }, [JSON.stringify(groupes)])

  // Reset activeGroupe si le groupe mémorisé n'existe plus dans les groupes disponibles
  useEffect(() => {
    if (!activeGroupe) return
    const exists = groupes.some(g => g.id === activeGroupe)
    if (!exists) {
      if (groupes.length > 0) {
        const first = groupes[0]
        setGroupe(first.id, first.sous.length > 0 ? first.sous[0].id : '')
      } else {
        reset()
      }
    }
  }, [activeGroupe, groupes])

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
