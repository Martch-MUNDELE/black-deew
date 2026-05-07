'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import ImageUpload from '@/components/ImageUpload'
import { useCurrency } from '@/lib/currency'

const FALLBACK_SUBCATS = [
  { slug: 'chaudes', name: 'Boissons Chaudes' },
  { slug: 'froides', name: 'Boissons Froides' },
  { slug: 'sandwichs_chauds', name: 'Sandwichs Chauds' },
  { slug: 'sandwichs_froids', name: 'Sandwichs Froids' },
  { slug: 'salades', name: 'Salades' },
]
const inputStyle = { width: '100%', padding: '13px 14px', borderRadius: 12, border: '1px solid rgba(232,160,32,0.2)', background: 'rgba(255,255,255,0.03)', color: '#F5EDD6', fontSize: 16, outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' as const }
const labelStyle = { fontSize: 11, fontWeight: 700, color: '#C8B99A', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }

export default function ModifierProduit() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const admin = supabase
  const currency = useCurrency()
  const [form, setForm] = useState<{ name: string, description: string, ingredients: string, price: number, subcategory: string, image_url: string, active: boolean, discount: number | null, is_vip: boolean }>({ name: '', description: '', ingredients: '', price: 0, subcategory: 'sandwichs_chauds', image_url: '', active: true, discount: null, is_vip: false })
  const [subcats, setSubcats] = useState<{ slug: string; name: string; label: string }[]>(FALLBACK_SUBCATS.map(s => ({ ...s, label: s.name })))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('menu_categories').select('slug,name,level,parent_id,id').eq('active', true).order('display_order').then(({ data }) => {
      if (!data || data.length === 0) return
      const l0 = data.filter((c: any) => c.level === 0)
      const l1 = data.filter((c: any) => c.level === 1)
      const options: { slug: string; name: string; label: string }[] = []
      l0.forEach((g: any) => {
        const children = l1.filter((s: any) => s.parent_id === g.id)
        if (children.length === 0) {
          options.push({ slug: g.slug, name: g.name, label: g.name })
        } else {
          children.forEach((s: any) => options.push({ slug: s.slug, name: s.name, label: g.name + ' — ' + s.name }))
        }
      })
      if (options.length > 0) setSubcats(options)
    })
  }, [])

  useEffect(() => {
    supabase.from('products').select('*').eq('id', params.id).single().then(({ data }) => {
      if (data) setForm({ name: data.name || '', description: data.description || '', ingredients: data.ingredients || '', price: data.price || 0, subcategory: data.subcategory || 'sandwichs_chauds', image_url: data.image_url || '', active: data.active ?? true, discount: data.discount ?? null, is_vip: data.is_vip ?? false })
    })
  }, [])

  const save = async () => {
    setSaving(true)
    const { error } = await admin.from('products').update({ ...form }).eq('id', params.id)
    if (error) {
      alert('Erreur: ' + error.message)
      setSaving(false)
      return
    }
    window.location.href = '/admin/produits'
  }

  const promoOn = typeof form.discount === 'number' && form.discount > 0
  const discountedPreview = promoOn ? Math.ceil(form.price * (1 - (form.discount as number) / 100)) : null
  const savingsPreview = discountedPreview !== null ? form.price - discountedPreview : null

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 0 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.push('/admin/produits')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 14px', color: '#C8B99A', cursor: 'pointer', fontSize: 13, fontFamily: 'DM Sans, sans-serif' }}>← Retour</button>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 900, color: '#F5EDD6', margin: 0 }}>Modifier le produit</h1>
      </div>
      <div style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.12)', borderRadius: 16, padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[{ key: 'name', label: 'Nom', type: 'text' }, { key: 'description', label: 'Description', type: 'text' }, { key: 'ingredients', label: 'Ingrédients', type: 'text' }, { key: 'price', label: `Prix (${currency})`, type: 'number' }].map(f => (
          <div key={f.key}>
            <label style={labelStyle}>{f.label}</label>
            <input type={f.type} value={(form as any)[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: f.type === 'number' ? parseFloat(e.target.value) : e.target.value }))} style={inputStyle} />
          </div>
        ))}
        <div>
          <label style={labelStyle}>Image</label>
          <ImageUpload imageUrl={form.image_url} onUpload={url => setForm(f => ({ ...f, image_url: url }))} />
        </div>
        <div>
          <label style={labelStyle}>Sous-catégorie</label>
          <select value={form.subcategory} onChange={e => setForm(f => ({ ...f, subcategory: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
            {subcats.map(s => <option key={s.slug} value={s.slug}>{s.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(232,160,32,0.1)' }}>
          <input type="checkbox" id="active" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} style={{ accentColor: '#E8A020', width: 18, height: 18 }} />
          <label htmlFor="active" style={{ fontSize: 14, color: '#C8B890', cursor: 'pointer' }}>Produit actif (visible sur le site)</label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'rgba(245,200,66,0.04)', borderRadius: 10, border: '1px solid rgba(245,200,66,0.2)' }}>
          <input type="checkbox" id="is_vip" checked={form.is_vip} onChange={e => setForm(f => ({ ...f, is_vip: e.target.checked }))} style={{ accentColor: '#F5C842', width: 18, height: 18 }} />
          <label htmlFor="is_vip" style={{ fontSize: 14, color: '#F5C842', cursor: 'pointer', fontWeight: 700 }}>Produit VIP <span style={{ fontSize: 11, color: '#C8B99A', fontWeight: 400 }}>— visible uniquement sur /vip</span></label>
        </div>
        <div style={{ background: 'rgba(255,80,80,0.04)', border: '1px solid rgba(255,80,80,0.15)', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F5EDD6', fontFamily: 'DM Sans, sans-serif' }}>Promotion</div>
              <div style={{ fontSize: 11, color: '#7A6E58', marginTop: 2 }}>Réduction sur ce produit</div>
            </div>
            <div
              onClick={() => setForm(f => ({ ...f, discount: promoOn ? null : 10 }))}
              style={{ width: 44, height: 24, borderRadius: 12, background: promoOn ? 'rgba(255,80,80,0.3)' : 'rgba(255,255,255,0.08)', border: promoOn ? '1px solid rgba(255,80,80,0.5)' : '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', position: 'relative', flexShrink: 0 }}
            >
              <div style={{ position: 'absolute', top: 3, left: promoOn ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: promoOn ? '#FF5050' : '#555' }} />
            </div>
          </div>
          {promoOn && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={labelStyle}>Réduction (%)</label>
                <input
                  type="number" min={5} max={80}
                  value={form.discount ?? ''}
                  onChange={e => { const v = parseInt(e.target.value); setForm(f => ({ ...f, discount: isNaN(v) ? 5 : Math.min(80, Math.max(5, v)) })) }}
                  style={inputStyle}
                />
              </div>
              {discountedPreview !== null && savingsPreview !== null && (
                <div style={{ padding: '10px 14px', background: 'rgba(255,80,80,0.06)', borderRadius: 8, border: '1px solid rgba(255,80,80,0.12)' }}>
                  <div style={{ fontSize: 12, color: '#FF8080', fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}>Prix remisé : {discountedPreview} {currency}</div>
                  <div style={{ fontSize: 12, color: '#7A6E58', fontFamily: 'DM Sans, sans-serif', marginTop: 4 }}>Économie : {savingsPreview} {currency}</div>
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
          <button onClick={() => router.push('/admin/produits')} style={{ flex: 1, padding: '14px', borderRadius: 50, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#C8B99A', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 14 }}>Annuler</button>
          <button onClick={save} disabled={saving} style={{ flex: 2, padding: '14px', borderRadius: 50, border: 'none', background: 'linear-gradient(135deg,#F5C842,#FF6B20)', color: '#0A0804', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: 14 }}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
        </div>
      </div>
    </div>
  )
}