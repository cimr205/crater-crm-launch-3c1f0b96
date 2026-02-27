import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export type CompanyStatus = {
  is_active: boolean;
  plan: string;
  payment_status: string;
};

export function useCompanyStatus() {
  const [status, setStatus] = useState<CompanyStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.getCompanySettings()
      .then(({ tenant }) => {
        setStatus({
          is_active: tenant.is_active,
          plan: tenant.plan,
          payment_status: tenant.payment_status,
        });
      })
      .catch(() => setStatus(null))
      .finally(() => setIsLoading(false));
  }, []);

  return { status, isLoading };
}
