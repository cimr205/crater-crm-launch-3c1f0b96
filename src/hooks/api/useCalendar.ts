import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useCompanyHistory(month?: string) {
  return useQuery({
    queryKey: ['history', month],
    queryFn: () => api.getCompanyHistory(month),
  });
}
