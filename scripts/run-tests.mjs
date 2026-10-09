// Lanceur des tests automatises (node:test). Aucun acces reseau ni base reelle :
// le loader remplace Supabase par un faux client en memoire et fixe des variables factices.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const result = spawnSync(
  process.execPath,
  [
    '--disable-warning=DEP0205',
    '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
    '--import', './tests/helpers/register.mjs',
    '--test', 'tests/**/*.test.mjs',
  ],
  { cwd: root, stdio: 'inherit' }
)
process.exit(result.status ?? 1)
