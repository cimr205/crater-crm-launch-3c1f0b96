export type AppRole = 'owner' | 'admin' | 'employee';

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  employee: 'Employee',
};
