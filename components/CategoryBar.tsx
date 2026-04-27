'use client'
import { useCatalogue } from '@/store/catalogue'

type GroupeFilter = { id: string; label?: string; sous: { id: string; label?: string }[] }

export default function CategoryBar({ groupes }: { groupes: GroupeFilter[] }) {
  const { activeGroupe, activeSous, setGroupe, setSous, setHasSelected } = useCatalogue()
  const groupe = groupes.find(g => g.id === activeGroupe) ?? groupes[0]

  return (
    <div style={{ position: 'sticky', top: 60, zIndex: 40, background: 'rgba(8,6,3,0.97)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(232,160,32,0.1)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 20px' }}>

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', padding: '10px 0 8px' }}>
          {groupes.map(g => {
            const isActive = activeGroupe === g.id
            return (
              <button key={g.id} onClick={() => { setGroupe(g.id, g.sous[0]?.id || g.id); setHasSelected(true) }}
                style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 14px', borderRadius: 50, border: isActive ? '1px solid rgba(232,160,32,0.4)' : '1px solid rgba(255,255,255,0.07)', background: isActive ? 'rgba(232,160,32,0.1)' : 'transparent', color: isActive ? '#F5C842' : '#C8B99A', fontFamily: 'DM Sans, sans-serif', fontWeight: isActive ? 700 : 400, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' as const, flexShrink: 0 }}>
                {g.label ?? g.id}
              </button>
            )
          })}
        </div>

        {groupe?.sous && groupe.sous.length > 0 && (
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', scrollbarWidth: 'none', padding: '0 0 8px' }}>
            {groupe.sous.map(s => {
              const isActive = activeSous === s.id
              return (
                <button key={s.id} onClick={() => setSous(s.id)}
                  style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 12px', borderRadius: 50, border: 'none', background: isActive ? 'rgba(232,160,32,0.12)' : 'transparent', color: isActive ? '#E8A020' : '#666', fontFamily: 'DM Sans, sans-serif', fontWeight: isActive ? 600 : 400, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' as const, flexShrink: 0 }}>
                  {s.label ?? s.id}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
