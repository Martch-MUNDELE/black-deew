import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDeliveryFeed } from '../lib/driver-delivery-feed.ts'

const NOW = new Date('2026-11-08T12:00:00.000Z')
const ago = (min) => new Date(NOW.getTime() - min * 60000).toISOString()
const drivers = [
  { id: 'd1', full_name: 'Jean Mbala' },
  { id: 'd2', full_name: 'Paul Kasa' },
]

test('course livree il y a 5 min : presente avec minutes_ago 5 et le bon nom', () => {
  const feed = buildDeliveryFeed(
    [{ order_id: 'o1', driver_id: 'd1', status: 'delivered', delivered_at: ago(5), amount_collected: 42 }],
    drivers,
    NOW
  )
  assert.equal(feed.length, 1)
  assert.equal(feed[0].order_id, 'o1')
  assert.equal(feed[0].driver_name, 'Jean Mbala')
  assert.equal(feed[0].minutes_ago, 5)
  assert.equal(feed[0].amount_collected, 42)
})

test('course de plus de 24 h ignoree', () => {
  const feed = buildDeliveryFeed(
    [{ order_id: 'o2', driver_id: 'd1', status: 'delivered', delivered_at: ago(24 * 60 + 1), amount_collected: 10 }],
    drivers,
    NOW
  )
  assert.deepEqual(feed, [])
})

test('ligne non delivered ou sans delivered_at ignoree', () => {
  const feed = buildDeliveryFeed(
    [
      { order_id: 'o3', driver_id: 'd1', status: 'assigned', delivered_at: ago(3), amount_collected: 10 },
      { order_id: 'o4', driver_id: 'd1', status: 'delivered', delivered_at: null, amount_collected: 10 },
    ],
    drivers,
    NOW
  )
  assert.deepEqual(feed, [])
})

test('tri du plus recent au plus ancien', () => {
  const feed = buildDeliveryFeed(
    [
      { order_id: 'old', driver_id: 'd1', status: 'delivered', delivered_at: ago(120), amount_collected: 1 },
      { order_id: 'new', driver_id: 'd2', status: 'delivered', delivered_at: ago(2), amount_collected: 2 },
      { order_id: 'mid', driver_id: 'd1', status: 'delivered', delivered_at: ago(30), amount_collected: 3 },
    ],
    drivers,
    NOW
  )
  assert.deepEqual(feed.map((f) => f.order_id), ['new', 'mid', 'old'])
})

test('liste vide => []', () => {
  assert.deepEqual(buildDeliveryFeed([], drivers, NOW), [])
  assert.deepEqual(buildDeliveryFeed(null, null, NOW), [])
})
