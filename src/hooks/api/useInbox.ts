import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useAiActivity() {
  return useQuery({
    queryKey: ['ai-activity'],
    queryFn: () => api.getAiActivity(),
    staleTime: 1000 * 60 * 3,
    gcTime: 1000 * 60 * 8,
  });
}
