'use client'

import { useState } from 'react'
import PhoneInput from '@/components/PhoneInput'
import { createClient } from '@/lib/supabase/client'

type VipPasswordResetRequestFormProps = {
  defaultCountryCode?: string
  onSubmitted?: () => void
}

/**
 * Formulaire "Mot de passe perdu" cote client VIP (BF-P2-007).
 *
 * Affiche en option sous le formulaire de connexion VIP (VipAccessGate),
 * derriere un lien "Mot de passe perdu ?". Permet a un client qui a deja
 * acces (mot de passe individuel) mais l'a oublie de signaler sa demande.
 * L'admin genere ensuite un lien de regeneration envoye par WhatsApp.
 */
export default function VipPasswordResetRequestForm({
  defaultCountryCode = 'CD',
  onSubmitted,
}: VipPasswordResetRequestFormProps) {
  const supabase = createClient()
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const submit = async () => {
    setError('')

    const digits = phone.replace(/[^\d]/g, '')

    if (!phone || digits.length < 7) {
      setError('Veuillez saisir un numero de telephone valide.')
      return
    }

    setLoading(true)

    const last9 = digits.slice(-9)

    const { data: existingRequests } = await supabase
      .from('vip_password_reset_requests')
      .select('id,phone,status')
      .eq('status', 'pending')

    const hasPendingRequest = (existingRequests || []).some((request: { phone: string }) =>
      request.phone.replace(/[^\d]/g, '').slice(-9) === last9
    )

    if (hasPendingRequest) {
      setLoading(false)
      setError('Une demande est deja en attente pour ce numero.')
      return
    }

    const { error: insertError } = await supabase.from('vip_password_reset_requests').insert({
      phone,
      status: 'pending',
    })

    setLoading(false)

    if (insertError) {
      setError('Impossible d’envoyer votre demande. Reessayez dans quelques instants.')
      return
    }

    setSuccess(true)
    onSubmitted?.()
  }

  if (success) {
    return (
      <div
        style={{
          background: 'rgba(91,197,122,0.1)',
          border: '1px solid rgba(91,197,122,0.3)',
          borderRadius: 14,
          padding: '18px 20px',
          color: '#5BC57A',
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 13,
          lineHeight: 1.5,
          textAlign: 'center',
        }}
      >
        Votre demande a bien ete envoyee. Vous recevrez un lien par WhatsApp pour redefinir votre mot de passe.
      </div>
    )
  }

  return (
    <div
      style={{
        background: '#131009',
        border: '1px solid rgba(232,160,32,0.12)',
        borderRadius: 20,
        padding: '28px 24px',
        marginTop: 16,
      }}
    >
      <div
        style={{
          fontSize: 13,
          color: '#C8B99A',
          marginBottom: 18,
          lineHeight: 1.5,
          fontFamily: 'DM Sans, sans-serif',
        }}
      >
        Saisissez votre numero, vous recevrez un lien par WhatsApp pour redefinir votre mot de passe VIP.
      </div>

      {error && (
        <div
          style={{
            background: 'rgba(255,107,107,0.1)',
            border: '1px solid rgba(255,107,107,0.25)',
            color: '#FF6B6B',
            padding: '10px 14px',
            borderRadius: 10,
            marginBottom: 16,
            fontSize: 13,
            fontFamily: 'DM Sans, sans-serif',
            lineHeight: 1.45,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ marginBottom: 22 }}>
        <label
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#C8B99A',
            display: 'block',
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
          }}
        >
          Telephone
        </label>
        <PhoneInput value={phone} onChange={setPhone} defaultCountryCode={defaultCountryCode} />
      </div>

      <button
        onClick={submit}
        disabled={loading}
        style={{
          width: '100%',
          padding: '13px',
          borderRadius: 50,
          border: 'none',
          background: loading ? 'rgba(232,160,32,0.3)' : 'linear-gradient(135deg,#F5C842,#FF6B20)',
          color: '#0A0804',
          fontFamily: 'DM Sans, sans-serif',
          fontWeight: 800,
          fontSize: 14,
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Envoi...' : 'Envoyer ma demande'}
      </button>
    </div>
  )
}
