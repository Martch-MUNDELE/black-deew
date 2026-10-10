'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
export type VipPendingDetail = { access: number; reset: number; total: number }
/**
 * Demandes VIP au statut "pending" (acces + reinitialisation de mot de passe),
 * mises a jour en direct. channelName doit etre unique par instance du hook.
 */
export function useVipPendingDetail(channelName: string): VipPendingDetail {
  const [detail, setDetail] = useState<VipPendingDetail>({ access: 0, reset: 0, total: 0 })
  useEffect(() => {
    const sb = createClient()
    let active = true
    const refresh = async () => {
      try {
        const [access, reset] = await Promise.all([
          sb.from('vip_access_requests').select('id').eq('status', 'pending'),
          sb.from('vip_password_reset_requests').select('id').eq('status', 'pending'),
        ])
        const a = (access.data || []).length
        const r = (reset.data || []).length
        if (active) setDetail({ access: a, reset: r, total: a + r })
      } catch {
        // compteur indicatif : un echec reseau ne doit jamais casser l'admin
      }
    }
    refresh()
    const ch = sb
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vip_access_requests' }, () => { refresh() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vip_password_reset_requests' }, () => { refresh() })
      .subscribe()
    return () => {
      active = false
      sb.removeChannel(ch)
    }
  }, [channelName])
  return detail
}
/** Compteur cumule (acces + reinitialisation) : logique de comptage inchangee. */
export function useVipPendingCount(channelName: string): number {
  return useVipPendingDetail(channelName).total
}
