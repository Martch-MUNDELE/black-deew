import Navbar from '@/components/Navbar'
import BackgroundSmoke from '@/components/BackgroundSmoke'
import FooterHero from '@/components/FooterHero'
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main style={{ maxWidth: 600, margin: '0 auto', padding: '0 0 clamp(64px, 12vh, 100px)', position: 'relative', zIndex: 1 }}>
        {children}
      </main>
      <BackgroundSmoke />
      <FooterHero />
    </>
  )
}