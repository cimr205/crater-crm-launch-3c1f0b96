import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/lib/i18n';

export default function RoleGate({ role = 'owner', children }: { role?: string; children: ReactNode }) {
  const { user } = useAuth();
  const { t } = useI18n();

  const allowed = !!user && (user.is_global_admin || user.role === role);
  if (!allowed) {
    return <div className="text-sm text-muted-foreground">{t('common.adminOnly')}</div>;
  }

  return <>{children}</>;
}


