'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import ProductForm, { ProductFormData, Variant } from '@/components/ProductForm'

export default function ModifierProduit() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const [form, setForm] = useState<ProductFormData>({
    name: '', description: '', ingredients: '', price: 0,
    subcategory: 'sandwichs_chauds', image_url: '', active: true,
    discount: null, is_vip: false,
  })
  const [variants, setVariants] = useState<Variant[]>([])
  const [newOptionInputs, setNewOptionInputs] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('products').select('*').eq('id', params.id).single().then(({ data }) => {
      if (data) {
        setForm({
          name: data.name || '', description: data.description || '',
          ingredients: data.ingredients || '', price: data.price || 0,
          subcategory: data.subcategory || 'sandwichs_chauds',
          image_url: data.image_url || '', active: data.active ?? true,
          discount: data.discount ?? null, is_vip: data.is_vip ?? false,
        })
        if (data.variants && Array.isArray(data.variants)) {
          const normalized = data.variants.map((v: any) => ({
            ...v,
            prices: v.prices
              ? Object.fromEntries(Object.entries(v.prices).map(([k, val]) => [k, Number(val)]))
              : undefined,
          }))
          setVariants(normalized)
          setNewOptionInputs(data.variants.map(() => ''))
        }
      }
    })
  }, [])

  const save = async () => {
    setSaving(true)
    const cleanVariants = variants.filter(v => v.type.trim() && v.options.length > 0)
    const { error } = await supabase.from('products').update({
      ...form,
      variants: cleanVariants.length > 0 ? cleanVariants : null,
    }).eq('id', params.id)
    if (error) { alert('Erreur: ' + error.message); setSaving(false); return }
    window.location.href = '/admin/produits'
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 0 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.push('/admin/produits')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 14px', color: '#C8B99A', cursor: 'pointer', fontSize: 13, fontFamily: 'DM Sans, sans-serif' }}>← Retour</button>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 900, color: '#F5EDD6', margin: 0 }}>Modifier le produit</h1>
      </div>
      <div style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.12)', borderRadius: 16, padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ProductForm
          form={form} setForm={setForm}
          variants={variants} setVariants={setVariants}
          newOptionInputs={newOptionInputs} setNewOptionInputs={setNewOptionInputs}
        />
        <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
          <button onClick={() => router.push('/admin/produits')} style={{ flex: 1, padding: '14px', borderRadius: 50, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#C8B99A', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>Annuler</button>
          <button onClick={save} disabled={saving} style={{ flex: 2, padding: '14px', borderRadius: 50, border: 'none', background: 'linear-gradient(135deg,#F5C842,#FF6B20)', color: '#0A0804', cursor: 'pointer', fontWeight: 800, fontSize: 14 }}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
        </div>
      </div>
    </div>
  )
}
