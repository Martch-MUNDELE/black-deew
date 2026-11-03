export const ADMIN_PERMISSION_ACTIONS = ['view', 'create', 'update', 'delete', 'sensitive'] as const

export type AdminPermissionAction = (typeof ADMIN_PERMISSION_ACTIONS)[number]

export const ADMIN_SECTIONS = [
  { key: 'dashboard', label: 'Dashboard', path: '/admin', group: 'Boutique' },
  { key: 'cash_register', label: 'Caisse', path: '/admin/caisse', group: 'Boutique' },
  { key: 'orders', label: 'Commandes', path: '/admin/commandes', group: 'Boutique' },
  { key: 'finalized_sales', label: 'Ventes finalisées', path: '/admin/ventes-finalisees', group: 'Boutique' },
  { key: 'customers', label: 'Clients', path: '/admin/clients', group: 'Boutique' },
  { key: 'products', label: 'Produits', path: '/admin/produits', group: 'Catalogue' },
  { key: 'menu', label: 'Menu', path: '/admin/menu', group: 'Catalogue' },
  { key: 'drivers', label: 'Livreurs', path: '/admin/livreurs', group: 'Opérations' },
  { key: 'delivery', label: 'Livraison', path: '/admin/livraison', group: 'Opérations' },
  { key: 'slots', label: 'Créneaux', path: '/admin/creneaux', group: 'Opérations' },
  { key: 'settings', label: 'Paramètres', path: '/admin/settings', group: 'Configuration' },
  { key: 'promotions', label: 'Promotions', path: '/admin/promotions', group: 'Configuration' },
  { key: 'marketing', label: 'Marketing', path: '/admin/marketing', group: 'Configuration' },
  { key: 'billing', label: 'Abonnement', path: '/admin/abonnement', group: 'Facturation' },
  { key: 'users', label: 'Utilisateurs', path: '/admin/utilisateurs', group: 'Accès' },
  { key: 'superadmin', label: 'Super Admin', path: '/admin/superadmin', group: 'Plateforme' },
] as const

export type AdminSectionKey = (typeof ADMIN_SECTIONS)[number]['key']

export type AdminPermissionMap = Record<AdminSectionKey, AdminPermissionAction[]>

export const EMPTY_ADMIN_PERMISSIONS: AdminPermissionMap = createAdminPermissionMap({})

export function createAdminPermissionMap(
  input: Partial<Record<AdminSectionKey, readonly AdminPermissionAction[]>>
): AdminPermissionMap {
  return ADMIN_SECTIONS.reduce((acc, section) => {
    acc[section.key] = [...(input[section.key] ?? [])]
    return acc
  }, {} as AdminPermissionMap)
}

export function hasAdminPermission(
  permissions: Partial<Record<AdminSectionKey, readonly AdminPermissionAction[]>> | null | undefined,
  section: AdminSectionKey,
  action: AdminPermissionAction = 'view'
) {
  return Boolean(permissions?.[section]?.includes(action))
}

export function serializeAdminPermissions(permissions: AdminPermissionMap) {
  return ADMIN_SECTIONS.reduce((acc, section) => {
    acc[section.key] = permissions[section.key] ?? []
    return acc
  }, {} as AdminPermissionMap)
}
