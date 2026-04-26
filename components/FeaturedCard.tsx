import { createClient } from '@/lib/supabase/server'
import type { Product } from '@/lib/types'
import FeaturedCardClient from '@/components/FeaturedCardClient'

export default async function FeaturedCard() {
  const supabase = await createClient()
  const { data } = await supabase.from('products').select('*').eq('featured', true).single()
  const product = data as Product | null
  if (!product) return null

  const { data: allData } = await supabase.from('products').select('*').eq('subcategory', product.subcategory).eq('active', true)
  const allProducts = (allData as Product[]) || []

  return <FeaturedCardClient product={product} allProducts={allProducts} />
}
