'use client'
import { useEffect, useMemo, useRef, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PhoneInput from '@/components/PhoneInput'
import { buildWhatsAppHref } from '@/lib/phone-links'

const labelStyle = { fontSize: 11, fontWeight: 700, color: '#C8B99A', display: 'block', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.8px' }
const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(232,160,32,0.2)', background: 'rgba(255,255,255,0.03)', color: '#F5EDD6', fontSize: 13, outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' as const }

type Feature = { icon: string; title: string; desc: string }

type SettingsRow = {
  key: string
  value: string | null
}

const TABS = [
  { key: 'statut', label: 'Statut' },
  { key: 'identite', label: 'Identité' },
  { key: 'fond', label: 'Fond de page' },
  { key: 'hero', label: 'Image hero' },
  { key: 'arguments', label: 'Arguments' },
  { key: 'footer', label: 'Footer' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'devise', label: 'Devise et TVA' },
  { key: 'vip', label: 'Accès VIP' },
]


function normalizeVipPhone(value: string) {
  const raw = value.trim()
  if (!raw) return ''
  if (raw.startsWith('+')) return '+' + raw.replace(/[^\d]/g, '')
  if (raw.startsWith('00')) return '+' + raw.slice(2).replace(/[^\d]/g, '')
  return '+' + raw.replace(/[^\d]/g, '')
}

function parseVipAllowedPhones(value: string) {
  if (!value.trim()) return []

  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === 'string')
        .map(normalizeVipPhone)
        .filter(Boolean)
    }
  } catch {}

  return value
    .split(/[\n,;|]+/)
    .map(normalizeVipPhone)
    .filter(Boolean)
}

