import { createClient } from '@/lib/supabase/server'
import type { Product } from '@/lib/types'
import FeaturedCardClient from '@/components/FeaturedCardClient'

export default async function FeaturedCard() {
  const supabase = await createClient()
  const [{ data: featuredRaw }, { data: coupRaw }, { data: stockRow }] = await Promise.all([
    supabase.from('products').select('*').eq('featured', true).single(),
    supabase.from('products').select('*').eq('is_coup_de_coeur', true).eq('active', true).single(),
    supabase.from('settings').select('value').eq('key', 'stock_enabled').single(),
  ])
  const stockEnabled = stockRow?.value === 'true'

  const filterStock = (p: any) =>
    !p ? null : (stockEnabled && p.stock !== null && p.stock <= 0) ? null : p

  const product = filterStock(featuredRaw) as Product | null
  const coupProduct = filterStock(coupRaw) as Product | null

  if (!product) return null

  const subcats = [product.subcategory, ...(coupProduct && coupProduct.subcategory !== product.subcategory ? [coupProduct.subcategory] : [])]
  const { data: allData } = await supabase.from('products').select('*').in('subcategory', subcats).eq('active', true)
  const allProducts = (allData as Product[]) || []

  return <FeaturedCardClient product={product} allProducts={allProducts} coupProduct={coupProduct} />
}
