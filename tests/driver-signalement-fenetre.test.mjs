// BLAC-SIGNALEMENT-FENETRE : fenetre modale de signalement, choix visible, badge position, bouton WhatsApp.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const { REPORT_KINDS, REPORT_NOTE_MAX } = await import('../lib/delivery-reports.ts')

const report = read('components/driver/DriverReportProblem.tsx')
const tracking = read('components/driver/DriverTrackingSender.tsx')
const delivered = read('components/driver/DriverMarkDelivered.tsx')

test('fenetre : role dialog et aria-modal', () => {
  assert.match(report, /role="dialog"/)
  assert.match(report, /aria-modal="true"/)
})

test('fenetre : croix de fermeture de 44 px', () => {
  assert.match(report, /aria-label="Fermer"/)
  assert.match(report, /width: 44, height: 44/)
})

test('fenetre : fermeture par la touche Echap', () => {
  assert.match(report, /addEventListener\('keydown'/)
  assert.match(report, /e\.key === 'Escape'/)
  assert.match(report, /removeEventListener\('keydown'/)
})

test('fenetre : fond assombri, tap sur le fond ferme, defilement de la page bloque', () => {
  assert.match(report, /position: 'fixed'/)
  assert.match(report, /background: 'rgba\(0,0,0,0\.7\)'/)
  assert.match(report, /e\.target === e\.currentTarget/)
  assert.match(report, /document\.body\.style\.overflow = 'hidden'/)
  assert.match(report, /document\.body\.style\.overflow = previousOverflow/)
})

test('fenetre : monte du bas, 85 pour cent de hauteur max, liste defilante, coins hauts arrondis', () => {
  assert.match(report, /alignItems: 'flex-end'/)
  assert.match(report, /maxHeight: '85vh'/)
  assert.match(report, /overflowY: 'auto'/)
  assert.match(report, /borderRadius: '20px 20px 0 0'/)
  assert.match(report, /translateY\(100%\)/)
})

test('envoi : bouton inactif sans choix et texte d aide', () => {
  assert.match(report, /disabled=\{!kind \|\| sending\}/)
  assert.match(report, /Choisis un type pour envoyer/)
  assert.match(report, /\{!kind \?/)
  assert.match(report, /if \(sending \|\| !kind\) return/)
})

test('choix : un seul type selectionne a la fois, rond visible, surligne or avec coche', () => {
  assert.match(report, /useState<ReportKind \| null>\(null\)/)
  assert.match(report, /role="radiogroup"/)
  assert.match(report, /role="radio"/)
  assert.match(report, /const selected = kind === k\.value/)
  assert.match(report, /aria-checked=\{selected\}/)
  assert.match(report, /onClick=\{\(\) => setKind\(k\.value\)\}/)
  assert.match(report, /data-radio-circle/)
  assert.match(report, /data-check/)
  assert.match(report, /\{selected \? \(/)
  assert.match(report, /const GOLD = '#F5C842'/)
})

test('les 9 types, les libelles et la limite de 500 caracteres sont inchanges', () => {
  assert.deepEqual(REPORT_KINDS.map((k) => k.value), [
    'address_not_found', 'customer_unreachable', 'customer_refused', 'amount_mismatch', 'product_damaged',
    'breakdown_delay', 'insufficient_stock', 'cannot_continue', 'other',
  ])
  assert.deepEqual(REPORT_KINDS.map((k) => k.label), [
    'Adresse introuvable ou fausse',
    'Client injoignable ou absent',
    'Client refuse ou conteste la commande',
    'Montant différent ou client qui ne peut pas payer',
    'Produit abîmé ou manquant',
    'Panne, accident ou retard important',
    'Stock insuffisant',
    'Je ne peux plus prendre la course',
    'Autre',
  ])
  assert.equal(REPORT_NOTE_MAX, 500)
  assert.match(report, /REPORT_KINDS\.map\(/)
  assert.match(report, /maxLength=\{REPORT_NOTE_MAX\}/)
})

test('appel API inchange et confirmation puis fermeture', () => {
  assert.match(report, /fetch\('\/api\/driver\/report-problem'/)
  assert.match(report, /JSON\.stringify\(\{ delivery_id: deliveryId, kind, note: note\.trim\(\) \|\| undefined \}\)/)
  assert.match(report, /Signalement envoyé/)
  assert.match(report, /setSent\(true\)/)
  assert.match(report, /setTimeout\(close, 1800\)/)
})

test('badge position : partagee avec le client, message d erreur conserve', () => {
  assert.match(tracking, /Position partagée avec le client/)
  assert.match(tracking, /Active la localisation pour que le client te suive/)
})

// BLAC-P3-077 : le bouton devient "Prevenir le client et partager mon suivi" (ouvre WhatsApp avec le message complet) ;
// l'aide manuelle en trois lignes devient une astuce optionnelle (lien texte souligne, aria-expanded conserve).
test('bouton WhatsApp : secondaire de 48 px avec icone SVG, astuce optionnelle conservee', () => {
  assert.match(delivered, /Prévenir le client et partager mon suivi/)
  assert.match(delivered, /minHeight: 48/)
  assert.match(delivered, /<svg aria-hidden="true"/)
  assert.match(delivered, /aria-expanded=\{tipOpen\}/)
  assert.match(delivered, /setTipOpen\(\(v\) => !v\)/)
  assert.match(delivered, /Astuce : suivi continu écran verrouillé/)
})

test('confirmation de livraison non touchee', () => {
  assert.match(delivered, /Marquer comme livrée/)
  assert.match(delivered, /Confirmer la livraison \?/)
  assert.match(delivered, /Oui, livrée/)
  assert.match(delivered, /\/api\/driver\/mark-delivered/)
})
