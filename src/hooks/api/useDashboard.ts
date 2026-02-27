import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useLeadDashboard() {
  return useQuery({
    queryKey: ['lead-dashboard'],
    queryFn: () => api.getLeadDashboard(),
  });
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.getDashboard(),
  });
}
