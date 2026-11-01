'use client'
// BLAC-P3-010 : overlay promotionnel (classic sur l'accueil, vip sur /vip). Donnees chargees apres le rendu.
import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  PROMO_OVERLAY_STORAGE_KEY,
  addDismissedId,
  formatPromotionBadge,
  getOverlaySurface,
  parseDismissedIds,
  selectOverlayPresentation,
  selectPromotionForSurface,
  type OverlayPromotion,
} from '@/lib/promo-overlay'

const GOLD = '#E8A020'
const GOLD_LIGHT = '#FFD060'

function readDismissed(): string[] {
  try {
    return parseDismissedIds(window.sessionStorage.getItem(PROMO_OVERLAY_STORAGE_KEY))
  } catch {
    return []
  }
}

function writeDismissed(ids: string[]) {
  try {
    window.sessionStorage.setItem(PROMO_OVERLAY_STORAGE_KEY, JSON.stringify(ids))
  } catch {
    /* stockage indisponible : la memoire du composant suffit pour la page courante */
  }
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

const CSS = `
.pov-backdrop{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(5,3,1,0.72);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);animation:pov-fade .45s ease both}
.pov-card{position:relative;width:100%;max-width:420px;max-height:calc(100dvh - 32px);overflow:visible;border-radius:22px;padding:2px;background:linear-gradient(135deg,#FFD060 0%,#E8A020 40%,#8a5a10 100%);box-shadow:0 24px 80px rgba(0,0,0,.7),0 0 60px rgba(232,160,32,.18);animation:pov-in .85s cubic-bezier(.3,.7,.3,1) both}
.pov-inner{position:relative;border-radius:20px;background:linear-gradient(180deg,#17110a 0%,#0c0804 100%);padding:28px 22px 22px;overflow:visible;font-family:'DM Sans',sans-serif;color:#fff}
.pov-inner.pov-tall{min-height:clamp(228px,64vw,252px)}
.pov-clip{position:absolute;inset:0;border-radius:20px;overflow:hidden;pointer-events:none}
.pov-glow{position:absolute;right:-40px;bottom:-40px;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,rgba(255,150,40,.45) 0%,rgba(255,110,20,.18) 45%,transparent 70%)}
.pov-body{position:relative;z-index:1;overflow-wrap:anywhere;word-break:break-word}
.pov-tag{display:inline-block;font-size:11px;font-weight:600;letter-spacing:.28em;text-transform:uppercase;color:${GOLD};border:1px solid rgba(232,160,32,.45);border-radius:999px;padding:5px 12px;margin-bottom:12px}
.pov-title{font-family:'Playfair Display',serif;font-weight:800;font-size:clamp(20px,6vw,26px);line-height:1.15;margin:0 0 6px;color:#fff}
.pov-badge{font-family:'Playfair Display',serif;font-weight:900;font-size:clamp(46px,17vw,84px);line-height:1;margin:6px 0 10px;background:linear-gradient(135deg,#FFD060 0%,#F5A020 40%,#FF6020 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;overflow-wrap:anywhere}
.pov-badge.pov-small{font-size:clamp(26px,9vw,40px);line-height:1.1}
.pov-msg{font-size:clamp(14px,4vw,16px);line-height:1.5;color:rgba(255,255,255,.88);margin:0 0 6px;font-weight:400}
.pov-msg.pov-has-img{margin-right:clamp(70px,22vw,120px)}
.pov-close{position:absolute;top:10px;right:10px;z-index:3;width:44px;height:44px;border-radius:50%;cursor:pointer;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.18);color:#FFD060;font-family:'Playfair Display',serif;font-weight:800;font-size:20px;line-height:1;display:flex;align-items:center;justify-content:center;padding:0}
.pov-close.pov-x{color:#fff;font-family:'DM Sans',sans-serif;font-weight:400;font-size:22px}
.pov-ring{position:absolute;inset:-1px;width:calc(100% + 2px);height:calc(100% + 2px);transform:rotate(-90deg);pointer-events:none}
.pov-ring circle{fill:none;stroke:#E8A020;stroke-width:2.5;stroke-linecap:round;stroke-dasharray:132;stroke-dashoffset:0;animation:pov-ring 5s linear .9s forwards}
@keyframes pov-ring{from{stroke-dashoffset:0}to{stroke-dashoffset:132}}
.pov-close:focus-visible{outline:2px solid ${GOLD_LIGHT};outline-offset:2px}
.pov-char{position:absolute;right:-14px;bottom:-22px;width:clamp(90px,27vw,135px);height:auto;z-index:2;pointer-events:none;filter:drop-shadow(0 8px 18px rgba(0,0,0,.6));animation:pov-float 4s ease-in-out infinite}
.pov-gift-body{text-align:center}
.pov-gift-fig{position:relative;width:40%;min-width:112px;max-width:168px;aspect-ratio:1/1;margin:-66px auto 16px;border-radius:24px;padding:3px;background:linear-gradient(135deg,#FFD060 0%,#E8A020 45%,#8a5a10 100%);box-shadow:0 0 0 1px rgba(255,208,96,.35),0 0 38px 8px rgba(255,160,40,.5),0 16px 34px rgba(0,0,0,.65);animation:pov-gift-float 4s ease-in-out infinite}
.pov-gift-fig::before{content:"";position:absolute;inset:-26px;border-radius:50%;background:radial-gradient(circle,rgba(255,170,50,.4) 0%,rgba(255,120,20,.14) 50%,transparent 72%);z-index:-1;pointer-events:none}
.pov-gift-img{display:block;width:100%;height:100%;object-fit:contain;border-radius:21px;background:radial-gradient(circle at 50% 40%,#2a1c0c 0%,#120c05 100%)}
.pov-badge.pov-gift-badge{font-size:clamp(40px,15vw,72px);letter-spacing:.06em;margin:4px 0 6px;line-height:1.05}
.pov-gift-line{font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(16px,5vw,20px);line-height:1.25;color:#FFD060;margin:0 0 6px;overflow-wrap:anywhere}
.pov-gift-more{font-size:12px;letter-spacing:.04em;color:rgba(255,255,255,.6);margin:0 0 14px}
@keyframes pov-gift-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@media (max-width:520px){
  .pov-backdrop{align-items:flex-end;padding:0}
  .pov-card{max-width:none;border-radius:22px 22px 0 0;max-height:92dvh;animation:pov-sheet .95s cubic-bezier(.3,.7,.3,1) both}
  .pov-inner{border-radius:20px 20px 0 0;padding-bottom:calc(22px + env(safe-area-inset-bottom))}
  .pov-clip{border-radius:20px 20px 0 0}
  .pov-char{right:-6px}
}
@keyframes pov-fade{from{opacity:0}to{opacity:1}}
@keyframes pov-in{0%{opacity:0;transform:translateY(40px) scale(.86)}45%{opacity:1;transform:translateY(-10px) scale(1.03)}65%{transform:translateY(4px) scale(.99)}82%{transform:translateY(-3px) scale(1.01)}100%{opacity:1;transform:none}}
@keyframes pov-sheet{0%{transform:translateY(105%)}50%{transform:translateY(-16px)}66%{transform:translateY(7px)}80%{transform:translateY(-4px)}90%{transform:translateY(2px)}100%{transform:none}}
@keyframes pov-out{0%{opacity:1;transform:none}20%{transform:translateY(-12px) scale(1.02)}36%{transform:translateY(3px)}52%{transform:translateY(-7px)}100%{opacity:0;transform:translateY(46px) scale(.9)}}
@keyframes pov-sheet-out{0%{transform:none}18%{transform:translateY(-14px)}32%{transform:translateY(2px)}46%{transform:translateY(-8px)}100%{transform:translateY(110%)}}
@keyframes pov-fade-out{from{opacity:1}to{opacity:0}}
.pov-backdrop.pov-leaving{animation:pov-fade-out .8s ease both;pointer-events:none}
.pov-card.pov-leaving{animation:pov-out .8s cubic-bezier(.4,0,.6,1) both}
@media (max-width:520px){.pov-card.pov-leaving{animation:pov-sheet-out .8s cubic-bezier(.4,0,.6,1) both}}
@keyframes pov-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@media (prefers-reduced-motion:reduce){
  .pov-ring circle{animation:none!important}
  .pov-backdrop,.pov-card,.pov-char,.pov-gift-fig,.pov-backdrop.pov-leaving,.pov-card.pov-leaving{animation:none!important}
}
`

export default function PromoOverlay() {
  const pathname = usePathname()
  const surface = getOverlaySurface(pathname)
  const [promo, setPromo] = useState<OverlayPromotion | null>(null)
  const [heroImage, setHeroImage] = useState('')
  const [imgOk, setImgOk] = useState(true)
  const [giftImgOk, setGiftImgOk] = useState(true)
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState<number | null>(null)
  const [leaving, setLeaving] = useState(false)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dismissedRef = useRef<string[]>([])
  const cardRef = useRef<HTMLDivElement>(null)
  const lastFocusRef = useRef<HTMLElement | null>(null)

  // Chargement apres le rendu, jamais bloquant ; delai d'environ une seconde avant l'apparition
  useEffect(() => {
    setOpen(false)
    setPromo(null)
    if (!surface) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let removeGrantedListener: (() => void) | null = null
    ;(async () => {
      try {
        const [promoRes, cmsRes] = await Promise.all([
          fetch('/api/promotions', { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
          fetch('/api/public-cms', { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
        ])
        if (cancelled) return
        const dismissed = Array.from(new Set([...readDismissed(), ...dismissedRef.current]))
        const chosen = selectPromotionForSurface(promoRes?.promotions, surface, dismissed)
        if (!chosen) return
        const rows: { key?: string; value?: string | null }[] = Array.isArray(cmsRes?.settings) ? cmsRes.settings : []
        const hero = rows.find((s) => s?.key === 'hero_image')?.value
        setHeroImage(typeof hero === 'string' ? hero : '')
        setImgOk(true)
        setGiftImgOk(true)
        setPromo(chosen)
        const startTimer = (delayMs: number) => {
          timer = setTimeout(() => {
            if (cancelled) return
            try {
              lastFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
            } catch {
              lastFocusRef.current = null
            }
            setOpen(true)
          }, delayMs)
        }
        // Site VIP : l'annonce apparait 3 secondes apres la connexion VIP reussie (pas sur l'ecran de connexion)
        const vipGranted = (window as unknown as { __bdVipGranted?: boolean }).__bdVipGranted === true
        if (surface === 'vip' && !vipGranted) {
          const onGranted = () => {
            window.removeEventListener('bd:vip-access-granted', onGranted)
            removeGrantedListener = null
            if (!cancelled) startTimer(3000)
          }
          removeGrantedListener = () => window.removeEventListener('bd:vip-access-granted', onGranted)
          window.addEventListener('bd:vip-access-granted', onGranted)
        } else {
          startTimer(surface === 'vip' ? 3000 : 1000)
        }
      } catch {
        /* aucune erreur visible pour le visiteur */
      }
    })()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      if (removeGrantedListener) removeGrantedListener()
    }
  }, [surface])

  const close = useCallback(() => {
    if (promo) {
      dismissedRef.current = addDismissedId(dismissedRef.current, promo.id)
      writeDismissed(addDismissedId(readDismissed(), promo.id))
    }
    setLeaving(false)
    setOpen(false)
    try {
      lastFocusRef.current?.focus?.()
    } catch {
      /* ignore */
    }
  }, [promo])

  // Fermeture animee (petits rebonds puis sortie) ; instantanee si mouvement reduit
  const requestClose = useCallback(() => {
    if (prefersReducedMotion()) { close(); return }
    if (leaveTimerRef.current) return
    setLeaving(true)
    leaveTimerRef.current = setTimeout(() => {
      leaveTimerRef.current = null
      close()
    }, 800)
  }, [close])

  // Compte a rebours 5, 4, 3, 2, 1 apres l'arrivee de la carte, puis fermeture animee (inactif si mouvement reduit)
  const [count, setCount] = useState(5)
  useEffect(() => {
    if (!open || leaving || prefersReducedMotion()) return
    setCount(5)
    let n = 5
    let iv: ReturnType<typeof setInterval> | undefined
    const start = setTimeout(() => {
      iv = setInterval(() => {
        n -= 1
        setCount(n)
        if (n <= 0) {
          if (iv) clearInterval(iv)
          requestClose()
        }
      }, 1000)
    }, 900)
    return () => {
      clearTimeout(start)
      if (iv) clearInterval(iv)
    }
  }, [open, leaving, requestClose])
  useEffect(() => () => { if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current) }, [])

  // Compte du pourcentage (desactive si mouvement reduit)
  const badge = promo ? formatPromotionBadge(promo) : null
  useEffect(() => {
    if (!open || !badge || badge.value === null) {
      setShown(null)
      return
    }
    if (prefersReducedMotion()) {
      setShown(badge.value)
      return
    }
    let raf = 0
    const start = performance.now()
    const target = badge.value
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 900)
      setShown(Math.round(target * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, promo?.id])

  // Focus initial, Echap et piege du focus
  useEffect(() => {
    if (!open) return
    const card = cardRef.current
    const focusables = () =>
      Array.from(card?.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])') ?? [])
    const cta = card?.querySelector<HTMLElement>('.pov-close')
    cta?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || !card?.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !card?.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!surface || !promo || !open || !badge) return null

  // BLAC-P3-011 : presentation cadeau (produit en vedette) ; photo en echec : retour a la presentation actuelle
  const presentation = selectOverlayPresentation(promo)
  const reducedMotion = prefersReducedMotion()
  const giftMode = presentation.mode === 'gift' && presentation.primary !== null && giftImgOk
  const showImg = !giftMode && Boolean(heroImage) && imgOk

  const badgeText = giftMode
    ? 'OFFERT'
    : badge.value !== null ? `-${shown ?? badge.value}${badge.suffix}` : badge.text

  return (
    <>
      <style>{CSS}</style>
      <div className={`pov-backdrop${leaving ? ' pov-leaving' : ''}`} onClick={requestClose}>
        <div
          ref={cardRef}
          className={`pov-card${leaving ? ' pov-leaving' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pov-title"
          aria-describedby="pov-msg"
        >
          <div className={`pov-inner${showImg ? ' pov-tall' : ''}`}>
            <div className="pov-clip" aria-hidden="true">
              <div className="pov-glow" />
            </div>
            <button
              type="button"
              className={`pov-close${reducedMotion ? ' pov-x' : ''}`}
              aria-label="Fermer"
              onClick={requestClose}
            >
              {reducedMotion ? (
                '×'
              ) : (
                <>
                  <svg className="pov-ring" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="21" /></svg>
                  <span aria-hidden="true">{count > 0 ? count : ''}</span>
                </>
              )}
            </button>
            <div className={`pov-body${giftMode ? ' pov-gift-body' : ''}`}>
              {giftMode && presentation.primary && (
                <div className="pov-gift-fig" aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="pov-gift-img"
                    src={presentation.primary.image_url ?? ''}
                    alt=""
                    onError={() => setGiftImgOk(false)}
                  />
                </div>
              )}
              <span className="pov-tag">PROMOTION</span>
              <h2 id="pov-title" className="pov-title">{promo.name}</h2>
              <div
                className={`pov-badge${giftMode ? ' pov-gift-badge' : badge.value === null ? ' pov-small' : ''}`}
                aria-label={giftMode ? `Offert : ${presentation.label}` : badge.text}
              >
                {badgeText}
              </div>
              {giftMode && (
                <>
                  <p className="pov-gift-line">{presentation.label}</p>
                  {presentation.othersCount > 0 && (
                    <p className="pov-gift-more">+ {presentation.othersCount} {presentation.othersCount > 1 ? 'autres' : 'autre'}</p>
                  )}
                </>
              )}
              {promo.customer_message ? (
                <p id="pov-msg" className={`pov-msg${showImg ? ' pov-has-img' : ''}`}>{promo.customer_message}</p>
              ) : (
                <p id="pov-msg" className={`pov-msg${showImg ? ' pov-has-img' : ''}`}>Profitez de cette offre des maintenant.</p>
              )}
            </div>
            {showImg && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="pov-char" src={heroImage} alt="" aria-hidden="true" onError={() => setImgOk(false)} />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
