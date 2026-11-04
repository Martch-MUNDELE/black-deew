// BLAC-P3-029 : mise en page de la page publique de l'offre (écran 7). Contrôle du source, sans git.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = readFileSync(resolve(process.cwd(), 'app/offre/page.tsx'), 'utf8')

test('la page contient le badge Offre VIP et le nom Black Deew', () => {
  assert.ok(SRC.includes('Offre VIP'))
  assert.ok(SRC.includes('Black Deew'))
})

test("la page contient l'encadré, le bouton et la mention de connexion VIP", () => {
  assert.ok(SRC.includes('Ton offre est déjà dans ton compte : elle s&apos;ajoutera à ton panier.'))
  assert.ok(SRC.includes('Commander avec l&apos;offre'))
  assert.ok(SRC.includes('Connexion VIP demandée si tu n&apos;es pas déjà connecté.'))
  assert.ok(SRC.includes('href="/panier"'))
})

test("le visuel n'est affiché que si l'adresse est valide (même contrôle que Open Graph)", () => {
  assert.ok(SRC.includes("import { isValidCampaignImageUrl } from '@/lib/campaigns'"))
  assert.ok(SRC.includes('isValidCampaignImageUrl(offer.imageUrl)'))
  assert.ok(SRC.includes('alt={'))
})

test('la ligne de validité a une icône horloge et utilise describeDates', () => {
  assert.ok(SRC.includes('function ClockIcon'))
  assert.ok(SRC.includes('<ClockIcon />'))
  assert.ok(SRC.includes('describeDates(offer)'))
})

test("mise en page téléphone d'abord : largeur 480 et zones tactiles >= 44", () => {
  assert.ok(/maxWidth: 480/.test(SRC))
  assert.ok(/minHeight: 44/.test(SRC))
})

test('le cas offre indisponible garde son titre et son texte', () => {
  assert.ok(SRC.includes(`const UNAVAILABLE_TITLE = "Cette offre n'est plus disponible"`))
  assert.ok(SRC.includes('Cette offre est terminée ou n&apos;existe pas. Découvre notre carte du moment.'))
  assert.ok(SRC.includes('Voir la carte'))
})

test('les métadonnées Open Graph sont toujours générées', () => {
  assert.ok(SRC.includes('export async function generateMetadata'))
  assert.ok(SRC.includes('openGraph:'))
  assert.ok(SRC.includes('resolveCampaignOgImage(offer.imageUrl, OG_IMAGE)'))
  assert.ok(SRC.includes("twitter: { card: 'summary_large_image'"))
})

test('aucune donnée client sur la page', () => {
  assert.ok(!/customer|client_id|phone|email/i.test(SRC.replace(/Ton offre est déjà dans ton compte/g, '')))
})
