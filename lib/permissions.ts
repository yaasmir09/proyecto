export const VIEW_KEYS = ['Dashboard', 'Cobranza', 'Facturas', 'Clientes', 'Pagos', 'Reportes', 'Configuración'] as const

export type ViewKey = (typeof VIEW_KEYS)[number]
export type RoleKey = 'admin' | 'supervisor' | 'analista' | 'operador'
export type PermissionMatrix = Record<RoleKey, Record<ViewKey, boolean>>
export const ACTION_KEYS = ['clientes.gestionar', 'facturas.gestionar', 'pagos.gestionar', 'prestamos.gestionar', 'seguimientos.gestionar', 'usuarios.gestionar', 'backups.gestionar', 'reportes.exportar'] as const
export type ActionKey = (typeof ACTION_KEYS)[number]
export type ActionMatrix = Record<RoleKey, Record<ActionKey, boolean>>

const allViews = Object.fromEntries(VIEW_KEYS.map((view) => [view, true])) as Record<ViewKey, boolean>
const operationalViews = { Dashboard: true, Cobranza: true, Facturas: true, Clientes: true, Pagos: true, Reportes: true, Configuración: false }

export const DEFAULT_PERMISSIONS: PermissionMatrix = {
  admin: { ...allViews },
  supervisor: { ...operationalViews },
  analista: { Dashboard: true, Cobranza: false, Facturas: true, Clientes: true, Pagos: false, Reportes: true, Configuración: false },
  operador: { Dashboard: true, Cobranza: true, Facturas: false, Clientes: true, Pagos: true, Reportes: false, Configuración: false },
}

export const DEFAULT_ACTIONS: ActionMatrix = {
  admin: Object.fromEntries(ACTION_KEYS.map((action) => [action, true])) as Record<ActionKey, boolean>,
  supervisor: { 'clientes.gestionar': true, 'facturas.gestionar': true, 'pagos.gestionar': true, 'prestamos.gestionar': true, 'seguimientos.gestionar': true, 'usuarios.gestionar': true, 'backups.gestionar': false, 'reportes.exportar': true },
  analista: { 'clientes.gestionar': false, 'facturas.gestionar': false, 'pagos.gestionar': false, 'prestamos.gestionar': false, 'seguimientos.gestionar': false, 'usuarios.gestionar': false, 'backups.gestionar': false, 'reportes.exportar': true },
  operador: { 'clientes.gestionar': true, 'facturas.gestionar': false, 'pagos.gestionar': true, 'prestamos.gestionar': false, 'seguimientos.gestionar': true, 'usuarios.gestionar': false, 'backups.gestionar': false, 'reportes.exportar': false },
}

export function canAccessView(matrix: PermissionMatrix, role: string | undefined, view: ViewKey) {
  if (!role || !(role in matrix)) return false
  return matrix[role as RoleKey][view] === true
}

export function canUseAction(matrix: ActionMatrix, role: string | undefined, action: ActionKey) {
  if (!role || !(role in matrix)) return false
  return matrix[role as RoleKey][action] === true
}
