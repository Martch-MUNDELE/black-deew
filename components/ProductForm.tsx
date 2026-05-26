'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ImageUpload from '@/components/ImageUpload'
import { useCurrency } from '@/lib/currency'

export type Variant = { type: string; options: string[]; prices?: Record<string, number> }

export type ProductFormData = {
  name: string
  description: string
  ingredients: string
  price: number
  subcategory: string
  image_url: string
  active: boolean
  discount: number | null
  is_vip: boolean
}

type MenuCategoryRow = {
  id: string
  slug: string
  name: string
  level: number
  parent_id: string | null
}

type ProductFormFieldKey = 'name' | 'description' | 'ingredients' | 'price'

type ProductFormField = {
  key: ProductFormFieldKey
  label: string
  type: 'text' | 'number'
}

const PRODUCT_FIELDS: ProductFormField[] = [
  { key: 'name', label: 'Nom', type: 'text' },
  { key: 'description', label: 'Description', type: 'text' },
  { key: 'ingredients', label: 'Ingrédients', type: 'text' },
  { key: 'price', label: 'Prix', type: 'number' },
]

const FALLBACK_SUBCATS = [
  { slug: 'chaudes', name: 'Boissons Chaudes' },
  { slug: 'froides', name: 'Boissons Froides' },
  { slug: 'sandwichs_chauds', name: 'Sandwichs Chauds' },
  { slug: 'sandwichs_froids', name: 'Sandwichs Froids' },
  { slug: 'salades', name: 'Salades' },
]

export const inputStyle: React.CSSProperties = {
  width: '100%', padding: '13px 14px', borderRadius: 12,
  border: '1px solid rgba(232,160,32,0.2)', background: 'rgba(255,255,255,0.03)',
  color: '#F5EDD6', fontSize: 16, outline: 'none',
  fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box',
}

export const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#C8B99A', display: 'block',
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px',
}

type Props = {
  form: ProductFormData
  setForm: React.Dispatch<React.SetStateAction<ProductFormData>>
  variants: Variant[]
  setVariants: React.Dispatch<React.SetStateAction<Variant[]>>
  newOptionInputs: string[]
  setNewOptionInputs: React.Dispatch<React.SetStateAction<string[]>>
}

