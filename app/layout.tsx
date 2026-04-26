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
  description: 'Black Deew — À compléter',
  openGraph: {
    title: 'Black Deew',
    description: 'Black Deew — À compléter',
    url: 'https://black-deew.vercel.app',
    siteName: 'Black Deew',
    images: [
      {
        url: '',
        width: 508,
        height: 433,
        alt: 'Black Deew',
      }
    ],
    locale: 'fr_FR',
    type: 'website',
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
