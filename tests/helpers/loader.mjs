// Loader de test : alias "@/", faux client Supabase, shim next/server, stub notifications.
// Aucun code applicatif n'est modifie.
import { statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const helper = (f) => pathToFileURL(path.join(ROOT, 'tests', 'helpers', f)).href
const MAP = {
  '@supabase/supabase-js': helper('fake-supabase.mjs'),
  'next/server': helper('next-server-shim.mjs'),
  '@/lib/notifications': helper('notifications-stub.mjs'),
}
const isFile = (p) => { try { return statSync(p).isFile() } catch { return false } }
export async function resolve(specifier, context, nextResolve) {
  if (MAP[specifier]) return { url: MAP[specifier], shortCircuit: true }
  if (specifier.startsWith('@/')) {
    const base = path.join(ROOT, specifier.slice(2))
    for (const c of [base + '.ts', base + '.tsx', path.join(base, 'index.ts'), base]) {
      if (isFile(c)) return nextResolve(pathToFileURL(c).href, context)
    }
  }
  return nextResolve(specifier, context)
}
