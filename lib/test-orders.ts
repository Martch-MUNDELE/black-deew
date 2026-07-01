// BF-P2-013 : numeros de telephone de test - exclus definitivement du systeme
// quand une commande passe au statut livree, elle est supprimee automatiquement
export const TEST_PHONE_NUMBERS: string[] = [
  '+352691434011',
]

export function isTestPhone(phone: string | null | undefined): boolean {
  if (!phone) return false
  return TEST_PHONE_NUMBERS.includes(phone)
}
