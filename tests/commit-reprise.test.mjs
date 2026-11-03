import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('le rapport de reprise existe et mentionne les cinq lots', () => {
  assert.ok(existsSync('reports/BD-COMMIT-REPRISE_REPORT.md'));
  const txt = readFileSync('reports/BD-COMMIT-REPRISE_REPORT.md', 'utf8');
  for (const n of [1, 2, 3, 4, 5]) assert.ok(txt.includes('Lot ' + n), 'Lot ' + n + ' absent');
});
