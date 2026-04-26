'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active:   { bg: 'rgba(91,197,122,0.1)',  color: '#5BC57A' },
  blocked:  { bg: 'rgba(255,107,107,0.1)', color: '#FF6B6B' },
  suspended:{ bg: 'rgba(255,107,32,0.1)',  color: '#FF6B20' },
  deleted:  { bg: 'rgba(122,110,88,0.1)',  color: '#C8B99A' },
}

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  superadmin: { bg: 'rgba(245,200,66,0.15)', color: '#F5C842' },
  admin:      { bg: 'rgba(56,182,255,0.1)',  color: '#38B6FF' },
}

function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}


function FacturationOverview() {
  const [stats, setStats] = useState<{ totalDu: number; totalPaye: number; impayes: number } | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: periods } = await supabase
        .from('billing_periods')
        .select('status, total_due, total_paid')

      if (!periods) return

      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)

      const totalDu = periods
        .filter(p => p.status === 'en_cours' || p.status === 'cloture' || p.status === 'facture')
        .reduce((s, p) => s + (p.total_due || 0), 0)

      const totalPaye = periods
        .filter(p => p.status === 'paye')
        .reduce((s, p) => s + (p.total_paid || 0), 0)

      const impayes = periods.filter(p => p.status === 'facture').length

      setStats({ totalDu, totalPaye, impayes })
    }
    load()
  }, [])

  const fmt = (n: number) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD`

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
      {[
        { label: 'Total dû', value: stats ? fmt(stats.totalDu) : '...', note: 'Périodes en cours + facturées', color: '#F5C842' },
        { label: 'Total encaissé', value: stats ? fmt(stats.totalPaye) : '...', note: 'Périodes payées', color: '#5BC57A' },
        { label: 'Impayés', value: stats ? String(stats.impayes) : '...', note: stats?.impayes ? 'Périodes facturées non réglées' : 'Aucun impayé', color: stats?.impayes ? '#FF6B6B' : '#5BC57A' },
      ].map(stat => (
        <div key={stat.label} style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.1)', borderRadius: 14, padding: '16px 18px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#C8B99A', textTransform: 'uppercase' as const, letterSpacing: '0.8px', marginBottom: 8 }}>{stat.label}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: stat.color, marginBottom: 4 }}>{stat.value}</div>
          <div style={{ fontSize: 11, color: '#7A6E58' }}>{stat.note}</div>
        </div>
      ))}
    </div>
  )
}

export default function SuperAdminPage() {
  const [admins, setAdmins] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [credentials, setCredentials] = useState<Record<string, string>>({})
  const [tab, setTab] = useState<'admins' | 'logs' | 'facturation'>('admins')
  const [showNew, setShowNew] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [autoGen, setAutoGen] = useState(true)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [showPwd, setShowPwd] = useState<Record<string, boolean>>({})
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [purging, setPurging] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace('/admin'); return }
      setCurrentUser(data.user)
      const { data: admin } = await supabase
        .from('admins')
        .select('role')
        .eq('email', data.user.email)
        .single()
      if (admin?.role !== 'superadmin') { router.replace('/admin'); return }
      load()
    })
  }, [])

  const load = async () => {
    const [{ data: a }, { data: l }, { data: c }] = await Promise.all([
      supabase.from('admins').select('*').order('created_at', { ascending: false }),
      supabase.from('admin_logs').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('admin_credentials').select('*'),
    ])
    setAdmins(a || [])
    setLogs(l || [])
    const cmap: Record<string, string> = {}
    ;(c || []).forEach((x: any) => { cmap[x.admin_id] = x.temp_password })
    setCredentials(cmap)
  }

  const logAction = async (action: string, targetEmail?: string, details?: string) => {
    await supabase.from('admin_logs').insert({
      action,
      performed_by: currentUser?.email || 'superadmin',
      target_email: targetEmail || null,
      details: details || null,
    })
  }

  const purgeCommandes = async () => {
    if (!confirm('⚠️ Supprimer TOUTES les commandes ? Cette action est irréversible.')) return
    if (!confirm('Dernière confirmation — vraiment tout effacer ?')) return
    setPurging(true)
    try {
      const res = await fetch('/api/superadmin/purge-commandes', { method: 'POST' })
      if (!res.ok) throw new Error('Erreur API')
      await logAction('PURGE_COMMANDES', undefined, 'Toutes les commandes et order_items supprimés, slots remis à zéro')
      setMsg('✅ Toutes les commandes ont été supprimées et les créneaux remis à zéro.')
    } catch (e) {
      setMsg('❌ Erreur lors de la purge')
    }
    setPurging(false)
  }

  const createAdmin = async () => {
    if (!newEmail) return
    const pwd = autoGen ? generatePassword() : newPassword
    if (!pwd || pwd.length < 8) { setMsg('Mot de passe trop court (min 8 caractères)'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/superadmin/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, password: pwd, performedBy: currentUser?.email }),
      })
      const data = await res.json()
      if (data.error) { setMsg(data.error); return }
      setMsg(`✅ Admin créé — Mot de passe : ${pwd}`)
      setShowNew(false)
      setNewEmail('')
      setNewPassword('')
      load()
    } catch (e) { setMsg('Erreur création') }
    setLoading(false)
  }

  const blockAdmin = async (admin: any) => {
    if (!confirm(`Bloquer ${admin.email} ?`)) return
    await fetch('/api/superadmin/block', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminId: admin.id, performedBy: currentUser?.email }) })
    await load()
  }

  const unblockAdmin = async (admin: any) => {
    await fetch('/api/superadmin/unblock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminId: admin.id, performedBy: currentUser?.email }) })
    await load()
  }

  const resetPassword = async (admin: any) => {
    if (!confirm(`Réinitialiser le mot de passe de ${admin.email} ?`)) return
    const newPwd = generatePassword()
    await fetch('/api/superadmin/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminId: admin.id, newPassword: newPwd, performedBy: currentUser?.email }) })
    setMsg(`🔑 Nouveau mot de passe pour ${admin.email} : ${newPwd}`)
    await load()
  }

  const deleteAdmin = async (admin: any) => {
    if (!confirm(`Supprimer définitivement ${admin.email} ? Cette action est irréversible.`)) return
    await fetch('/api/superadmin/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminId: admin.id, performedBy: currentUser?.email }) })
    await load()
  }

  const sendCredentials = async (admin: any) => {
    const pwd = credentials[admin.id]
    if (!pwd) { setMsg('Aucun mot de passe temporaire disponible'); return }
    await fetch('/api/superadmin/send-credentials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: admin.email, password: pwd }) })
    setMsg(`📧 Identifiants envoyés à ${admin.email}`)
  }

  const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(232,160,32,0.2)', background: 'rgba(255,255,255,0.03)', color: '#F5EDD6', fontSize: 13, outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' as const }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, fontWeight: 900, color: '#F5C842', margin: 0 }}>Super Admin</h1>
          <div style={{ fontSize: 11, color: '#C8B99A', marginTop: 4 }}>Accès restreint · {currentUser?.email}</div>
        </div>
        {tab === 'admins' && (
          <button onClick={() => { setShowNew(true); if (autoGen) setNewPassword(generatePassword()) }} style={{ padding: '9px 18px', borderRadius: 50, border: 'none', background: 'linear-gradient(135deg,#F5C842,#FF6B20)', color: '#0A0804', fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
            + Nouvel admin
          </button>
        )}
      </div>

      {/* MESSAGE */}
      {msg && (
        <div style={{ background: 'rgba(232,160,32,0.08)', border: '1px solid rgba(232,160,32,0.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#F5C842', fontFamily: 'DM Sans, sans-serif', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{msg}</span>
          <button onClick={() => setMsg('')} style={{ background: 'none', border: 'none', color: '#C8B99A', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
      )}

      {/* MODAL NOUVEL ADMIN */}
      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.2)', borderRadius: 20, width: '100%', maxWidth: 440, padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, color: '#F5EDD6', margin: 0 }}>Nouvel administrateur</h2>
              <button onClick={() => setShowNew(false)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 50, width: 32, height: 32, color: '#C8B99A', cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Email</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="admin@example.com" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#C8B99A', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Mot de passe</label>
                <button onClick={() => setAutoGen(v => !v)} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 50, border: '1px solid rgba(232,160,32,0.2)', background: autoGen ? 'rgba(232,160,32,0.1)' : 'transparent', color: autoGen ? '#E8A020' : '#C8B99A', cursor: 'pointer', fontWeight: 600 }}>
                  {autoGen ? 'Auto' : 'Manuel'}
                </button>
                {autoGen && <button onClick={() => setNewPassword(generatePassword())} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 50, border: '1px solid rgba(232,160,32,0.1)', background: 'transparent', color: '#C8B99A', cursor: 'pointer' }}>↻ Générer</button>}
              </div>
              {autoGen ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(232,160,32,0.2)', background: 'rgba(232,160,32,0.04)', color: '#F5C842', fontSize: 13, fontFamily: 'monospace', letterSpacing: 1 }}>{newPassword || '—'}</div>
                  <button onClick={() => { navigator.clipboard.writeText(newPassword); setMsg('Mot de passe copié !') }} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(232,160,32,0.15)', background: 'transparent', color: '#E8A020', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Copier</button>
                </div>
              ) : (
                <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 8 caractères" style={inputStyle} />
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowNew(false)} style={{ flex: 1, padding: '11px', borderRadius: 50, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#C8B99A', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 13 }}>Annuler</button>
              <button onClick={createAdmin} disabled={loading} style={{ flex: 2, padding: '11px', borderRadius: 50, border: 'none', background: 'linear-gradient(135deg,#F5C842,#FF6B20)', color: '#0A0804', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: 13 }}>
                {loading ? 'Création...' : 'Créer l\'admin'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ZONE DANGER — masquée sur l'onglet facturation */}
      {tab !== 'facturation' && (
        <div style={{ background: 'rgba(255,107,107,0.04)', border: '1px solid rgba(255,107,107,0.15)', borderRadius: 16, padding: '18px 20px', marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#FF6B6B', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 12 }}>⚠️ Zone danger</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F5EDD6', marginBottom: 2 }}>Purger toutes les commandes</div>
              <div style={{ fontSize: 11, color: '#C8B99A' }}>Supprime toutes les commandes, les items et remet les créneaux à zéro. Irréversible.</div>
            </div>
            <button onClick={purgeCommandes} disabled={purging} style={{ flexShrink: 0, padding: '9px 18px', borderRadius: 50, border: '1px solid rgba(255,107,107,0.4)', background: 'rgba(255,107,107,0.08)', color: '#FF6B6B', fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: 12, cursor: purging ? 'not-allowed' : 'pointer', opacity: purging ? 0.6 : 1, whiteSpace: 'nowrap' }}>
              {purging ? 'Purge...' : '🗑 Purger'}
            </button>
          </div>
        </div>
      )}

      {/* TABS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {([
          { key: 'admins', label: `Administrateurs (${admins.filter(a => a.status !== 'deleted').length})` },
          { key: 'logs', label: 'Journal' },
          { key: 'facturation', label: 'Facturation plateforme' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '7px 16px', borderRadius: 50, border: '1px solid', borderColor: tab === t.key ? 'rgba(232,160,32,0.4)' : 'rgba(232,160,32,0.12)', background: tab === t.key ? 'rgba(232,160,32,0.12)' : 'transparent', color: tab === t.key ? '#E8A020' : '#C8B99A', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* LISTE ADMINS */}
      {tab === 'admins' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {admins.filter(a => a.status !== 'deleted').map(admin => {
            const sc = STATUS_COLORS[admin.status] || STATUS_COLORS.active
            const rc = ROLE_COLORS[admin.role] || ROLE_COLORS.admin
            const pwd = credentials[admin.id]
            return (
              <div key={admin.id} style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.1)', borderRadius: 14, padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#F5EDD6', marginBottom: 4 }}>{admin.email}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 50, background: rc.bg, color: rc.color }}>{admin.role}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 50, background: sc.bg, color: sc.color }}>{admin.status}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: '#A89880', textAlign: 'right' }}>
                    <div>Créé {new Date(admin.created_at).toLocaleDateString('fr-FR')}</div>
                    {admin.last_login && <div>Connecté {new Date(admin.last_login).toLocaleDateString('fr-FR')}</div>}
                  </div>
                </div>
                {pwd && admin.role !== 'superadmin' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '8px 12px', background: 'rgba(232,160,32,0.04)', border: '1px solid rgba(232,160,32,0.1)', borderRadius: 8 }}>
                    <span style={{ fontSize: 11, color: '#C8B99A' }}>Mot de passe :</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: showPwd[admin.id] ? '#F5C842' : '#A89880', letterSpacing: 1 }}>
                      {showPwd[admin.id] ? pwd : '••••••••••••'}
                    </span>
                    <button onClick={() => setShowPwd(p => ({ ...p, [admin.id]: !p[admin.id] }))} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 50, border: '1px solid rgba(232,160,32,0.15)', background: 'transparent', color: '#C8B99A', cursor: 'pointer' }}>
                      {showPwd[admin.id] ? 'Masquer' : 'Voir'}
                    </button>
                    <button onClick={() => { navigator.clipboard.writeText(pwd); setMsg('Copié !') }} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 50, border: '1px solid rgba(232,160,32,0.15)', background: 'transparent', color: '#E8A020', cursor: 'pointer' }}>Copier</button>
                  </div>
                )}
                {admin.role !== 'superadmin' && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {admin.status === 'active' ? (
                      <button onClick={() => blockAdmin(admin)} style={{ padding: '5px 12px', borderRadius: 50, border: '1px solid rgba(255,107,107,0.25)', background: 'rgba(255,107,107,0.06)', color: '#FF6B6B', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Bloquer</button>
                    ) : admin.status === 'blocked' ? (
                      <button onClick={() => unblockAdmin(admin)} style={{ padding: '5px 12px', borderRadius: 50, border: '1px solid rgba(91,197,122,0.25)', background: 'rgba(91,197,122,0.06)', color: '#5BC57A', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Débloquer</button>
                    ) : null}
                    <button onClick={() => resetPassword(admin)} style={{ padding: '5px 12px', borderRadius: 50, border: '1px solid rgba(232,160,32,0.2)', background: 'rgba(232,160,32,0.06)', color: '#E8A020', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Reset pwd</button>
                    <button onClick={() => sendCredentials(admin)} style={{ padding: '5px 12px', borderRadius: 50, border: '1px solid rgba(56,182,255,0.2)', background: 'rgba(56,182,255,0.06)', color: '#38B6FF', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Envoyer par mail</button>
                    <button onClick={() => deleteAdmin(admin)} style={{ padding: '5px 12px', borderRadius: 50, border: '1px solid rgba(255,107,107,0.15)', background: 'transparent', color: '#C8B99A', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Supprimer</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* JOURNAL */}
      {tab === 'logs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {logs.map(log => (
            <div key={log.id} style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.08)', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 50, background: 'rgba(232,160,32,0.08)', color: '#E8A020', marginRight: 8 }}>{log.action}</span>
                {log.target_email && <span style={{ fontSize: 12, color: '#C8B890' }}>{log.target_email}</span>}
                {log.details && <div style={{ fontSize: 11, color: '#C8B99A', marginTop: 4 }}>{log.details}</div>}
              </div>
              <div style={{ fontSize: 10, color: '#A89880', textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                <div>{new Date(log.created_at).toLocaleDateString('fr-FR')}</div>
                <div>{new Date(log.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
          ))}
          {logs.length === 0 && <div style={{ textAlign: 'center', color: '#C8B99A', padding: '40px 0', fontSize: 14 }}>Aucune action enregistrée</div>}
        </div>
      )}

      {/* FACTURATION PLATEFORME */}
      {tab === 'facturation' && (
        <div>
          <FacturationOverview />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { title: 'Clients & Contrats', desc: 'Gérer les contrats, modes de rémunération et règles variables par client.', href: '/admin/superadmin/facturation/contrats', ready: true },
              { title: 'Périodes de facturation', desc: 'Consulter, clôturer et marquer les périodes comme facturées ou payées.', href: '/admin/superadmin/facturation/periodes', ready: true },
              { title: 'Ajustements', desc: 'Ajouter des remises, avoirs, corrections ou frais sur une période donnée.', href: '/admin/superadmin/facturation/ajustements', ready: true },
            ].map(section => (
              section.ready ? (
                <a key={section.title} href={section.href} style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.15)', borderRadius: 14, padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#F5EDD6', marginBottom: 4 }}>{section.title}</div>
                    <div style={{ fontSize: 11, color: '#C8B99A' }}>{section.desc}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 50, background: 'rgba(91,197,122,0.1)', color: '#5BC57A', whiteSpace: 'nowrap', marginLeft: 16 }}>Accéder →</span>
                </a>
              ) : (
                <div key={section.title} style={{ background: '#131009', border: '1px solid rgba(232,160,32,0.08)', borderRadius: 14, padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.5 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#F5EDD6', marginBottom: 4 }}>{section.title}</div>
                    <div style={{ fontSize: 11, color: '#C8B99A' }}>{section.desc}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 50, background: 'rgba(232,160,32,0.08)', color: '#E8A020', whiteSpace: 'nowrap', marginLeft: 16 }}>Bientôt</span>
                </div>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
