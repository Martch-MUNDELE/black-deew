// BLAC-P3-062 : titre de la page de connexion selon la destination (?next=).
// Fonction pure : un livreur qui arrive depuis /driver voit "Espace livreur".
export function loginHeading(nextParam: string | null | undefined): string {
  const value = (nextParam ?? '').trim().toLowerCase()
  return value.startsWith('/admin/driver') ? 'Espace livreur' : 'Administration'
}
