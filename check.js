import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

async function main() {
  const { data: cats } = await sb
    .from('menu_categories')
    .select('id,slug,name,parent_id,level,active')
    .order('level')

  const { data: prods } = await sb
    .from('products')
    .select('name,subcategory,active')
    .eq('active', true)

  console.log('CATS:', JSON.stringify(cats?.slice(0, 15), null, 2))
  console.log('PRODS subcategories:', [...new Set(prods?.map((p) => p.subcategory))])
}

main().catch(console.error)
