// Faux client Supabase "serveur" (cookies) : la session est pilotee par globalThis.__FAKE_AUTH__.
export function setFakeSession(user) { globalThis.__FAKE_AUTH__ = user }
export async function createClient() {
  return {
    auth: {
      async getUser() {
        const u = globalThis.__FAKE_AUTH__ ?? null
        return u ? { data: { user: u }, error: null } : { data: { user: null }, error: { message: 'Auth session missing!' } }
      },
    },
  }
}
