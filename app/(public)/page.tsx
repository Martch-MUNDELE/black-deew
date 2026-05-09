import { createClient } from '@/lib/supabase/server'
import ProductCard from '@/components/ProductCard'
import CatalogueClient from '@/components/CatalogueClient'
import FeaturedCard from '@/components/FeaturedCard'
import PopularCard from '@/components/PopularCard'
import FeaturesBar from '@/components/FeaturesBar'
import type { Product } from '@/lib/types'

export const revalidate = 0
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await createClient()
  const [{ data: products }, { data: settings }, { data: menuCats }] = await Promise.all([
    supabase.from('products').select('*').eq('active', true).eq('is_vip', false).order('name'),
    supabase.from('settings').select('*').eq('key', 'status'),
    supabase.from('menu_categories').select('id, slug, name, parent_id, display_order, active, level').order('display_order'),
  ])

  const isOpen = ((settings as any[])?.find?.((s: any) => s.key === 'status')?.value || '') === 'open'

  type MenuCatMin = { id: string; slug: string; name: string; parent_id: string | null; display_order: number; active: boolean; level: number }
  const cats = (menuCats as MenuCatMin[] | null) ?? []
  const menuGroupes = (() => {
    const l0 = cats.filter(c => c.level === 0 && c.active).sort((a, b) => a.display_order - b.display_order)
    const l1 = cats.filter(c => c.level === 1 && c.active).sort((a, b) => a.display_order - b.display_order)
    return l0.map(g => ({ id: g.slug, label: g.name, sous: l1.filter(s => s.parent_id === g.id).map(s => ({ id: s.slug, label: s.name })) }))
  })()

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>

      {/* FEATURED ou POPULAR selon sélection */}
      {isOpen && <PopularCard fallback={<FeaturedCard />} />}

      {/* 3 ARGUMENTS */}
      {isOpen && <FeaturesBar />}

      {/* CATALOGUE avec sous-menus */}
      {isOpen && <CatalogueClient products={products || []} isOpen={isOpen} groupes={menuGroupes.length > 0 ? menuGroupes : undefined} />}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}
