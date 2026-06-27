import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'

export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient()
  const { data } = await supabase.from('settings').select('key, value').in('key', ['site_name', 'site_logo_vip'])
  const settings: Record<string, string> = {}
  ;(data || []).forEach((r: { key: string; value: string | null }) => { if (r.value) settings[r.key] = r.value })

  const ogImage = settings['site_logo_vip'] || 'https://black-deew.vercel.app/og-vip.jpg'
  const siteName = settings['site_name'] || 'Black Deew'
  const title = `Accès VIP — ${siteName}`
  const description = 'Sélection privée réservée à nos meilleurs clients. Accès exclusif Black Deew.'

  return {
    title,
    description,
    manifest: '/vip-manifest.webmanifest',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: `${siteName} VIP`,
    },
    openGraph: {
      title,
      description,
      url: 'https://black-deew.vercel.app/vip',
      siteName,
      images: [{ url: ogImage, width: 1254, height: 1254, alt: title }],
      locale: 'fr_FR',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  }
}

export default function VipLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
