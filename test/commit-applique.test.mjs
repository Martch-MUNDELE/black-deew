import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

test('le rapport BD-COMMIT-APPLIQUE existe', () => {
  assert.ok(existsSync('reports/BD-COMMIT-APPLIQUE_REPORT.md'));
});
