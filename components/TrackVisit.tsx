'use client'
import { useEffect } from 'react'

const SESSION_KEY = 'bf_session_id'
const VISIT_TRACKED_KEY = 'bf_visit_tracked'

export default function TrackVisit() {
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(VISIT_TRACKED_KEY)) return

      let sessionId = window.sessionStorage.getItem(SESSION_KEY)
      if (!sessionId) {
        sessionId = crypto.randomUUID()
        window.sessionStorage.setItem(SESSION_KEY, sessionId)
      }

      fetch('/api/track-connexion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'classique_visite',
          session_id: sessionId,
        }),
      }).catch(() => {})

      window.sessionStorage.setItem(VISIT_TRACKED_KEY, '1')
    } catch {
      // silencieux : le tracking ne doit jamais casser la navigation
    }
  }, [])

  return null
}
