import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const supabase = await createClient()

  const [
    settingsResult,
    menuResult,
  ] = await Promise.all([
    supabase
      .from('settings')
      .select('key, value'),

    supabase
      .from('menu_categories')
      .select('*')
      .order('display_order'),
  ])

  if (settingsResult.error) {
    return NextResponse.json(
      {
        ok: false,
        error: settingsResult.error.message,
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  }

  return NextResponse.json(
    {
      ok: true,
      settings: settingsResult.data ?? [],
      menuCategories:
        menuResult.error
          ? []
          : menuResult.data ?? [],
    },
    {
      headers: {
        'Cache-Control':
          'no-store, no-cache, must-revalidate',
      },
    }
  )
}
