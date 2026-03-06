import { useQuery } from '@tanstack/react-query';

export function useTasks() {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: (): Promise<{ data: unknown[] }> => Promise.resolve({ data: [] }),
    staleTime: Infinity,
  });
}