export default function ProductForm({
  form, setForm, variants, setVariants, newOptionInputs, setNewOptionInputs,
}: Props) {
  const supabase = useMemo(() => createClient(), [])
  const currency = useCurrency()
  const [subcats, setSubcats] = useState<{ slug: string; name: string; label: string }[]>(
    FALLBACK_SUBCATS.map(s => ({ ...s, label: s.name }))
  )
  const [variantsOpen, setVariantsOpen] = useState(true)

  useEffect(() => {
    supabase.from('menu_categories').select('slug,name,level,parent_id,id')
      .eq('active', true).order('display_order')
      .then(({ data }) => {
        if (!data || data.length === 0) return

        const categories = data as MenuCategoryRow[]
        const l0 = categories.filter((c) => c.level === 0)
        const l1 = categories.filter((c) => c.level === 1)
        const options: { slug: string; name: string; label: string }[] = []

        l0.forEach((g) => {
          const children = l1.filter((s) => s.parent_id === g.id)
          if (children.length === 0) {
            options.push({ slug: g.slug, name: g.name, label: g.name })
          } else {
            children.forEach((s) =>
              options.push({ slug: s.slug, name: s.name, label: `${g.name} - ${s.name}` })
            )
          }
        })

        if (options.length > 0) setSubcats(options)
      })
  }, [supabase])

  const addVariantType = () => {
    setVariants(v => [...v, { type: '', options: [] }])
    setNewOptionInputs(i => [...i, ''])
  }
  const updateVariantType = (idx: number, val: string) =>
    setVariants(v => v.map((vt, i) => i === idx ? { ...vt, type: val } : vt))
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
  const removeOption = (vIdx: number, oIdx: number) =>
    setVariants(v => v.map((vt, i) =>
      i === vIdx ? { ...vt, options: vt.options.filter((_, j) => j !== oIdx) } : vt
    ))
  const updateOptionInput = (idx: number, val: string) =>
    setNewOptionInputs(i => i.map((v, j) => j === idx ? val : v))
  const updateOptionPrice = (vIdx: number, opt: string, price: number | null) => {
    setVariants(v => v.map((vt, i) => {
      if (i !== vIdx) return vt
      const prices = { ...(vt.prices || {}) }
      if (price === null || isNaN(price as number)) { delete prices[opt] }
      else { prices[opt] = price as number }
      return { ...vt, prices }
    }))
  }

  const promoOn = typeof form.discount === 'number' && form.discount > 0
  const discountedPreview = promoOn ? Math.ceil(form.price * (1 - (form.discount as number) / 100)) : null
  const savingsPreview = discountedPreview !== null ? form.price - discountedPreview : null

  return (
    <>
      {PRODUCT_FIELDS.map(f => (

        <div key={f.key}>
          <label style={labelStyle}>{f.key === 'price' ? `Prix (${currency})` : f.label}</label>
          <input
            type={f.type}
            value={form[f.key] ?? ''}
            onChange={e => setForm(p => ({
              ...p,
              [f.key]: f.type === 'number' ? parseFloat(e.target.value) : e.target.value,
            }))}
            style={inputStyle}
          />
        </div>
      ))}

      <div>
        <label style={labelStyle}>Image</label>
        <ImageUpload imageUrl={form.image_url} onUpload={url => setForm(f => ({ ...f, image_url: url }))} />
      </div>

      <div>
        <label style={labelStyle}>Sous-catégorie</label>
        <select
          value={form.is_vip ? 'vip' : form.subcategory}
          onChange={e => {
            if (e.target.value === 'vip') { setForm(f => ({ ...f, is_vip: true })) }
            else { setForm(f => ({ ...f, is_vip: false, subcategory: e.target.value })) }
          }}
          style={{ width: '100%', padding: '13px 14px', borderRadius: 12, border: '1px solid rgba(232,160,32,0.2)', background: '#0E0B06', color: '#F5EDD6', fontSize: 14, outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' as const, cursor: 'pointer' }}
        >
          {subcats.map(s => <option key={s.slug} value={s.slug}>{s.label}</option>)}
          <option value="vip">VIP — visible uniquement sur /vip</option>
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(232,160,32,0.1)' }}>
        <input type="checkbox" id="active" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} style={{ accentColor: '#E8A020', width: 18, height: 18 }} />
        <label htmlFor="active" style={{ fontSize: 14, color: '#C8B890', cursor: 'pointer' }}>Produit actif (visible sur le site)</label>
      </div>

      <div style={{ background: 'rgba(245,200,66,0.04)', border: '1px solid rgba(245,200,66,0.15)', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setVariantsOpen(o => !o)} style={{ background: 'none', border: 'none', color: '#F5C842', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}>{variantsOpen ? '▾' : '▸'}</button>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F5EDD6', fontFamily: 'DM Sans, sans-serif' }}>Variantes {variants.length > 0 ? '(' + variants.length + ')' : ''}</div>
              {!variantsOpen && <div style={{ fontSize: 11, color: '#7A6E58', marginTop: 2 }}>Taille, goût, couleur...</div>}
            </div>
          </div>
          {variantsOpen && <button onClick={addVariantType} style={{ padding: '7px 14px', borderRadius: 20, border: '1px solid rgba(245,200,66,0.4)', background: 'rgba(245,200,66,0.08)', color: '#F5C842', cursor: 'pointer', fontSize: 12, fontFamily: 'DM Sans, sans-serif', fontWeight: 700 }}>+ Ajouter</button>}
        </div>
        {variantsOpen && variants.map((vt, vIdx) => (
          <div key={vIdx} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px', border: '1px solid rgba(245,200,66,0.1)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input placeholder="Type (ex: Taille, Goût...)" value={vt.type} onChange={e => updateVariantType(vIdx, e.target.value)} style={{ ...inputStyle, fontSize: 13, padding: '9px 12px' }} />
              <button onClick={() => removeVariant(vIdx)} style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,80,80,0.3)', background: 'rgba(255,80,80,0.06)', color: '#FF8080', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
              {vt.options.map((opt, oIdx) => (
                <div key={oIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(245,200,66,0.06)', border: '1px solid rgba(245,200,66,0.18)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#F5C842', fontFamily: 'DM Sans, sans-serif', marginBottom: 6 }}>{opt}</div>
                    <input type="number" inputMode="decimal" placeholder="Prix spécifique (optionnel)" value={vt.prices?.[opt] ?? ''} onChange={e => updateOptionPrice(vIdx, opt, e.target.value === '' ? null : parseFloat(e.target.value))} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(245,200,66,0.3)', background: 'rgba(0,0,0,0.3)', color: '#F5C842', fontSize: 13, outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' as const }} />
                    <div style={{ fontSize: 10, color: '#7A6E58', marginTop: 4, fontFamily: 'DM Sans, sans-serif' }}>Laisser vide = prix principal</div>
                  </div>
                  <span onClick={() => removeOption(vIdx, oIdx)} style={{ cursor: 'pointer', color: '#7A6E58', fontWeight: 700, fontSize: 16, paddingTop: 2, flexShrink: 0 }}>×</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input placeholder="Ajouter une option..." value={newOptionInputs[vIdx] || ''} onChange={e => updateOptionInput(vIdx, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(vIdx) } }} style={{ ...inputStyle, fontSize: 13, padding: '9px 12px' }} />
              <button onClick={() => addOption(vIdx)} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(245,200,66,0.3)', background: 'rgba(245,200,66,0.08)', color: '#F5C842', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>+</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: 'rgba(255,80,80,0.04)', border: '1px solid rgba(255,80,80,0.15)', borderRadius: 12, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F5EDD6', fontFamily: 'DM Sans, sans-serif' }}>Promotion</div>
            <div style={{ fontSize: 11, color: '#7A6E58', marginTop: 2 }}>Réduction sur ce produit</div>
          </div>
          <div onClick={() => setForm(f => ({ ...f, discount: promoOn ? null : 10 }))} style={{ width: 44, height: 24, borderRadius: 12, background: promoOn ? 'rgba(255,80,80,0.3)' : 'rgba(255,255,255,0.08)', border: promoOn ? '1px solid rgba(255,80,80,0.5)' : '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 3, left: promoOn ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: promoOn ? '#FF5050' : '#555' }} />
          </div>
        </div>
        {promoOn && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={labelStyle}>Réduction (%)</label>
              <input type="number" min={5} max={80} value={form.discount ?? ''} onChange={e => { const v = parseInt(e.target.value); setForm(f => ({ ...f, discount: isNaN(v) ? 5 : Math.min(80, Math.max(5, v)) })) }} style={inputStyle} />
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
    </>
  )
}
