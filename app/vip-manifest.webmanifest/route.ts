import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['site_name', 'site_logo_vip'])

  const settings: Record<string, string> = {}
  ;(data || []).forEach((r: { key: string; value: string }) => {
    if (r.value) settings[r.key] = r.value
  })

  const name = settings['site_name'] || 'Black Deew'
  const logoVip = settings['site_logo_vip'] || '/icons/icon-512x512.png'

  const manifest = {
    name: `${name} VIP`,
    short_name: `${name} VIP`,
    description: `${name} — Espace VIP`,
    start_url: '/vip',
    display: 'standalone',
    background_color: '#080603',
    theme_color: '#080603',
    orientation: 'portrait',
    icons: [
      { src: logoVip, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: logoVip, sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  }

  return NextResponse.json(manifest, {
    headers: { 'Content-Type': 'application/manifest+json' }
  })
}
