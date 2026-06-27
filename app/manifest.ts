import { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['site_name', 'site_logo_admin'])

  const settings: Record<string, string> = {}
  ;(data || []).forEach((r: { key: string; value: string }) => {
    if (r.value) settings[r.key] = r.value
  })

  const name = settings['site_name'] || 'Black Deew'
  const logoAdmin = settings['site_logo_admin'] || '/icons/icon-512x512.png'

  return {
    name: `${name} Admin`,
    short_name: name,
    description: `${name} — Administration`,
    start_url: '/admin',
    display: 'standalone',
    background_color: '#080603',
    theme_color: '#080603',
    orientation: 'portrait',
    icons: [
      {
        src: logoAdmin,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: logoAdmin,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ]
  }
}
