import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

/**
 * Fires all key data fetches immediately after login and caches them in
 * React Query. When the user navigates to any page, the data is already
 * there — zero wait time.
 */
export function BackgroundPrefetch() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated) return;

    const TTL = 1000 * 60 * 4; // 4 min — matches staleTime on hooks

    void queryClient.prefetchQuery({ queryKey: ['leads', undefined],                 queryFn: () => api.listLeads({ page: 1, limit: 50 }),     staleTime: TTL });
    void queryClient.prefetchQuery({ queryKey: ['deals', undefined],                 queryFn: () => api.listDeals(),                            staleTime: TTL });
    void queryClient.prefetchQuery({ queryKey: ['lead-dashboard'],                   queryFn: () => api.getLeadDashboard(),                     staleTime: TTL });
    void queryClient.prefetchQuery({ queryKey: ['invoice-stats'],                    queryFn: () => api.getInvoiceStats(),                      staleTime: TTL });
    void queryClient.prefetchQuery({ queryKey: ['payment-stats'],                    queryFn: () => api.getPaymentStats(),                      staleTime: TTL });
    void queryClient.prefetchQuery({ queryKey: ['tasks', { status: 'open' }],        queryFn: () => api.listTasks({ status: 'open' }),          staleTime: TTL });
    void queryClient.prefetchQuery({ queryKey: ['todos', { status: 'pending' }],     queryFn: () => api.listTodos({ status: 'pending' }),       staleTime: TTL });
    void queryClient.prefetchQuery({ queryKey: ['employees'],                        queryFn: () => api.listEmployees(),                        staleTime: TTL });
    void queryClient.prefetchQuery({ queryKey: ['daily-focus'],                      queryFn: () => api.getDailyFocus(),                        staleTime: TTL });
    void queryClient.prefetchQuery({ queryKey: ['meta-status'],                      queryFn: () => api.getMetaStatus(),                        staleTime: TTL });
  }, [isAuthenticated, queryClient]);

  return null;
}
