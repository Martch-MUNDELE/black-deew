import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const bucket = (formData.get('bucket') as string) || 'products'

    if (!file) return NextResponse.json({ error: 'Aucun fichier' }, { status: 400 })

    const ext = file.name.split('.').pop()
    const fileName = Date.now() + '.' + ext
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error } = await supabase.storage.from(bucket).upload(fileName, buffer, {
      contentType: file.type,
      upsert: true
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName)
    return NextResponse.json({ url: data.publicUrl })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
