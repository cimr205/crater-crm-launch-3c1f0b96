import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useDeals() {
  return useQuery({
    queryKey: ['deals'],
    queryFn: () => api.getDashboard(),
  });
}
