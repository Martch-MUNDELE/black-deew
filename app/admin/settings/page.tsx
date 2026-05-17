'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const labelStyle = { fontSize: 11, fontWeight: 700, color: '#C8B99A', display: 'block', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.8px' }
const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(232,160,32,0.2)', background: 'rgba(255,255,255,0.03)', color: '#F5EDD6', fontSize: 13, outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' as const }

type Feature = { icon: string; title: string; desc: string }

const TABS = [
  { key: 'statut', label: 'Statut' },
  { key: 'identite', label: 'Identité' },
  { key: 'fond', label: 'Fond de page' },
  { key: 'hero', label: 'Image hero' },
  { key: 'arguments', label: 'Arguments' },
  { key: 'footer', label: 'Footer' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'devise', label: 'Devise' },
]

const ICON_OPTIONS = [
  { value: 'chef', label: 'Toque — Chef' },
  { value: 'delivery', label: 'Scooter — Livraison' },
  { value: 'fresh', label: 'Panier — Frais' },
  { value: 'star', label: 'Étoile' },
  { value: 'clock', label: 'Horloge' },
  { value: 'heart', label: 'Cœur' },
  { value: 'shield', label: 'Bouclier qualité' },
  { value: 'fire', label: 'Flamme' },
]

function SettingsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeTab = searchParams.get('tab') || 'statut'

  const [status, setStatus] = useState('open')
  const [statusMessage, setStatusMessage] = useState('')
  const [heroImage, setHeroImage] = useState('')
  const [uploading, setUploading] = useState(false)
  const [backgroundImage, setBackgroundImage] = useState('')
  const [uploadingBackground, setUploadingBackground] = useState(false)
  const [bgImageActive, setBgImageActive] = useState('true')
  const [bgType, setBgType] = useState('color')
  const [bgColor, setBgColor] = useState('#0A0804')
  const [bgGradStart, setBgGradStart] = useState('#0A0804')
  const [bgGradEnd, setBgGradEnd] = useState('#1a0a02')
  const [bgGradDir, setBgGradDir] = useState('to bottom')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [siteName, setSiteName] = useState('Black Deew')
  const [siteBaseline, setSiteBaseline] = useState('AGADIR · LIVRAISON')
  const [siteLogo, setSiteLogo] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoDimensions, setLogoDimensions] = useState<{w:number,h:number}|null>(null)
  const [feature1, setFeature1] = useState<Feature>({ icon: 'chef', title: 'Préparé à Kinshasa', desc: 'Par chez vous à Kinshasa, repas cuisinés avec soin par nos équipes.' })
  const [feature2, setFeature2] = useState<Feature>({ icon: 'delivery', title: 'Livraison rapide', desc: 'On vous livre rapidement et directement à votre porte.' })
  const [feature3, setFeature3] = useState<Feature>({ icon: 'fresh', title: 'Frais du jour', desc: 'Profitez de produits toujours frais, choisis chaque jour.' })
  const [feature1Active, setFeature1Active] = useState(true)
  const [feature2Active, setFeature2Active] = useState(true)
  const [feature3Active, setFeature3Active] = useState(true)
  const [siteDescription, setSiteDescription] = useState('')
  const [notificationEmail, setNotificationEmail] = useState('')
  const [footerLine1, setFooterLine1] = useState('Livraison à')
  const [footerLine2, setFooterLine2] = useState('Kinshasa.')
  const [footerSubtitle, setFooterSubtitle] = useState('Directement chez toi.')
  const [footerDescription, setFooterDescription] = useState('Plats chauds, boissons fraîches et snacks livrés rapidement.')
  const [currency, setCurrency] = useState('DH')
  const supabase = createClient()

  useEffect(() => {
    supabase.from('settings').select('*').then(({ data }) => {
      data?.forEach((s: any) => {
        if (s.key === 'status') setStatus(s.value)
        if (s.key === 'status_message') setStatusMessage(s.value)
        if (s.key === 'hero_image') setHeroImage(s.value)
        if (s.key === 'background_image') setBackgroundImage(s.value)
        if (s.key === 'site_name') setSiteName(s.value)
        if (s.key === 'site_baseline') setSiteBaseline(s.value)
        if (s.key === 'site_description') setSiteDescription(s.value)
        if (s.key === 'site_logo') setSiteLogo(s.value)
        if (s.key === 'feature_1') { try { setFeature1(JSON.parse(s.value)) } catch {} }
        if (s.key === 'feature_1_active') setFeature1Active(s.value !== 'false')
        if (s.key === 'feature_2_active') setFeature2Active(s.value !== 'false')
        if (s.key === 'feature_3_active') setFeature3Active(s.value !== 'false')
        if (s.key === 'feature_2') { try { setFeature2(JSON.parse(s.value)) } catch {} }
        if (s.key === 'feature_3') { try { setFeature3(JSON.parse(s.value)) } catch {} }
        if (s.key === 'background_image_active') setBgImageActive(s.value)
        if (s.key === 'background_type') setBgType(s.value)
        if (s.key === 'background_color' && s.value) setBgColor(s.value)
        if (s.key === 'background_gradient_start' && s.value) setBgGradStart(s.value)
        if (s.key === 'background_gradient_end' && s.value) setBgGradEnd(s.value)
        if (s.key === 'background_gradient_dir' && s.value) setBgGradDir(s.value)
        if (s.key === 'notification_email') setNotificationEmail(s.value)
        if (s.key === 'footer_line1') setFooterLine1(s.value)
        if (s.key === 'footer_line2') setFooterLine2(s.value)
        if (s.key === 'footer_subtitle') setFooterSubtitle(s.value)
        if (s.key === 'footer_description') setFooterDescription(s.value)
        if (s.key === 'currency') setCurrency(s.value)
      })
    })
  }, [])

  const uploadLogo = async (file: File) => {
    const previewUrl = URL.createObjectURL(file)
    setSiteLogo(previewUrl)
    const img = new Image()
    img.onload = () => setLogoDimensions({w: img.naturalWidth, h: img.naturalHeight})
    img.src = previewUrl
    setUploadingLogo(true)
    const ext = file.name.split('.').pop()
    const fileName = `logo-black-deew-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('products').upload(fileName, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('products').getPublicUrl(fileName)
      setSiteLogo(data.publicUrl)
      await supabase.from('settings').upsert({ key: 'site_logo', value: data.publicUrl })
    }
    setUploadingLogo(false)
  }

  const uploadBackgroundImage = async (file: File) => {
    setUploadingBackground(true)
    const ext = file.name.split('.').pop()
    const fileName = `background-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('products').upload(fileName, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('products').getPublicUrl(fileName)
      setBackgroundImage(data.publicUrl)
    }
    setUploadingBackground(false)
  }

  const uploadHeroImage = async (file: File) => {
    setUploading(true)
    const ext = file.name.split('.').pop()
    const fileName = `hero-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('products').upload(fileName, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('products').getPublicUrl(fileName)
      setHeroImage(data.publicUrl + '?t=' + Date.now())
      await supabase.from('settings').upsert({ key: 'hero_image', value: data.publicUrl })
    }
    setUploading(false)
  }

  const save = async () => {
    setSaving(true)
    await Promise.all([
      supabase.from('settings').upsert({ key: 'status', value: status }),
      supabase.from('settings').upsert({ key: 'status_message', value: statusMessage }),
      supabase.from('settings').upsert({ key: 'hero_image', value: heroImage }),
      supabase.from('settings').upsert({ key: 'background_image', value: backgroundImage }),
      supabase.from('settings').upsert({ key: 'site_name', value: siteName }),
      supabase.from('settings').upsert({ key: 'site_baseline', value: siteBaseline }),
      supabase.from('settings').upsert({ key: 'site_description', value: siteDescription }),
      supabase.from('settings').upsert({ key: 'site_logo', value: siteLogo }),
      supabase.from('settings').upsert({ key: 'feature_1', value: JSON.stringify(feature1) }),
      supabase.from('settings').upsert({ key: 'feature_1_active', value: String(feature1Active) }),
      supabase.from('settings').upsert({ key: 'feature_2_active', value: String(feature2Active) }),
      supabase.from('settings').upsert({ key: 'feature_3_active', value: String(feature3Active) }),
      supabase.from('settings').upsert({ key: 'feature_2', value: JSON.stringify(feature2) }),
      supabase.from('settings').upsert({ key: 'feature_3', value: JSON.stringify(feature3) }),
      supabase.from('settings').upsert({ key: 'background_image_active', value: bgImageActive }),
      supabase.from('settings').upsert({ key: 'background_type', value: bgType }),
      supabase.from('settings').upsert({ key: 'background_color', value: bgColor }),
      supabase.from('settings').upsert({ key: 'background_gradient_start', value: bgGradStart }),
      supabase.from('settings').upsert({ key: 'background_gradient_end', value: bgGradEnd }),
      supabase.from('settings').upsert({ key: 'background_gradient_dir', value: bgGradDir }),
      supabase.from('settings').upsert({ key: 'notification_email', value: notificationEmail }),
      supabase.from('settings').upsert({ key: 'footer_line1', value: footerLine1 }),
      supabase.from('settings').upsert({ key: 'footer_line2', value: footerLine2 }),
      supabase.from('settings').upsert({ key: 'footer_subtitle', value: footerSubtitle }),
      supabase.from('settings').upsert({ key: 'footer_description', value: footerDescription }),
      supabase.from('settings').upsert({ key: 'currency', value: currency }),
    ])
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 900, color: '#F5EDD6', marginBottom: 20 }}>Paramètres</h1>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 24, paddingBottom: 4 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => router.push(`/admin/settings?tab=${t.key}`)} style={{ padding: '8px 14px', borderRadius: 50, border: '1px solid', borderColor: activeTab === t.key ? 'rgba(232,160,32,0.4)' : 'rgba(232,160,32,0.12)', background: activeTab === t.key ? 'rgba(232,160,32,0.12)' : 'transparent', color: activeTab === t.key ? '#E8A020' : '#C8B99A', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' as const }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'statut' && (
        <div style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.12)', borderRadius: 16, padding: '22px 24px', marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 16 }}>Statut du service</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
            <button onClick={() => setStatus('open')} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid', borderColor: status === 'open' ? 'rgba(91,197,122,0.4)' : 'rgba(255,255,255,0.06)', background: status === 'open' ? 'rgba(91,197,122,0.12)' : 'transparent', color: status === 'open' ? '#5BC57A' : '#C8B99A', fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Ouvert</button>
            <button onClick={() => setStatus('closed')} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid', borderColor: status === 'closed' ? 'rgba(255,107,107,0.4)' : 'rgba(255,255,255,0.06)', background: status === 'closed' ? 'rgba(255,107,107,0.12)' : 'transparent', color: status === 'closed' ? '#FF6B6B' : '#C8B99A', fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Fermé</button>
          </div>
          <label style={labelStyle}>Message affiché aux clients</label>
          <input type="text" value={statusMessage} onChange={e => setStatusMessage(e.target.value)} placeholder="Ex: Fermé · Reprise bientôt..." style={inputStyle} />
        </div>
      )}

      {activeTab === 'identite' && (
        <div style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.12)', borderRadius: 16, padding: '22px 24px', marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 16 }}>Identité du site</div>
          <label style={labelStyle}>Logo</label>
          {siteLogo && (
            <div style={{ marginBottom: 12, borderRadius: 12, overflow: 'hidden', height: 350, background: '#0A0804', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <img src={siteLogo} alt="Logo" style={{ width: '320px', height: '320px', objectFit: 'contain' }} />
              <button onClick={() => setSiteLogo('')} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: '#F5EDD6', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Supprimer</button>
            </div>
          )}
          <label style={{ display: 'block', width: '100%', padding: '14px', borderRadius: 10, border: '1.5px dashed rgba(232,160,32,0.25)', background: 'rgba(232,160,32,0.03)', color: uploadingLogo ? '#C8B99A' : '#E8A020', cursor: uploadingLogo ? 'wait' : 'pointer', textAlign: 'center', fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' as const, marginBottom: 14 }}>
            {uploadingLogo ? 'Upload en cours...' : 'Choisir le logo (PNG recommandé)'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) uploadLogo(e.target.files[0]) }} />
            {logoDimensions && <div style={{ fontSize: 11, color: '#5BC57A', marginTop: 6 }}>✓ {logoDimensions.w} × {logoDimensions.h} px</div>}
          </label>
          <label style={labelStyle}>Nom du site</label>
          <input type="text" value={siteName} onChange={e => setSiteName(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />
          <label style={labelStyle}>Baseline</label>
          <input type="text" value={siteBaseline} onChange={e => setSiteBaseline(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />
          <label style={labelStyle}>Description (WhatsApp / réseaux sociaux)</label>
          <textarea value={siteDescription} onChange={e => setSiteDescription(e.target.value)} rows={3} placeholder="Ex: Livraison de plats chauds à Kinshasa, directement chez vous." style={{ ...inputStyle, resize: 'vertical' as const }} />
        </div>
      )}

      {activeTab === 'fond' && (
        <div style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.12)', borderRadius: 16, padding: '22px 24px', marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 16 }}>Fond de page</div>
          <label style={labelStyle}>Image de fond active</label>
          <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
            <button onClick={() => setBgImageActive('true')} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid', borderColor: bgImageActive === 'true' ? 'rgba(91,197,122,0.4)' : 'rgba(255,255,255,0.06)', background: bgImageActive === 'true' ? 'rgba(91,197,122,0.12)' : 'transparent', color: bgImageActive === 'true' ? '#5BC57A' : '#C8B99A', fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Oui</button>
            <button onClick={() => setBgImageActive('false')} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid', borderColor: bgImageActive === 'false' ? 'rgba(255,107,107,0.4)' : 'rgba(255,255,255,0.06)', background: bgImageActive === 'false' ? 'rgba(255,107,107,0.12)' : 'transparent', color: bgImageActive === 'false' ? '#FF6B6B' : '#C8B99A', fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Non</button>
          </div>
          {bgImageActive === 'true' && (
            <>
              {backgroundImage && (
                <div style={{ marginBottom: 14, borderRadius: 12, overflow: 'hidden', height: 120, position: 'relative' }}>
                  <img src={backgroundImage} alt="Background" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button onClick={() => setBackgroundImage('')} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: '#F5EDD6', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Supprimer</button>
                </div>
              )}
              <label style={{ display: 'block', width: '100%', padding: '18px', borderRadius: 10, border: '1.5px dashed rgba(232,160,32,0.25)', background: 'rgba(232,160,32,0.03)', color: uploadingBackground ? '#C8B99A' : '#E8A020', cursor: uploadingBackground ? 'wait' : 'pointer', textAlign: 'center', fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' as const }}>
                {uploadingBackground ? 'Upload en cours...' : 'Choisir une photo depuis votre tel ou ordinateur'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) uploadBackgroundImage(e.target.files[0]) }} />
              </label>
            </>
          )}
          {bgImageActive === 'false' && (
            <>
              <label style={labelStyle}>Type de fond</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                {(['color', 'gradient'] as const).map(t => (
                  <button key={t} onClick={() => setBgType(t)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid', borderColor: bgType === t ? 'rgba(232,160,32,0.5)' : 'rgba(255,255,255,0.06)', background: bgType === t ? 'rgba(232,160,32,0.1)' : 'transparent', color: bgType === t ? '#E8A020' : '#C8B99A', fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    {t === 'color' ? 'Couleur unie' : 'Dégradé'}
                  </button>
                ))}
              </div>
              {bgType === 'color' && (
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Couleur de fond</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} style={{ width: 48, height: 40, borderRadius: 8, border: '1px solid rgba(232,160,32,0.2)', background: 'transparent', cursor: 'pointer', padding: 2 }} />
                    <span style={{ color: '#C8B99A', fontSize: 13, fontFamily: 'DM Sans, sans-serif' }}>{bgColor}</span>
                  </div>
                </div>
              )}
              {bgType === 'gradient' && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Couleur début</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="color" value={bgGradStart} onChange={e => setBgGradStart(e.target.value)} style={{ width: 44, height: 38, borderRadius: 8, border: '1px solid rgba(232,160,32,0.2)', background: 'transparent', cursor: 'pointer', padding: 2 }} />
                        <span style={{ color: '#C8B99A', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}>{bgGradStart}</span>
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Couleur fin</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="color" value={bgGradEnd} onChange={e => setBgGradEnd(e.target.value)} style={{ width: 44, height: 38, borderRadius: 8, border: '1px solid rgba(232,160,32,0.2)', background: 'transparent', cursor: 'pointer', padding: 2 }} />
                        <span style={{ color: '#C8B99A', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}>{bgGradEnd}</span>
                      </div>
                    </div>
                  </div>
                  <label style={labelStyle}>Direction</label>
                  <select value={bgGradDir} onChange={e => setBgGradDir(e.target.value)} style={inputStyle}>
                    <option value="to bottom">Vers le bas</option>
                    <option value="to right">Vers la droite</option>
                    <option value="135deg">Diagonal</option>
                  </select>
                </div>
              )}
              <div style={{ marginTop: 14 }}>
                <label style={labelStyle}>Aperçu</label>
                <div style={{ height: 60, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: bgType === 'color' ? bgColor : `linear-gradient(${bgGradDir}, ${bgGradStart}, ${bgGradEnd})` }} />
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'hero' && (
        <div style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.12)', borderRadius: 16, padding: '22px 24px', marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 16 }}>Image Hero (page d'accueil)</div>
          {heroImage && (
            <div style={{ marginBottom: 14, borderRadius: 12, overflow: 'hidden', height: 180, position: 'relative' }}>
              <img src={heroImage} alt="Hero" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button onClick={() => setHeroImage('')} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: '#F5EDD6', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Supprimer</button>
            </div>
          )}
          <label style={{ display: 'block', width: '100%', padding: '18px', borderRadius: 10, border: '1.5px dashed rgba(232,160,32,0.25)', background: 'rgba(232,160,32,0.03)', color: uploading ? '#C8B99A' : '#E8A020', cursor: uploading ? 'wait' : 'pointer', textAlign: 'center', fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' as const }}>
            {uploading ? 'Upload en cours...' : 'Choisir une photo depuis votre tel ou ordinateur'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) uploadHeroImage(e.target.files[0]) }} />
          </label>
        </div>
      )}

      {activeTab === 'arguments' && (
        <div style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.12)', borderRadius: 16, padding: '22px 24px', marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 16 }}>Arguments produit</div>
          {([
            { feat: feature1, setFeat: setFeature1, label: 'Argument 1', active: feature1Active, setActive: setFeature1Active },
            { feat: feature2, setFeat: setFeature2, label: 'Argument 2', active: feature2Active, setActive: setFeature2Active },
            { feat: feature3, setFeat: setFeature3, label: 'Argument 3', active: feature3Active, setActive: setFeature3Active },
          ] as const).map(({ feat, setFeat, label, active, setActive }, idx) => (
            <div key={label} style={{ marginBottom: idx < 2 ? 20 : 0, paddingBottom: idx < 2 ? 20 : 0, borderBottom: idx < 2 ? '1px solid rgba(232,160,32,0.08)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#E8A020' }}>{label}</div>
                <button onClick={() => setActive(!active)} style={{ padding: '4px 14px', borderRadius: 50, border: '1px solid', borderColor: active ? 'rgba(91,197,122,0.4)' : 'rgba(255,107,107,0.4)', background: active ? 'rgba(91,197,122,0.12)' : 'rgba(255,107,107,0.12)', color: active ? '#5BC57A' : '#FF6B6B', fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                  {active ? 'ON' : 'OFF'}
                </button>
              </div>
              <label style={labelStyle}>Icône</label>
              <select value={feat.icon} onChange={e => setFeat({ ...feat, icon: e.target.value })} style={{ ...inputStyle, marginBottom: 10, cursor: 'pointer' }}>
                {ICON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <label style={labelStyle}>Titre</label>
              <input type="text" value={feat.title} onChange={e => setFeat({ ...feat, title: e.target.value })} style={{ ...inputStyle, marginBottom: 10 }} />
              <label style={labelStyle}>Description</label>
              <textarea value={feat.desc} onChange={e => setFeat({ ...feat, desc: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' as const }} />
            </div>
          ))}
        </div>
      )}

      {activeTab === 'footer' && (
        <div style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.12)', borderRadius: 16, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', letterSpacing: '1px', textTransform: 'uppercase' }}>Texte footer homepage</div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#C8B99A', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>Ligne 1</label>
            <input type="text" value={footerLine1} onChange={e => setFooterLine1(e.target.value)} style={{ width: '100%', padding: '13px 16px', borderRadius: 12, border: '1.5px solid rgba(232,160,32,0.15)', background: 'rgba(255,255,255,0.03)', color: '#F5EDD6', fontFamily: 'DM Sans, sans-serif', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#C8B99A', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>Ligne 2</label>
            <input type="text" value={footerLine2} onChange={e => setFooterLine2(e.target.value)} style={{ width: '100%', padding: '13px 16px', borderRadius: 12, border: '1.5px solid rgba(232,160,32,0.15)', background: 'rgba(255,255,255,0.03)', color: '#F5EDD6', fontFamily: 'DM Sans, sans-serif', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#C8B99A', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>Sous-titre</label>
            <input type="text" value={footerSubtitle} onChange={e => setFooterSubtitle(e.target.value)} style={{ width: '100%', padding: '13px 16px', borderRadius: 12, border: '1.5px solid rgba(232,160,32,0.15)', background: 'rgba(255,255,255,0.03)', color: '#F5EDD6', fontFamily: 'DM Sans, sans-serif', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#C8B99A', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>Description</label>
            <textarea value={footerDescription} onChange={e => setFooterDescription(e.target.value)} rows={3} style={{ width: '100%', padding: '13px 16px', borderRadius: 12, border: '1.5px solid rgba(232,160,32,0.15)', background: 'rgba(255,255,255,0.03)', color: '#F5EDD6', fontFamily: 'DM Sans, sans-serif', fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box' as const }} />
          </div>
        </div>
      )}
      {activeTab === 'notifications' && (
        <div style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.12)', borderRadius: 16, padding: '22px 24px', marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 16 }}>Notifications commandes</div>
          <label style={labelStyle}>Email de notification (nouvelles commandes)</label>
          <input
            type="email"
            value={notificationEmail}
            onChange={e => setNotificationEmail(e.target.value)}
            placeholder="ex: contact@black-deew.com"
            style={inputStyle}
          />
          <div style={{ fontSize: 11, color: '#7A6E58', marginTop: 8, fontFamily: 'DM Sans, sans-serif' }}>
            Si vide, l'email par défaut du serveur sera utilisé.
          </div>
        </div>
      )}

      {activeTab === 'devise' && (
        <div style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.12)', borderRadius: 16, padding: '22px 24px', marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 16 }}>Devise affichée</div>
          <label style={labelStyle}>Sélectionner la devise</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginTop: 4 }}>
            {(['DH', 'USD', 'FC', 'EUR', 'XOF', 'GBP'] as const).map(opt => (
              <button key={opt} onClick={() => setCurrency(opt)} style={{ padding: '9px 20px', borderRadius: 50, border: '1px solid', borderColor: currency === opt ? 'rgba(232,160,32,0.5)' : 'rgba(255,255,255,0.08)', background: currency === opt ? 'rgba(232,160,32,0.12)' : 'transparent', color: currency === opt ? '#E8A020' : '#C8B99A', cursor: 'pointer', fontSize: 13, fontWeight: currency === opt ? 700 : 500, fontFamily: 'DM Sans, sans-serif' }}>
                {opt}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#7A6E58', marginTop: 10, fontFamily: 'DM Sans, sans-serif' }}>
            Devise actuellement sélectionnée : <strong style={{ color: '#E8A020' }}>{currency}</strong>
          </div>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <button onClick={save} disabled={saving} style={{ width: '100%', padding: '14px', background: saved ? 'rgba(91,197,122,0.15)' : 'linear-gradient(135deg,#F5C842,#FF6B20)', color: saved ? '#5BC57A' : '#0A0804', border: saved ? '1px solid rgba(91,197,122,0.3)' : 'none', borderRadius: 50, fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: 14, cursor: saving ? 'wait' : 'pointer' }}>
          {saved ? 'Enregistré ✓' : saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}

export default function SettingsAdmin() {
  return (
    <Suspense fallback={<div style={{ color: '#C8B99A', padding: 40 }}>Chargement...</div>}>
      <SettingsContent />
    </Suspense>
  )
}
