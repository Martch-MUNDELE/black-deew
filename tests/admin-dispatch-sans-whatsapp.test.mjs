import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('../app/admin/commandes/page.tsx', import.meta.url), 'utf8')

function successPhase() {
  const start = src.indexOf("{phase === 'success' ? (")
  assert.ok(start > 0, 'phase success introuvable')
  const end = src.indexOf(') : (', start)
  assert.ok(end > start, 'fin de phase success introuvable')
  return src.slice(start, end)
}

function pendingBlock() {
  const start = src.indexOf("pending && pending !== status && pending !== 'restauration'")
  assert.ok(start > 0, 'bloc de transition introuvable')
  return src.slice(start, start + 2500)
}

function finishDispatchBody() {
  const start = src.indexOf('const finishDispatch = () => {')
  assert.ok(start > 0, 'finishDispatch introuvable')
  return src.slice(start, src.indexOf('\n  }\n', start))
}

test('phase succes du dispatch : ni lien wa.me ni texte Prevenez le client', () => {
  const ph = successPhase()
  assert.ok(!/wa\.me/.test(ph))
  assert.ok(!/Pr[ée]venez le client/.test(ph))
  assert.ok(!/Envoyer message WhatsApp/.test(ph))
  assert.ok(!/WhatsApp/i.test(ph))
})

test('phase succes du dispatch : confirmation Livreur dispatche + bouton Fermer', () => {
  const ph = successPhase()
  assert.ok(/Livreur dispatché/.test(ph))
  assert.ok(/prévient le client depuis son application/.test(ph))
  assert.ok(/>Fermer</.test(ph))
})

test('dispatch : plus d etat ni de construction d URL WhatsApp', () => {
  assert.ok(!/successWaUrl|setSuccessWaUrl/.test(src))
  assert.ok(!/buildWhatsAppUrl\(order, null, 'en_livraison'/.test(src))
})

test('liste : le bouton de transition vers en_livraison n est plus rendu', () => {
  const b = pendingBlock()
  assert.ok(b.includes("if (pending === 'en_livraison') return null"))
  assert.ok(!b.includes("pending === 'en_livraison' && !order.driver_id"))
})

test('liste : boutons WhatsApp des autres statuts toujours presents', () => {
  const b = pendingBlock()
  assert.ok(b.includes('buildWhatsAppUrl('))
  assert.ok(b.includes('href={waUrl}'))
  assert.ok(b.includes('WA_BUTTON_LABELS_PICKUP[pending]'))
  assert.ok(b.includes('WA_BUTTON_LABELS[pending]'))
  assert.ok(b.includes('sendStatusBeacon(order.id, pending)'))
  assert.ok(b.includes('applyStatusChange(order.id, pending)'))
  for (const label of ['Confirmation', 'Préparation', 'Livrée', 'Retrait confirmé', 'Annulation']) {
    assert.ok(src.includes(`'Envoyer message ${label}'`), label)
  }
})

test('liens WhatsApp de contact simple (client et livreur) inchanges', () => {
  assert.ok(src.includes('https://wa.me/${cleanPhoneForWhatsApp(order.customer_phone)}`}'))
  assert.ok(src.includes('https://wa.me/${cleanPhoneForWhatsApp(driverInfos[order.driver_id].phone)}`}'))
})

test('finishDispatch envoie toujours le statut en_livraison', () => {
  const f = finishDispatchBody()
  assert.ok(f.includes("sendStatusBeacon(order.id, 'en_livraison')"))
  assert.ok(f.includes('onDispatched(pendingPayload)'))
  assert.ok(f.includes('onClose()'))
})

test('notification push au livreur toujours envoyee au dispatch', () => {
  assert.ok(src.includes("fetch('/api/driver/notify-assignment'"))
})
