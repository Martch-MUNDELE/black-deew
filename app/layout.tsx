import type { Metadata } from 'next'
import './globals.css'

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: 'Black Deew',
  description: 'Black Deew — Livraison food à Kinshasa',
  openGraph: {
    title: 'Black Deew',
    description: 'Black Deew — Livraison food à Kinshasa',
    url: 'https://black-deew.vercel.app',
    siteName: 'Black Deew',
    images: [
      {
        url: 'https://black-deew.vercel.app/og-image.png',
        width: 800,
        height: 800,
        alt: 'Black Deew',
      }
    ],
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Black Deew',
    description: 'Black Deew — Livraison food à Kinshasa',
    images: ['https://black-deew.vercel.app/og-image.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='fr' style={{ background: '#080603' }}>
      <body style={{ background: '#080603', minHeight: '100vh' }}>
        {children}
      </body>
    </html>
  )
}
