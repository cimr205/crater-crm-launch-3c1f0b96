import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/lib/i18n';

export default function RoleGate({ role = 'admin', children }: { role?: 'admin' | 'user'; children: ReactNode }) {
  const { user } = useAuth();
  const { t } = useI18n();
  if (!user || user.role !== role) {
    return <div className="text-sm text-muted-foreground">{t('common.adminOnly')}</div>;
  }
  return <>{children}</>;
}




