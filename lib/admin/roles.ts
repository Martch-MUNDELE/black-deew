import {
  ADMIN_PERMISSION_ACTIONS,
  type AdminPermissionAction,
  type AdminPermissionMap,
  type AdminSectionKey,
  createAdminPermissionMap,
} from '@/lib/admin/permissions'

export const ADMIN_ROLE_KEYS = ['owner', 'manager', 'cashier', 'stock', 'readonly'] as const

export type AdminRoleKey = (typeof ADMIN_ROLE_KEYS)[number]

type RoleDefinition = {
  key: AdminRoleKey
  label: string
  description: string
  permissions: AdminPermissionMap
}

const READ: readonly AdminPermissionAction[] = ['view']
const WRITE: readonly AdminPermissionAction[] = ['view', 'create', 'update']
const FULL: readonly AdminPermissionAction[] = ADMIN_PERMISSION_ACTIONS
const SENSITIVE_WRITE: readonly AdminPermissionAction[] = ['view', 'create', 'update', 'sensitive']

const ownerPermissions = createAdminPermissionMap({
  dashboard: FULL,
  cash_register: FULL,
  orders: FULL,
  finalized_sales: FULL,
  customers: FULL,
  products: FULL,
  menu: FULL,
  drivers: FULL,
  delivery: FULL,
  slots: FULL,
  settings: FULL,
  promotions: FULL,
  marketing: FULL,
  billing: FULL,
  users: FULL,
  superadmin: FULL,
})

const managerPermissions = createAdminPermissionMap({
  dashboard: READ,
  cash_register: WRITE,
  orders: WRITE,
  finalized_sales: READ,
  customers: WRITE,
  products: WRITE,
  menu: WRITE,
  drivers: WRITE,
  delivery: WRITE,
  slots: WRITE,
  settings: READ,
  promotions: WRITE,
  marketing: WRITE,
  billing: READ,
  users: [],
  superadmin: [],
})

const cashierPermissions = createAdminPermissionMap({
  dashboard: READ,
  cash_register: ['view', 'create'],
  orders: ['view', 'update'],
  finalized_sales: READ,
  customers: READ,
  products: READ,
  menu: READ,
  drivers: [],
  delivery: READ,
  slots: READ,
  settings: [],
  promotions: READ,
  marketing: READ,
  billing: [],
  users: [],
  superadmin: [],
})

const stockPermissions = createAdminPermissionMap({
  dashboard: READ,
  cash_register: [],
  orders: READ,
  finalized_sales: READ,
  customers: [],
  products: WRITE,
  menu: WRITE,
  drivers: WRITE,
  delivery: SENSITIVE_WRITE,
  slots: SENSITIVE_WRITE,
  settings: [],
  promotions: READ,
  marketing: READ,
  billing: [],
  users: [],
  superadmin: [],
})

const readonlyPermissions = createAdminPermissionMap({
  dashboard: READ,
  cash_register: [],
  orders: READ,
  finalized_sales: READ,
  customers: READ,
  products: READ,
  menu: READ,
  drivers: READ,
  delivery: READ,
  slots: READ,
  settings: READ,
  promotions: READ,
  marketing: READ,
  billing: READ,
  users: [],
  superadmin: [],
})

export const ADMIN_ROLES: Record<AdminRoleKey, RoleDefinition> = {
  owner: {
    key: 'owner',
    label: 'Propriétaire',
    description: 'Accès total au site, aux utilisateurs et aux réglages sensibles.',
    permissions: ownerPermissions,
  },
  manager: {
    key: 'manager',
    label: 'Gestionnaire',
    description: 'Gestion opérationnelle quotidienne sans administration des accès.',
    permissions: managerPermissions,
  },
  cashier: {
    key: 'cashier',
    label: 'Caisse',
    description: 'Commandes, ventes et consultation du catalogue.',
    permissions: cashierPermissions,
  },
  stock: {
    key: 'stock',
    label: 'Stock',
    description: 'Produits, menu, livraison et créneaux sans réglages sensibles.',
    permissions: stockPermissions,
  },
  readonly: {
    key: 'readonly',
    label: 'Lecture seule',
    description: 'Consultation des sections principales sans écriture.',
    permissions: readonlyPermissions,
  },
}

export function normalizeAdminRole(role: string | null | undefined): AdminRoleKey {
  if (role === 'superadmin') return 'owner'
  if (role === 'admin') return 'manager'
  if (role && ADMIN_ROLE_KEYS.includes(role as AdminRoleKey)) return role as AdminRoleKey
  return 'readonly'
}

export function getRoleDefinition(role: string | null | undefined) {
  return ADMIN_ROLES[normalizeAdminRole(role)]
}

export function getRolePermissions(role: string | null | undefined) {
  return getRoleDefinition(role).permissions
}

export function getRoleLabel(role: string | null | undefined) {
  return getRoleDefinition(role).label
}

export function listSectionPermissions(
  permissions: AdminPermissionMap,
  section: AdminSectionKey
) {
  return permissions[section] ?? []
}
