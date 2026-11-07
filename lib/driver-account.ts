// BLAC-P3-047 : logique pure du compte de connexion livreur (sans Next ni Supabase).

export const DRIVER_PASSWORD_MIN_LENGTH = 10

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type DriverAccountValidation =
  | { ok: true; email: string }
  | { ok: false; error: string }

/** Email nettoye : espaces retires et minuscules. Chaine vide si la valeur n'est pas du texte. */
export function normalizeDriverEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

/** Valide l'email et le mot de passe saisis par l'administrateur. Le mot de passe n'est jamais renvoye. */
export function validateDriverAccountInput(input: {
  email?: unknown
  password?: unknown
}): DriverAccountValidation {
  const email = normalizeDriverEmail(input?.email)
  if (!email) return { ok: false, error: "L'email est obligatoire." }
  if (!EMAIL_PATTERN.test(email)) return { ok: false, error: "L'email n'est pas valide." }
  const password = typeof input?.password === 'string' ? input.password : ''
  if (password.length < DRIVER_PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      error: `Le mot de passe doit contenir au moins ${DRIVER_PASSWORD_MIN_LENGTH} caracteres.`,
    }
  }
  return { ok: true, email }
}
