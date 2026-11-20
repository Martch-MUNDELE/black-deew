// BLAC-DETAIL-ERGONOMIE : ergonomie du detail de course livreur (logique pure + lecture du texte, sans reseau)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { actionBarKind, collectLabel, deliverLabel, detectNavigationTarget, contrastRatio, LABEL_COLOR, LABEL_FONT_SIZE, CARD_BG } =
  await import('@/lib/driver-delivery-view')

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const detail = read('components/driver/DriverDeliveryDetail.tsx')
const nav = read('components/driver/DriverNavigationLinks.tsx')
const norm = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase()
const count = (src, re) => (src.match(re) || []).length

test('barre fixe : presente pour non acceptee et acceptee, absente pour livree et annulee', () => {
  for (const st of ['assigned', 'pending', 'inconnu', null]) assert.equal(actionBarKind(st), 'accept')
  assert.equal(actionBarKind('picked_up'), 'deliver')
  assert.equal(actionBarKind('delivered'), null)
  assert.equal(actionBarKind('cancelled'), null)
})

test('barre fixe : style (fixed, largeur page, encoche, fond opaque, bordure haute) et composants existants', () => {
  const start = detail.indexOf('function ActionBar')
  assert.ok(start > 0)
  const barSrc = detail.slice(start, detail.indexOf('function CallLink'))
  assert.match(barSrc, /driver-action-bar/)
  assert.match(barSrc, /position: 'fixed'/)
  assert.match(barSrc, /maxWidth: 480/)
  assert.match(barSrc, /env\(safe-area-inset-bottom\)/)
  assert.match(barSrc, /background: C\.bg/)
  assert.match(barSrc, /borderTop:/)
  assert.equal(count(detail, /<DriverAcceptDelivery/g), 1)
  assert.equal(count(detail, /<DriverMarkDelivered/g), 1)
  assert.match(detail, /<ActionBar>\s*<DriverAcceptDelivery deliveryId=\{delivery\.id\} \/>\s*<\/ActionBar>/)
  assert.match(detail, /<ActionBar>\s*<DriverMarkDelivered deliveryId=\{delivery\.id\} amount=\{delivery\.amountToCollect\} \/>\s*<\/ActionBar>/)
  assert.match(detail, /withBar \? 'calc\(140px/)
})

test('un seul Appeler dans le detail, meme lien tel, rien sans numero', () => {
  assert.equal(count(detail, /Appeler/g), 1)
  assert.equal(count(nav, /Appeler/g), 0)
  assert.doesNotMatch(detail, /CallButton/)
  assert.match(detail, /telHref &&/)
  assert.match(detail, /buildTelUrl\(delivery\.customerPhone\)/)
  assert.match(detail, /<a\s+href=\{href\}/)
})

test('un seul bouton Lancer l itineraire, Autre application, Plans Apple', () => {
  assert.equal(count(nav, /Lancer l'itinéraire/g), 1)
  assert.match(nav, /Autre application/)
  assert.match(nav, /label: 'Plans Apple'/)
  assert.doesNotMatch(nav, /label: 'Plans'/)
  assert.match(nav, /buildNavigationLinks\(\{ address, lat, lng \}\)/)
  assert.match(nav, /links\.apple/)
  assert.match(nav, /links\.android/)
  assert.match(nav, /links\.google/)
})

test('detectNavigationTarget : iPhone, iPad, Android, autre', () => {
  assert.equal(detectNavigationTarget({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' }), 'apple')
  assert.equal(detectNavigationTarget({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)' }), 'apple')
  assert.equal(detectNavigationTarget({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5 }), 'apple')
  assert.equal(detectNavigationTarget({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 0 }), 'google')
  assert.equal(detectNavigationTarget({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)' }), 'android')
  assert.equal(detectNavigationTarget({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }), 'google')
  assert.equal(detectNavigationTarget({}), 'google')
})

test('libelles : ENCAISSE et LIVRE pour une course livree, neutre pour annulee', () => {
  assert.equal(norm(collectLabel('delivered')), 'ENCAISSE')
  assert.equal(norm(deliverLabel('delivered')), 'LIVRE')
  assert.equal(norm(collectLabel('picked_up')), 'A ENCAISSER')
  assert.equal(norm(deliverLabel('assigned')), 'A LIVRER')
  assert.doesNotMatch(norm(collectLabel('cancelled')), /ENCAISS/)
  assert.doesNotMatch(norm(deliverLabel('cancelled')), /LIVR/)
})

test('lisibilite : etiquettes >= 12 px et contraste >= 4,5 sur le fond des cartes', () => {
  const ratio = contrastRatio(LABEL_COLOR, CARD_BG)
  console.log(`contraste ${LABEL_COLOR} sur ${CARD_BG} = ${ratio.toFixed(2)}:1`)
  assert.ok(ratio >= 4.5, `ratio ${ratio}`)
  assert.ok(LABEL_FONT_SIZE >= 12)
  for (const src of [detail, nav]) {
    assert.match(src, /fontSize: LABEL_FONT_SIZE/)
    assert.match(src, /color: LABEL_COLOR/)
    assert.doesNotMatch(src, /fontSize: 11\b/)
  }
  assert.ok(contrastRatio('#000000', '#FFFFFF') > 20.9)
})
