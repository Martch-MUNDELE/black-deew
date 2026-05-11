import { createClient } from '@/lib/supabase/server'
import type { Product } from '@/lib/types'
import FeaturedCardClient from '@/components/FeaturedCardClient'

export default async function FeaturedCard() {
  const supabase = await createClient()
  const [{ data: featuredRaw }, { data: stockRow }] = await Promise.all([
    supabase.from('products').select('*').eq('featured', true).single(),
    supabase.from('settings').select('value').eq('key', 'stock_enabled').single(),
  ])
  const stockEnabled = stockRow?.value === 'true'
  const data = (stockEnabled && featuredRaw && featuredRaw.stock !== null && featuredRaw.stock <= 0) ? null : featuredRaw
  const product = data as Product | null
  if (!product) return null

  const { data: allData } = await supabase.from('products').select('*').eq('subcategory', product.subcategory).eq('active', true)
  const allProducts = (allData as Product[]) || []

  return <FeaturedCardClient product={product} allProducts={allProducts} />
}
