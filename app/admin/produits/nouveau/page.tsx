'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useCurrency } from '@/lib/currency'
import ImageUpload from '@/components/ImageUpload'

type Variant = { type: string; options: string[] }

const FALLBACK_SUBCATS = [
  { slug: 'chaudes', name: 'Boissons Chaudes' },
  { slug: 'froides', name: 'Boissons Froides' },
  { slug: 'sandwichs_chauds', name: 'Sandwichs Chauds' },
  { slug: 'sandwichs_froids', name: 'Sandwichs Froids' },
  { slug: 'salades', name: 'Salades' },
]
const inputStyle = { width: '100%', padding: '13px 14px', borderRadius: 12, border: '1px solid rgba(232,160,32,0.2)', background: 'rgba(255,255,255,0.03)', color: '#F5EDD6', fontSize: 16, outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' as const }
const labelStyle = { fontSize: 11, fontWeight: 700, color: '#C8B99A', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }

export default function NouveauProduit() {
  const router = useRouter()
  const currency = useCurrency()
  const supabase = createClient()
  const [form, setForm] = useState({ name: '', description: '', ingredients: '', price: 0, subcategory: 'sandwichs_chauds', image_url: '', active: true, is_vip: false })
  const [subcats, setSubcats] = useState<{ slug: string; name: string; label: string }[]>(FALLBACK_SUBCATS.map(s => ({ ...s, label: s.name })))
  const [saving, setSaving] = useState(false)
  const [variants, setVariants] = useState<Variant[]>([])
  const [newOptionInputs, setNewOptionInputs] = useState<string[]>([])

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

  
  const addVariantType = () => {
    setVariants(v => [...v, { type: '', options: [] }])
    setNewOptionInputs(i => [...i, ''])
  }

  const updateVariantType = (idx: number, val: string) => {
    setVariants(v => v.map((vt, i) => i === idx ? { ...vt, type: val } : vt))
  }

  const removeVariant = (idx: number) => {
    setVariants(v => v.filter((_, i) => i !== idx))
    setNewOptionInputs(i => i.filter((_, j) => j !== idx))
  }

  const addOption = (idx: number) => {
    const val = newOptionInputs[idx]?.trim()
    if (!val) return
    setVariants(v => v.map((vt, i) => i === idx ? { ...vt, options: [...vt.options, val] } : vt))
    setNewOptionInputs(i => i.map((v, j) => j === idx ? '' : v))
  }

  const removeOption = (vIdx: number, oIdx: number) => {
    setVariants(v => v.map((vt, i) => i === vIdx ? { ...vt, options: vt.options.filter((_, j) => j !== oIdx) } : vt))
  }

  const updateOptionInput = (idx: number, val: string) => {
    setNewOptionInputs(i => i.map((v, j) => j === idx ? val : v))
  }

const save = async () => {
    setSaving(true)
    const cleanVariants = variants.filter(v => v.type.trim() && v.options.length > 0)
    const { error } = await supabase.from('products').insert({ ...form, variants: cleanVariants.length > 0 ? cleanVariants : null })
    setSaving(false)
    if (error) { alert('Erreur : ' + error.message); return }
    router.push('/admin/produits')
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 0 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.push('/admin/produits')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 14px', color: '#C8B99A', cursor: 'pointer', fontSize: 13, fontFamily: 'DM Sans, sans-serif' }}>← Retour</button>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 900, color: '#F5EDD6', margin: 0 }}>Nouveau produit</h1>
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
          <select value={form.is_vip ? 'vip' : form.subcategory} onChange={e => {
            if (e.target.value === 'vip') {
              setForm(f => ({ ...f, is_vip: true }))
            } else {
              setForm(f => ({ ...f, is_vip: false, subcategory: e.target.value }))
            }
          }} style={{ width: '100%', padding: '13px 14px', borderRadius: 12, border: '1px solid rgba(232,160,32,0.2)', background: '#0E0B06', color: '#F5EDD6', fontSize: 14, outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' as const, cursor: 'pointer' }}>
            {subcats.map(s => <option key={s.slug} value={s.slug}>{s.label}</option>)}
            <option value="vip">VIP — visible uniquement sur /vip</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(232,160,32,0.1)' }}>
          <input type="checkbox" id="active" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} style={{ accentColor: '#E8A020', width: 18, height: 18 }} />
          <label htmlFor="active" style={{ fontSize: 14, color: '#C8B890', cursor: 'pointer' }}>Produit actif (visible sur le site)</label>
        </div>
        
        {/* VARIANTES */}
        <div style={{ background: 'rgba(245,200,66,0.04)', border: '1px solid rgba(245,200,66,0.15)', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F5EDD6', fontFamily: 'DM Sans, sans-serif' }}>Variantes</div>
              <div style={{ fontSize: 11, color: '#7A6E58', marginTop: 2 }}>Taille, goût, couleur...</div>
            </div>
            <button onClick={addVariantType} style={{ padding: '7px 14px', borderRadius: 20, border: '1px solid rgba(245,200,66,0.4)', background: 'rgba(245,200,66,0.08)', color: '#F5C842', cursor: 'pointer', fontSize: 12, fontFamily: 'DM Sans, sans-serif', fontWeight: 700 }}>+ Ajouter</button>
          </div>
          {variants.map((vt, vIdx) => (
            <div key={vIdx} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px', border: '1px solid rgba(245,200,66,0.1)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input placeholder="Type (ex: Taille, Goût...)" value={vt.type} onChange={e => updateVariantType(vIdx, e.target.value)} style={{ ...inputStyle, fontSize: 13, padding: '9px 12px' }} />
                <button onClick={() => removeVariant(vIdx)} style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,80,80,0.3)', background: 'rgba(255,80,80,0.06)', color: '#FF8080', cursor: 'pointer', fontSize: 13, fontFamily: 'DM Sans, sans-serif', flexShrink: 0 }}>✕</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                {vt.options.map((opt, oIdx) => (
                  <span key={oIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: 'rgba(245,200,66,0.1)', border: '1px solid rgba(245,200,66,0.25)', fontSize: 12, color: '#F5C842', fontFamily: 'DM Sans, sans-serif' }}>
                    {opt}
                    <span onClick={() => removeOption(vIdx, oIdx)} style={{ cursor: 'pointer', color: '#7A6E58', fontWeight: 700 }}>×</span>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input placeholder="Ajouter une option..." value={newOptionInputs[vIdx] || ''} onChange={e => updateOptionInput(vIdx, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(vIdx) } }} style={{ ...inputStyle, fontSize: 13, padding: '9px 12px' }} />
                <button onClick={() => addOption(vIdx)} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(245,200,66,0.3)', background: 'rgba(245,200,66,0.08)', color: '#F5C842', cursor: 'pointer', fontSize: 13, fontFamily: 'DM Sans, sans-serif', flexShrink: 0 }}>+</button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'rgba(245,200,66,0.04)', borderRadius: 10, border: '1px solid rgba(245,200,66,0.2)' }}>

        </div>
        <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
          <button onClick={() => router.push('/admin/produits')} style={{ flex: 1, padding: '14px', borderRadius: 50, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#C8B99A', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 14 }}>Annuler</button>
          <button onClick={save} disabled={saving} style={{ flex: 2, padding: '14px', borderRadius: 50, border: 'none', background: 'linear-gradient(135deg,#F5C842,#FF6B20)', color: '#0A0804', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: 14 }}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
        </div>
      </div>
    </div>
  )
}