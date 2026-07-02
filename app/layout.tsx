import type { Metadata } from 'next'
import './globals.css'
import { createClient } from '@/lib/supabase/server'
import VersionChecker from '@/components/VersionChecker'

type MetadataSettingRow = {
  key: string
  value: string | null
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#080603',
}

export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient()
  const { data } = await supabase.from('settings').select('key, value').in('key', ['site_name', 'site_description', 'site_logo'])
  const s: Record<string, string> = {}
  const rows = (data || []) as MetadataSettingRow[]
  rows.forEach((r) => { if (r.value) s[r.key] = r.value })
  const title = s['site_name'] || 'Black Deew'
  const description = s['site_description'] || 'Black Deew — Livraison food à Kinshasa'
  const ogImage = 'https://black-deew.vercel.app/og-image.png'
  return {
    title,
    description,
    manifest: '/manifest.json',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: title,
    },
    openGraph: {
      title,
      description,
      url: 'https://black-deew.vercel.app',
      siteName: title,
      images: [{ url: ogImage, width: 800, height: 800, alt: title }],
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='fr' style={{ background: '#080603' }}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body style={{ background: '#080603', minHeight: '100vh' }}>
        <VersionChecker />
        {children}
      </body>
    </html>
  )
}
