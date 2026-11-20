// BLAC-P3-063 : liens d'itineraire du livreur
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { buildNavigationLinks } = await import('@/lib/driver-navigation')

const LAT = 33.5731
const LNG = -7.5898
const PAIR = `${LAT},${LNG}`

function checkCoordLinks(links) {
  assert.ok(links)
  assert.equal(links.hasCoords, true)
  assert.ok(links.google.includes(PAIR))
  assert.ok(links.waze.includes(PAIR))
  assert.ok(links.apple.includes(PAIR))
  assert.ok(links.android.includes(PAIR))
  assert.ok(links.google.includes('travelmode=driving'))
}

test('coordonnees numeriques : les quatre liens contiennent les coordonnees exactes', () => {
  // BLAC-ITINERAIRE-ADRESSE : les liens par coordonnees ne servent qu'en secours (adresse vide)
  const links = buildNavigationLinks({ address: '', lat: LAT, lng: LNG })
  checkCoordLinks(links)
  assert.equal(links.google, `https://www.google.com/maps/dir/?api=1&destination=${PAIR}&travelmode=driving`)
  assert.equal(links.waze, `https://waze.com/ul?ll=${PAIR}&navigate=yes`)
  assert.equal(links.apple, `https://maps.apple.com/?daddr=${PAIR}&dirflg=d`)
  assert.equal(links.android, `geo:${PAIR}?q=${PAIR}`)
})

test('coordonnees en chaines numeriques : meme resultat', () => {
  const fromStrings = buildNavigationLinks({ address: null, lat: '33.5731', lng: '-7.5898' })
  checkCoordLinks(fromStrings)
  assert.deepEqual(fromStrings, buildNavigationLinks({ address: null, lat: LAT, lng: LNG }))
})

test('coordonnees invalides avec adresse : liens sur adresse encodee, hasCoords faux', () => {
  const enc = encodeURIComponent('12 rue Haut')
  for (const input of [
    { lat: 91, lng: LNG },
    { lat: NaN, lng: LNG },
    { lat: null, lng: null },
    { lat: LAT, lng: 181 },
    { lat: 'abc', lng: LNG },
  ]) {
    const links = buildNavigationLinks({ address: '12 rue Haut', ...input })
    assert.ok(links)
    assert.equal(links.hasCoords, false)
    assert.equal(links.google, `https://www.google.com/maps/dir/?api=1&destination=${enc}&travelmode=driving`)
    assert.equal(links.waze, `https://waze.com/ul?q=${enc}&navigate=yes`)
    assert.equal(links.apple, `https://maps.apple.com/?daddr=${enc}&dirflg=d`)
    assert.equal(links.android, `geo:0,0?q=${enc}`)
  }
})

test('ni coordonnees ni adresse : null', () => {
  assert.equal(buildNavigationLinks({ address: '', lat: null, lng: null }), null)
  assert.equal(buildNavigationLinks({ address: '   ', lat: 91, lng: NaN }), null)
  assert.equal(buildNavigationLinks({}), null)
})

test('adresse avec espaces et accents correctement encodee', () => {
  const links = buildNavigationLinks({ address: '  Rue de l\'Étoile, Gombe  ' })
  const enc = encodeURIComponent("Rue de l'Étoile, Gombe")
  assert.ok(links.google.includes(`destination=${enc}`))
  assert.ok(links.waze.includes(`q=${enc}`))
  assert.ok(links.apple.includes(`daddr=${enc}`))
  assert.ok(links.android.endsWith(`q=${enc}`))
  assert.ok(links.google.includes('%C3%89'))
  assert.ok(!links.google.includes(' '))
})

test('le composant n affiche rien quand le resultat est null (lecture du code)', () => {
  const src = readFileSync(new URL('../components/driver/DriverNavigationLinks.tsx', import.meta.url), 'utf8')
  assert.match(src, /buildNavigationLinks\(/)
  assert.match(src, /if \(!links\) return null/)
  assert.match(src, /rel="noopener noreferrer"/)
  assert.match(src, /target="_blank"/)
})

test('le detail n affiche pas le bloc pour delivered et cancelled (lecture du code)', () => {
  const src = readFileSync(new URL('../components/driver/DriverDeliveryDetail.tsx', import.meta.url), 'utf8')
  assert.match(src, /accepted \? \(\s*<>\s*<StepsBanner status=\{delivery\.status\} \/>\s*<DriverNavigationLinks/)
  assert.match(src, /const delivered = delivery\.status\.trim\(\)\.toLowerCase\(\) === 'delivered'/)
  // le bloc n'apparait que pour une course acceptee (picked_up) : jamais delivered ni cancelled (assertion remise par Claude apres controle BLAC-P3-069)
  assert.match(src, /const accepted = delivery\.status\.trim\(\)\.toLowerCase\(\) === 'picked_up'/)
  assert.equal((src.match(/<DriverNavigationLinks/g) || []).length, 1)
})
