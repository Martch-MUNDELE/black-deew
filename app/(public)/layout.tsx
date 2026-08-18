import Navbar from '@/components/Navbar'
import BackgroundSmoke from '@/components/BackgroundSmoke'
import FooterHero from '@/components/FooterHero'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const [settingsResult, menuResult] = await Promise.all([
    supabase
      .from('settings')
      .select('key, value'),

    supabase
      .from('menu_categories')
      .select('*')
      .order('display_order'),
  ])

  const initialSettings = settingsResult.data ?? []
  const initialMenuCategories = menuResult.data ?? []

  return (
    <>
      <Navbar
        initialSettings={initialSettings}
        initialMenuCategories={initialMenuCategories}
      />

      <main
        style={{
          maxWidth: 600,
          margin: '0 auto',
          padding: '0 0 clamp(64px, 12vh, 100px)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {children}
      </main>

      <BackgroundSmoke
        initialSettings={initialSettings}
      />

      <FooterHero
        initialSettings={initialSettings}
      />
    </>
  )
}
