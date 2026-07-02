'use client'
import { useEffect, useRef } from 'react'

// BF-P2-013 (extension) : detection automatique de nouvelle version
// Verifie public/version.json a intervalle regulier et a chaque retour au premier plan
// (cas cle : PWA relancee depuis l'icone ecran d'accueil sur iPhone).
// Si une nouvelle version est detectee, rechargement silencieux de la page.
export default function VersionChecker() {
  const currentVersion = useRef<string | null>(null)

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const res = await fetch('/version.json', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (currentVersion.current === null) {
          currentVersion.current = data.version
          return
        }
        if (data.version !== currentVersion.current) {
          window.location.reload()
        }
      } catch {
        // silencieux : la verification de version ne doit jamais casser la navigation
      }
    }

    checkVersion()

    const interval = setInterval(checkVersion, 5 * 60 * 1000)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkVersion()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', checkVersion)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', checkVersion)
    }
  }, [])

  return null
}