function uniqueVipPhones(values: string[]) {
  return Array.from(new Set(values.map(normalizeVipPhone).filter(Boolean)))
}

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
  const [tabDropOpen, setTabDropOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [siteName, setSiteName] = useState('Black Deew')
  const [siteBaseline, setSiteBaseline] = useState('')
  const [siteLogo, setSiteLogo] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoDimensions, setLogoDimensions] = useState<{w:number,h:number}|null>(null)
  const [siteLogoAdmin, setSiteLogoAdmin] = useState('')
  const [uploadingLogoAdmin, setUploadingLogoAdmin] = useState(false)
  const [siteLogoVip, setSiteLogoVip] = useState('')
  const [uploadingLogoVip, setUploadingLogoVip] = useState(false)
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
  const [taxEnabled, setTaxEnabled] = useState('false')
  const [taxRate, setTaxRate] = useState('')
  const [vipAccessEnabled, setVipAccessEnabled] = useState('false')
  const [vipAccessPassword, setVipAccessPassword] = useState('')
  const [vipAllowedPhones, setVipAllowedPhones] = useState('')
  const [vipPhoneDraft, setVipPhoneDraft] = useState('')
  const [vipPhoneInputKey, setVipPhoneInputKey] = useState(0)
  const [vipPhoneError, setVipPhoneError] = useState('')

  type VipAccessRequest = {
    id: string
    phone: string
    pseudo: string
    status: 'pending' | 'approved' | 'rejected'
    created_at: string
    requested_password: string | null
  }

  const [vipRequests, setVipRequests] = useState<VipAccessRequest[]>([])
  const [vipRequestsLoading, setVipRequestsLoading] = useState(false)
  const [vipRequestActionError, setVipRequestActionError] = useState('')
  const [approvedRequestIds, setApprovedRequestIds] = useState<Set<string>>(new Set())
  const [migratedPhones, setMigratedPhones] = useState<Set<string>>(new Set())

  type VipPasswordResetRequest = {
    id: string
    phone: string
    status: 'pending' | 'sent'
    created_at: string
  }

  const [vipResetRequests, setVipResetRequests] = useState<VipPasswordResetRequest[]>([])
  const [generatedResetLinks, setGeneratedResetLinks] = useState<Record<string, string>>({})
  const approvedRequestIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    approvedRequestIdsRef.current = approvedRequestIds
  }, [approvedRequestIds])
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const loadMigratedPhones = async () => {
      const { data } = await supabase.from('vip_individual_passwords').select('phone')
      const phones = ((data || []) as { phone: string }[]).map((row) =>
        row.phone.replace(/[^\d]/g, '').slice(-9)
      )
      setMigratedPhones(new Set(phones))
    }

    loadMigratedPhones()

    const migratedChannel = supabase
      .channel('settings-migrated-phones')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vip_individual_passwords' }, () => {
        loadMigratedPhones()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(migratedChannel)
    }
  }, [supabase])

  useEffect(() => {
    supabase.from('settings').select('*').then(({ data }) => {
      ;((data || []) as SettingsRow[]).forEach((s) => {
        const value = s.value ?? ''
        if (s.key === 'status') setStatus(value)
        if (s.key === 'status_message') setStatusMessage(value)
        if (s.key === 'hero_image') setHeroImage(value)
        if (s.key === 'background_image') setBackgroundImage(value)
        if (s.key === 'site_name') setSiteName(value)
        if (s.key === 'site_baseline') setSiteBaseline(value)
        if (s.key === 'site_description') setSiteDescription(value)
        if (s.key === 'site_logo') setSiteLogo(value)
        if (s.key === 'site_logo_admin') setSiteLogoAdmin(value)
        if (s.key === 'site_logo_vip') setSiteLogoVip(value)
        if (s.key === 'feature_1') { try { setFeature1(JSON.parse(value)) } catch {} }
        if (s.key === 'feature_1_active') setFeature1Active(value !== 'false')
        if (s.key === 'feature_2_active') setFeature2Active(value !== 'false')
        if (s.key === 'feature_3_active') setFeature3Active(value !== 'false')
        if (s.key === 'feature_2') { try { setFeature2(JSON.parse(value)) } catch {} }
        if (s.key === 'feature_3') { try { setFeature3(JSON.parse(value)) } catch {} }
        if (s.key === 'background_image_active') setBgImageActive(value)
        if (s.key === 'background_type') setBgType(value)
        if (s.key === 'background_color' && value) setBgColor(value)
        if (s.key === 'background_gradient_start' && value) setBgGradStart(value)
        if (s.key === 'background_gradient_end' && value) setBgGradEnd(value)
        if (s.key === 'background_gradient_dir' && value) setBgGradDir(value)
        if (s.key === 'notification_email') setNotificationEmail(value)
        if (s.key === 'footer_line1') setFooterLine1(value)
        if (s.key === 'footer_line2') setFooterLine2(value)
        if (s.key === 'footer_subtitle') setFooterSubtitle(value)
        if (s.key === 'footer_description') setFooterDescription(value)
        if (s.key === 'currency') setCurrency(value)
        if (s.key === 'tax_enabled') setTaxEnabled((s.value ?? '') || 'false')
        if (s.key === 'tax_rate') setTaxRate(s.value ?? '')
        if (s.key === 'vip_access_enabled') setVipAccessEnabled((s.value ?? '') || 'false')
        if (s.key === 'vip_access_password') setVipAccessPassword(s.value ?? '')
        if (s.key === 'vip_allowed_phones') setVipAllowedPhones(s.value ?? '')
      })
    })
  }, [supabase])

  const vipAllowedPhoneList = useMemo(() => parseVipAllowedPhones(vipAllowedPhones), [vipAllowedPhones])

  const addVipPhone = () => {
    const phone = normalizeVipPhone(vipPhoneDraft)
    const digits = phone.replace(/[^\d]/g, '')
    if (!phone || digits.length < 7) {
      setVipPhoneError('Numéro invalide. Saisissez un numéro complet (au moins 6 chiffres après l’indicatif).')
      return
    }
    setVipPhoneError('')
    setVipAllowedPhones(JSON.stringify(uniqueVipPhones([...vipAllowedPhoneList, phone])))
    setVipPhoneDraft('')
    setVipPhoneInputKey(k => k + 1)
  }

  const removeVipPhone = async (phone: string) => {
    const nextList = vipAllowedPhoneList.filter(item => item !== phone)
    setVipAllowedPhones(JSON.stringify(nextList))

    await supabase.from('settings').upsert({ key: 'vip_allowed_phones', value: JSON.stringify(nextList) })
  }

  const loadVipRequests = async () => {
    setVipRequestsLoading(true)
    const { data } = await supabase
      .from('vip_access_requests')
      .select('id,phone,pseudo,status,created_at,requested_password')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    const freshRequests = (data || []) as VipAccessRequest[]
    setVipRequests((prev) => {
      const freshIds = new Set(freshRequests.map((r) => r.id))
      const stillVisibleApproved = prev.filter(
        (r) => approvedRequestIdsRef.current.has(r.id) && !freshIds.has(r.id)
      )
      return [...freshRequests, ...stillVisibleApproved]
    })
    setVipRequestsLoading(false)
  }

  useEffect(() => {
    if (activeTab !== 'vip') return

    loadVipRequests()

    const vipRequestsChannel = supabase
      .channel('settings-vip-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vip_access_requests' }, () => {
        loadVipRequests()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(vipRequestsChannel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'vip') return

    loadVipResetRequests()

    const vipResetRequestsChannel = supabase
      .channel('settings-vip-reset-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vip_password_reset_requests' }, () => {
        loadVipResetRequests()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(vipResetRequestsChannel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const approveVipRequest = async (request: VipAccessRequest) => {
    setVipRequestActionError('')
    const phone = normalizeVipPhone(request.phone)
    const digits = phone.replace(/[^\d]/g, '')

    if (!phone || digits.length < 7) {
      setVipRequestActionError('Numéro de la demande invalide, impossible de valider automatiquement.')
      return
    }

    const { error: updateError } = await supabase
      .from('vip_access_requests')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', request.id)

    if (updateError) {
      setVipRequestActionError('Impossible de valider cette demande. Réessayez.')
      return
    }

    if (request.requested_password) {
      const { error: passwordError } = await supabase
        .from('vip_individual_passwords')
        .upsert(
          { phone, password: request.requested_password, updated_at: new Date().toISOString() },
          { onConflict: 'phone' }
        )

      if (passwordError) {
        setVipRequestActionError('Numéro autorisé, mais le mot de passe individuel n’a pas pu être enregistré.')
      }
    }

    const nextAllowedPhones = uniqueVipPhones([...vipAllowedPhoneList, phone])
    setVipAllowedPhones(JSON.stringify(nextAllowedPhones))

    const { error: allowedPhonesError } = await supabase
      .from('settings')
      .upsert({ key: 'vip_allowed_phones', value: JSON.stringify(nextAllowedPhones) })

    if (allowedPhonesError) {
      setVipRequestActionError('Mot de passe enregistré, mais le numéro n’a pas pu être activé. Réessayez.')
      return
    }

    setApprovedRequestIds((prev) => new Set(prev).add(request.id))
  }

  const rejectVipRequest = async (request: VipAccessRequest) => {
    setVipRequestActionError('')

    const { error: updateError } = await supabase
      .from('vip_access_requests')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', request.id)

    if (updateError) {
      setVipRequestActionError('Impossible de refuser cette demande. Réessayez.')
      return
    }

    setVipRequests((prev) => prev.filter((r) => r.id !== request.id))
  }

  const loadVipResetRequests = async () => {
    const { data } = await supabase
      .from('vip_password_reset_requests')
      .select('id,phone,status,created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setVipResetRequests((data || []) as VipPasswordResetRequest[])
  }

  const generateResetLink = async (request: VipPasswordResetRequest) => {
    const { data: tokenRow, error: insertError } = await supabase
      .from('vip_password_reset_tokens')
      .insert({ phone: request.phone })
      .select('token')
      .single()

    if (insertError || !tokenRow) {
      return
    }

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const resetUrl = `${baseUrl}/vip/reset?token=${tokenRow.token}`

    setGeneratedResetLinks((prev) => ({ ...prev, [request.id]: resetUrl }))

    await supabase
      .from('vip_password_reset_requests')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', request.id)
  }

  const dismissVipResetRequest = (requestId: string) => {
    setVipResetRequests((prev) => prev.filter((r) => r.id !== requestId))
    setGeneratedResetLinks((prev) => {
      const next = { ...prev }
      delete next[requestId]
      return next
    })
  }

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

  const uploadLogoAdmin = async (file: File) => {
    setSiteLogoAdmin(URL.createObjectURL(file))
    setUploadingLogoAdmin(true)
    const ext = file.name.split('.').pop()
    const fileName = `logo-admin-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('products').upload(fileName, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('products').getPublicUrl(fileName)
      setSiteLogoAdmin(data.publicUrl)
      await supabase.from('settings').upsert({ key: 'site_logo_admin', value: data.publicUrl })
    }
    setUploadingLogoAdmin(false)
  }

  const uploadLogoVip = async (file: File) => {
    setSiteLogoVip(URL.createObjectURL(file))
    setUploadingLogoVip(true)
    const ext = file.name.split('.').pop()
    const fileName = `logo-vip-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('products').upload(fileName, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('products').getPublicUrl(fileName)
      setSiteLogoVip(data.publicUrl)
      await supabase.from('settings').upsert({ key: 'site_logo_vip', value: data.publicUrl })
    }
    setUploadingLogoVip(false)
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
    setSaveError('')
    const saveResults = await Promise.all([
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
      supabase.from('settings').upsert({ key: 'tax_enabled', value: taxEnabled }),
      supabase.from('settings').upsert({ key: 'tax_rate', value: taxRate }),
      supabase.from('settings').upsert({ key: 'vip_access_enabled', value: vipAccessEnabled }),
      supabase.from('settings').upsert({ key: 'vip_access_password', value: vipAccessPassword }),
      supabase.from('settings').upsert({ key: 'vip_allowed_phones', value: JSON.stringify(vipAllowedPhoneList) }),
    ])
    const saveErrors = saveResults
      .map((result) => result.error?.message)
      .filter(Boolean)

    if (saveErrors.length > 0) {
      setSaving(false)
      setSaveError(saveErrors.join(' | '))
      return
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 900, color: '#F5EDD6', marginBottom: 20 }}>Paramètres</h1>
      {/* Dropdown custom navigation paramètres */}
      <div style={{ position: 'relative', marginBottom: 24 }}>
        <button
          onClick={() => setTabDropOpen(o => !o)}
          style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(232,160,32,0.25)', background: '#131009', color: '#F5EDD6', fontSize: 14, fontFamily: 'DM Sans, sans-serif', fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', outline: 'none' }}
        >
          <span>{TABS.find(t => t.key === activeTab)?.label || 'Statut'}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F5C842" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: tabDropOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {tabDropOpen && (
          <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: '#131009', border: '1px solid rgba(232,160,32,0.2)', borderRadius: 12, zIndex: 100, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => { router.push(`/admin/settings?tab=${t.key}`); setTabDropOpen(false) }}
                style={{ width: '100%', padding: '12px 16px', background: activeTab === t.key ? 'rgba(232,160,32,0.1)' : 'transparent', color: activeTab === t.key ? '#F5C842' : '#C8B99A', fontSize: 14, fontFamily: 'DM Sans, sans-serif', fontWeight: activeTab === t.key ? 700 : 400, cursor: 'pointer', border: 'none', textAlign: 'left' as const, borderBottom: '1px solid rgba(232,160,32,0.06)', outline: 'none' }}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
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
              <span role="img" aria-label="Logo" style={{ width: '320px', height: '320px', display: 'inline-block', backgroundImage: `url(${siteLogo})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
              <button onClick={() => setSiteLogo('')} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: '#F5EDD6', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Supprimer</button>
            </div>
          )}
          <label style={{ display: 'block', width: '100%', padding: '14px', borderRadius: 10, border: '1.5px dashed rgba(232,160,32,0.25)', background: 'rgba(232,160,32,0.03)', color: uploadingLogo ? '#C8B99A' : '#E8A020', cursor: uploadingLogo ? 'wait' : 'pointer', textAlign: 'center', fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' as const, marginBottom: 14 }}>
            {uploadingLogo ? 'Upload en cours...' : 'Choisir le logo (PNG recommandé)'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) uploadLogo(e.target.files[0]) }} />
            {logoDimensions && <div style={{ fontSize: 11, color: '#5BC57A', marginTop: 6 }}>✓ {logoDimensions.w} × {logoDimensions.h} px</div>}
          </label>
          <label style={labelStyle}>Logo Admin (icône app &amp; partage WhatsApp admin)</label>
          {siteLogoAdmin && (
            <div style={{ marginBottom: 12, borderRadius: 12, overflow: 'hidden', height: 160, background: '#0A0804', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <span role="img" aria-label="Logo Admin" style={{ width: '140px', height: '140px', display: 'inline-block', backgroundImage: `url(${siteLogoAdmin})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
              <button onClick={() => { setSiteLogoAdmin(''); supabase.from('settings').upsert({ key: 'site_logo_admin', value: '' }) }} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: '#F5EDD6', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Supprimer</button>
            </div>
          )}
          <label style={{ display: 'block', width: '100%', padding: '14px', borderRadius: 10, border: '1.5px dashed rgba(232,160,32,0.25)', background: 'rgba(232,160,32,0.03)', color: uploadingLogoAdmin ? '#C8B99A' : '#E8A020', cursor: uploadingLogoAdmin ? 'wait' : 'pointer', textAlign: 'center', fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' as const, marginBottom: 14 }}>
            {uploadingLogoAdmin ? 'Upload en cours...' : 'Choisir le logo admin (PNG recommandé)'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) uploadLogoAdmin(e.target.files[0]) }} />
          </label>

          <label style={labelStyle}>Logo VIP (partage WhatsApp page VIP)</label>
          {siteLogoVip && (
            <div style={{ marginBottom: 12, borderRadius: 12, overflow: 'hidden', height: 160, background: '#0A0804', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <span role="img" aria-label="Logo VIP" style={{ width: '140px', height: '140px', display: 'inline-block', backgroundImage: `url(${siteLogoVip})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
              <button onClick={() => { setSiteLogoVip(''); supabase.from('settings').upsert({ key: 'site_logo_vip', value: '' }) }} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: '#F5EDD6', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Supprimer</button>
            </div>
          )}
          <label style={{ display: 'block', width: '100%', padding: '14px', borderRadius: 10, border: '1.5px dashed rgba(232,160,32,0.25)', background: 'rgba(232,160,32,0.03)', color: uploadingLogoVip ? '#C8B99A' : '#E8A020', cursor: uploadingLogoVip ? 'wait' : 'pointer', textAlign: 'center', fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' as const, marginBottom: 14 }}>
            {uploadingLogoVip ? 'Upload en cours...' : 'Choisir le logo VIP (PNG recommandé)'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) uploadLogoVip(e.target.files[0]) }} />
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
                  <span role="img" aria-label="Background" style={{ width: '100%', height: '100%', display: 'inline-block', backgroundImage: `url(${backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
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
          <div style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 16 }}>Image Hero (page d&apos;accueil)</div>
          {heroImage && (
            <div style={{ marginBottom: 14, borderRadius: 12, overflow: 'hidden', height: 180, position: 'relative' }}>
              <span role="img" aria-label="Hero" style={{ width: '100%', height: '100%', display: 'inline-block', backgroundImage: `url(${heroImage})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
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
            Si vide, l&apos;email par défaut du serveur sera utilisé.
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

          {/* Bloc TVA */}
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(232,160,32,0.12)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 16 }}>TVA</div>

            <label style={labelStyle}>Appliquer la TVA</label>
            <button
              type="button"
              onClick={() => setTaxEnabled(taxEnabled === 'true' ? 'false' : 'true')}
              style={{ width: '100%', padding: '12px 18px', borderRadius: 50, border: '1px solid', borderColor: taxEnabled === 'true' ? 'rgba(91,197,122,0.5)' : 'rgba(255,255,255,0.1)', background: taxEnabled === 'true' ? 'rgba(91,197,122,0.12)' : 'rgba(255,255,255,0.04)', color: taxEnabled === 'true' ? '#5BC57A' : '#7A6E58', fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 18 }}
            >
              TVA {taxEnabled === 'true' ? 'ACTIVE' : 'INACTIVE'}
            </button>

            <label style={labelStyle}>Taux de TVA global (%)</label>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.1"
              value={taxRate}
              onChange={e => setTaxRate(e.target.value)}
              placeholder="Ex : 16"
              style={inputStyle}
            />
            <div style={{ fontSize: 11, color: '#7A6E58', marginTop: 8, lineHeight: 1.5, fontFamily: 'DM Sans, sans-serif' }}>
              Les prix affichés restent des prix TTC. La TVA est extraite du TTC et n&apos;est détaillée que dans les récapitulatifs (panier, facture). Les produits VIP ne sont ni facturables ni taxables.
            </div>
          </div>
        </div>
      )}

      {activeTab === 'vip' && (
        <div style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.12)', borderRadius: 16, padding: '22px 24px', marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 16 }}>Accès VIP</div>


          {vipRequestActionError && (
            <div style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,107,107,0.25)', background: 'rgba(255,107,107,0.08)', color: '#FF6B6B', fontSize: 12, fontFamily: 'DM Sans, sans-serif', lineHeight: 1.45, marginBottom: 16 }}>
              {vipRequestActionError}
            </div>
          )}

          <div style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10 }}>
            Demandes en attente ({vipRequests.length})
          </div>

          {vipRequestsLoading ? (
            <div style={{ padding: 14, borderRadius: 12, border: '1px dashed rgba(232,160,32,0.18)', color: '#7A6E58', fontSize: 12, fontFamily: 'DM Sans, sans-serif', marginBottom: 20 }}>
              Chargement des demandes...
            </div>
          ) : vipRequests.length === 0 ? (
            <div style={{ padding: 14, borderRadius: 12, border: '1px dashed rgba(232,160,32,0.18)', color: '#7A6E58', fontSize: 12, fontFamily: 'DM Sans, sans-serif', marginBottom: 20 }}>
              Aucune demande en attente.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {vipRequests.map((request) => (
                <div key={request.id} style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(232,160,32,0.15)', background: 'rgba(255,255,255,0.025)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div>
                      <div style={{ color: '#F5EDD6', fontSize: 13, fontFamily: 'DM Sans, sans-serif', fontWeight: 700 }}>{request.pseudo}</div>
                      <div style={{ color: '#C8B99A', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}>{request.phone}</div>
                    </div>
                    {approvedRequestIds.has(request.id) && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#5BC57A', background: 'rgba(91,197,122,0.12)', padding: '4px 10px', borderRadius: 50 }}>
                        Validé
                      </span>
                    )}
                  </div>

                  {!approvedRequestIds.has(request.id) ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <a href={buildWhatsAppHref(request.phone, `Bonjour ${request.pseudo}, votre accès VIP a été validé. Mot de passe : ${request.requested_password || vipAccessPassword}`, { defaultCountryCode: 'CD' }) || '#'}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => approveVipRequest(request)}
                        style={{ flex: 1, textAlign: 'center', textDecoration: 'none', padding: '8px 10px', borderRadius: 50, border: '1px solid rgba(91,197,122,0.4)', background: 'rgba(91,197,122,0.1)', color: '#5BC57A', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                      >
                        Valider par WhatsApp
                      </a>
                      <button
                        type="button"
                        onClick={() => rejectVipRequest(request)}
                        style={{ flex: 1, padding: '8px 10px', borderRadius: 50, border: '1px solid rgba(255,107,107,0.25)', background: 'rgba(255,107,107,0.08)', color: '#FF6B6B', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                      >
                        Refuser
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {vipRequests.length > 0 && (
            <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(232,160,32,0.06)', color: '#C8B99A', fontSize: 11, fontFamily: 'DM Sans, sans-serif', lineHeight: 1.5, marginBottom: 22 }}>
              Le numéro est activé automatiquement après validation.
              Pensez à cliquer sur « Enregistrer » pour appliquer les autres modifications en attente sur cette page.
            </div>
          )}

          <label style={labelStyle}>Activation de l’accès VIP</label>
          <button
            type="button"
            onClick={() => setVipAccessEnabled(vipAccessEnabled === 'true' ? 'false' : 'true')}
            style={{ width: '100%', padding: '12px 18px', borderRadius: 50, border: '1px solid', borderColor: vipAccessEnabled === 'true' ? 'rgba(91,197,122,0.5)' : 'rgba(255,255,255,0.1)', background: vipAccessEnabled === 'true' ? 'rgba(91,197,122,0.12)' : 'rgba(255,255,255,0.04)', color: vipAccessEnabled === 'true' ? '#5BC57A' : '#7A6E58', fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 18 }}
          >
            Accès VIP {vipAccessEnabled === 'true' ? 'ACTIF' : 'INACTIF'}
          </button>

          <label style={labelStyle}>Mot de passe commun VIP</label>
          <input
            type="text"
            value={vipAccessPassword}
            onChange={e => setVipAccessPassword(e.target.value)}
            placeholder="Ex : VIP2026"
            style={{ ...inputStyle, marginBottom: 18 }}
          />

          <label style={labelStyle}>Ajouter un numéro autorisé</label>
          <div style={{ marginBottom: 10 }}>
            <PhoneInput defaultCountryCode="CD" key={vipPhoneInputKey} value={vipPhoneDraft} onChange={(v) => { setVipPhoneError(''); setVipPhoneDraft(v) }} />
          </div>

          {vipPhoneError && (
            <div style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,107,107,0.25)', background: 'rgba(255,107,107,0.08)', color: '#FF6B6B', fontSize: 12, fontFamily: 'DM Sans, sans-serif', lineHeight: 1.45, marginBottom: 10 }}>
              {vipPhoneError}
            </div>
          )}

          <button
            type="button"
            onClick={addVipPhone}
            style={{ width: '100%', padding: '11px 14px', borderRadius: 50, border: '1px solid rgba(232,160,32,0.25)', background: 'rgba(232,160,32,0.08)', color: '#E8A020', fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: 13, cursor: 'pointer', marginBottom: 16 }}
          >
            Ajouter ce numéro
          </button>

          <div style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10 }}>Numéros autorisés ({vipAllowedPhoneList.length})</div>

          {vipAllowedPhoneList.length === 0 ? (
            <div style={{ padding: 14, borderRadius: 12, border: '1px dashed rgba(232,160,32,0.18)', color: '#7A6E58', fontSize: 12, fontFamily: 'DM Sans, sans-serif', marginBottom: 8 }}>
              Aucun numéro autorisé pour le moment.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {vipAllowedPhoneList.map((phoneValue) => {
                const hasMigrated = migratedPhones.has(phoneValue.replace(/[^\d]/g, '').slice(-9))
                const resetRequest = vipResetRequests.find((r) => r.phone.replace(/[^\d]/g, '').slice(-9) === phoneValue.replace(/[^\d]/g, '').slice(-9))
                const link = resetRequest ? generatedResetLinks[resetRequest.id] : undefined
                return (
                  <div key={phoneValue} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(232,160,32,0.12)', background: 'rgba(255,255,255,0.025)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#F5EDD6', fontSize: 13, fontFamily: 'DM Sans, sans-serif', fontWeight: 700 }}>
                        {hasMigrated && (
                          <span title="Mot de passe personnel défini" style={{ color: '#5BC57A', fontSize: 13 }}>✓</span>
                        )}
                        {phoneValue}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeVipPhone(phoneValue)}
                        style={{ padding: '6px 10px', borderRadius: 50, border: '1px solid rgba(255,107,107,0.25)', background: 'rgba(255,107,107,0.08)', color: '#FF6B6B', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                      >
                        Supprimer
                      </button>
                    </div>

                    {resetRequest && (
                      !link ? (
                        <button
                          type="button"
                          onClick={() => generateResetLink(resetRequest)}
                          style={{ padding: '7px 10px', borderRadius: 50, border: '1px solid rgba(232,160,32,0.25)', background: 'rgba(232,160,32,0.08)', color: '#E8A020', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                        >
                          Mot de passe oublié — Générer mot de passe
                        </button>
                      ) : (
                        <a
                          href={buildWhatsAppHref(resetRequest.phone, `Bonjour, voici votre lien pour redéfinir votre mot de passe VIP (valable 1 heure) : ${link}`, { defaultCountryCode: 'CD' }) || '#'}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => dismissVipResetRequest(resetRequest.id)}
                          style={{ display: 'block', textAlign: 'center', padding: '7px 10px', borderRadius: 50, border: '1px solid rgba(91,197,122,0.4)', background: 'rgba(91,197,122,0.12)', color: '#5BC57A', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', textDecoration: 'none', boxSizing: 'border-box' }}
                        >
                          Envoyer le lien par WhatsApp
                        </a>
                      )
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div style={{ fontSize: 11, color: '#7A6E58', lineHeight: 1.5, fontFamily: 'DM Sans, sans-serif', marginTop: 12 }}>
            Ce champ reprend le même composant téléphone que la commande client. Les numéros sont enregistrés sous forme de liste propre.
          </div>
        </div>
      )}

      {saveError && (
        <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,107,107,0.25)', background: 'rgba(255,107,107,0.08)', color: '#FF6B6B', fontSize: 12, fontFamily: 'DM Sans, sans-serif', lineHeight: 1.45 }}>
          {saveError}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <button id="vip-save-button" onClick={save} disabled={saving} style={{ width: '100%', padding: '14px', background: saved ? 'rgba(91,197,122,0.15)' : 'linear-gradient(135deg,#F5C842,#FF6B20)', color: saved ? '#5BC57A' : '#0A0804', border: saved ? '1px solid rgba(91,197,122,0.3)' : 'none', borderRadius: 50, fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: 14, cursor: saving ? 'wait' : 'pointer', transition: 'box-shadow 0.3s ease' }}>
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
