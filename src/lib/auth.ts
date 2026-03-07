// Legacy app roles
export type AppRole = 'owner' | 'admin' | 'employee';

// DB role enum (matches backend)
export type DbRole = 'system_admin' | 'company_admin' | 'manager' | 'employee' | 'readonly';

// All valid roles
export type AnyRole = AppRole | DbRole;

export const ROLE_LABELS: Record<AnyRole, string> = {
  // Legacy
  owner: 'Owner',
  admin: 'Admin',
  employee: 'Employee',
  // DB roles
  system_admin: 'System Admin',
  company_admin: 'Company Admin',
  manager: 'Manager',
  readonly: 'Read Only',
};

// Higher number = more permissions
export const ROLE_HIERARCHY: Record<AnyRole, number> = {
  system_admin: 100,
  owner: 90,
  company_admin: 80,
  admin: 70,
  manager: 50,
  employee: 20,
  readonly: 10,
};

export function canManageRole(actorRole: AnyRole, targetRole: AnyRole): boolean {
  return (ROLE_HIERARCHY[actorRole] ?? 0) > (ROLE_HIERARCHY[targetRole] ?? 0);
}
