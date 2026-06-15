import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const ogImage = 'https://black-deew.vercel.app/og-vip.png'
  const title = 'Accès VIP — Black Deew'
  const description = 'Sélection privée réservée à nos meilleurs clients. Accès exclusif Black Deew.'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: 'https://black-deew.vercel.app/vip',
      siteName: 'Black Deew',
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
