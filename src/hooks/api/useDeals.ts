import { useQuery } from '@tanstack/react-query';

export function useDeals() {
  return useQuery({
    queryKey: ['deals'],
    queryFn: (): Promise<{ data: unknown[] }> => Promise.resolve({ data: [] }),
    staleTime: Infinity,
  });
}
