import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { decideAdminAccess, hasSupabaseSessionCookie, isAdminProtectedPath } from '@/lib/supabase/proxy'
function toLogin(request: NextRequest) {
  return NextResponse.redirect(new URL('/admin/login', request.url))
}
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  // Transmet le chemin au layout serveur (masquage du menu sur /admin/login).
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', path)
  let response = NextResponse.next({ request: { headers: requestHeaders } })
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    // Dev local sans Supabase : on laisse passer. En production : admin protege.
    if (process.env.NODE_ENV !== 'production') return response
    return isAdminProtectedPath(path) ? toLogin(request) : response
  }
  const hasSessionCookie = hasSupabaseSessionCookie(request.cookies.getAll().map((c) => c.name))
  const first = decideAdminAccess({ path, hasSessionCookie })
  if (first === 'allow') return response
  if (first === 'redirect-login') return toLogin(request)
  // Cookie present : verifier la session et rafraichir les cookies (@supabase/ssr).
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request: { headers: requestHeaders } })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const final = decideAdminAccess({ path, hasSessionCookie, hasUser: !!user })
  return final === 'allow' ? response : toLogin(request)
}
// Uniquement /admin : site public, /vip, /api et fichiers statiques ne passent jamais par ce proxy.
export const config = {
  matcher: ['/admin', '/admin/:path*'],
}
