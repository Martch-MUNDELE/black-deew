import { createClient } from '@/lib/supabase/server'
import CatalogueClient from '@/components/CatalogueClient'
import FeaturedCard from '@/components/FeaturedCard'
import PopularCard from '@/components/PopularCard'
import FeaturesBar from '@/components/FeaturesBar'
import type { Product } from '@/lib/types'

export const revalidate = 0
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await createClient()

  const { data: cmsSettings } = await supabase
    .from('settings')
    .select('key, value')
  const [{ data: products }, { data: settings }, { data: menuCats }, { data: stockSetting }] = await Promise.all([
    supabase.from('products').select('*').eq('active', true).eq('is_vip', false).neq('subcategory', 'vip').order('name'),
    supabase.from('settings').select('*').eq('key', 'status'),
    supabase.from('menu_categories').select('id, slug, name, parent_id, display_order, active, level, is_visible').order('display_order'),
    supabase.from('settings').select('value').eq('key', 'stock_enabled').single(),
  ])

  type SettingRow = { key: string; value: string | null }
  type ProductWithStock = Product & { stock?: number | null; subcategory?: string | null }

  const stockEnabled = (stockSetting as { value?: string | null } | null)?.value === 'true'
  const allProducts = ((products ?? []) as ProductWithStock[])
  const visibleProducts = stockEnabled
    ? allProducts.filter((p) => p.stock === null || p.stock === undefined || p.stock > 0)
    : allProducts

  const isOpen = (((settings as SettingRow[] | null) ?? []).find((s) => s.key === 'status')?.value ?? '') === 'open'

  type MenuCatMin = { id: string; slug: string; name: string; parent_id: string | null; display_order: number; active: boolean; level: number; is_visible?: boolean | null }
  const cats = (menuCats as MenuCatMin[] | null) ?? []
  const menuGroupes = (() => {
    const l0 = cats.filter(c => c.level === 0 && c.active && c.is_visible !== false).sort((a, b) => a.display_order - b.display_order)
    const l1 = cats.filter(c => c.level === 1 && c.active && c.is_visible !== false).sort((a, b) => a.display_order - b.display_order)
    const activeProducts = visibleProducts
    return l0
      .map(g => {
        const allSous = l1.filter(s => s.parent_id === g.id)
        const sousWith = allSous.filter(s => activeProducts.some(p => p.subcategory === s.slug))
        if (allSous.length === 0) {
          // groupe sans sous-catégories : garder seulement si produits directs existent
          const hasDirect = activeProducts.some(p => p.subcategory === g.slug)
          if (!hasDirect) return null
          return { id: g.slug, label: g.name, sous: [] }
        }
        if (sousWith.length === 0) return null
        return { id: g.slug, label: g.name, sous: sousWith.map(s => ({ id: s.slug, label: s.name })) }
      })
      .filter((g): g is NonNullable<typeof g> => g !== null)
  })()

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>

      {/* FEATURED ou POPULAR selon sélection */}
      {isOpen && <PopularCard fallback={<FeaturedCard />} />}

      {/* 3 ARGUMENTS */}
      {isOpen && <FeaturesBar initialSettings={cmsSettings ?? []} />}

      {/* CATALOGUE avec sous-menus */}
      {isOpen && <CatalogueClient products={visibleProducts} isOpen={isOpen} groupes={menuGroupes.length > 0 ? menuGroupes : undefined} />}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}
