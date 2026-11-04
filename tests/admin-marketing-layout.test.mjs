// BLAC-P3-022 : structure de l'écran 1 du Marketing (lecture des sources, aucun rendu).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const page = read('app/admin/marketing/page.tsx')
const panel = read('components/admin/CampaignsPanel.tsx')

test('la page a un tablist accessible avec trois onglets et sans onglet Scénarios', () => {
  assert.ok(page.includes('role="tablist"'))
  assert.ok(page.includes('role="tab"'))
  assert.ok(page.includes('aria-selected'))
  assert.ok(page.includes("label: 'Campagnes'"))
  assert.ok(page.includes("label: 'Offres clients'"))
  assert.ok(page.includes("label: 'Résultats'"))
  assert.ok(!/Scénarios/.test(page))
})

test('onglet Campagnes par défaut, hash gardé, un seul panneau visible', () => {
  assert.ok(page.includes("useState<TabId>('campagnes')"))
  assert.ok(page.includes('window.location.hash'))
  assert.ok(page.includes('hashchange'))
  assert.equal((page.match(/role="tabpanel"/g) ?? []).length, 3)
  assert.equal((page.match(/hidden=\{active !==/g) ?? []).length, 3)
})

test('les cinq cartes numérotées et les deux cartes latérales existent', () => {
  ;[
    [1, 'Visuel de la promo'], [2, 'Promotion liée'], [3, "Validité de l'offre"],
    [4, 'Message WhatsApp'], [5, 'Destinataires'],
  ].forEach(([n, t]) => assert.ok(panel.includes(`<Card n={${n}} title="${t}">`), `${n}. ${t}`))
  assert.ok(panel.includes('title="Aperçu chez le client"'))
  assert.ok(panel.includes('title="Récapitulatif"'))
})

test('les identifiants et data-testid d origine sont conservés', () => {
  for (const id of ['camp-name', 'camp-promo', 'camp-message', 'camp-start', 'camp-end', 'camp-audience'])
    assert.ok(panel.includes(`id="${id}"`), id)
  assert.ok(panel.includes('data-testid="campaign-preview"'))
  assert.ok(panel.includes('data-testid="campaign-image-preview"'))
  assert.ok(read('components/admin/CampaignResults.tsx').includes('data-testid="campaign-results"'))
  const queue = read('components/admin/CampaignSendQueue.tsx')
  for (const t of ['campaign-send-queue', 'queue-counter', 'queue-scenario']) assert.ok(queue.includes(`data-testid="${t}"`), t)
})

test('audience : trois valeurs gardées, pas de « Je choisis »; dates en datetime-local; trois boutons d insertion', () => {
  for (const v of ['all_consenting', 'best_clients', 'inactive_clients']) assert.ok(panel.includes(`value: '${v}'`), v)
  assert.ok(!panel.includes('Je choisis'))
  assert.equal((panel.match(/type="datetime-local"/g) ?? []).length, 2)
  assert.ok(panel.includes("['{pseudo}', '{lien}', '{date de fin}']"))
  assert.ok(panel.includes('selectionStart'))
  assert.ok(panel.includes('weekday: \'long\''))
})
