import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useLeadDashboard() {
  return useQuery({
    queryKey: ['lead-dashboard'],
    queryFn: () => api.getLeadDashboard(),
    staleTime: 1000 * 60 * 3,
    gcTime: 1000 * 60 * 8,
  });
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.getDashboard(),
    staleTime: 1000 * 60 * 3,
    gcTime: 1000 * 60 * 8,
  });
}
