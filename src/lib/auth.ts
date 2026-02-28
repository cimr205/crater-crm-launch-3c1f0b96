export type AppRole = 'owner' | 'admin' | 'employee';

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  employee: 'Employee',
};

export const ROLE_HIERARCHY: Record<AppRole, number> = {
  owner: 3,
  admin: 2,
  employee: 1,
};

export function canManageRole(actorRole: AppRole, targetRole: AppRole): boolean {
  return ROLE_HIERARCHY[actorRole] > ROLE_HIERARCHY[targetRole];
}
