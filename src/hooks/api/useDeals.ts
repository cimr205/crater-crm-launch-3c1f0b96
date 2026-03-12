import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useDeals(params?: { stage?: string; q?: string }) {
  return useQuery({
    queryKey: ['deals', params],
    queryFn: () => api.listDeals(params),
    staleTime: 1000 * 60 * 3,
    gcTime: 1000 * 60 * 8,
  });
}

export function useCreateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; value?: number; stage_id?: string; customer_id?: string; lead_id?: string }) =>
      api.createDeal(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deals'] }),
  });
}

export function useUpdateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; stage_id?: string; value?: number; title?: string }) =>
      api.updateDeal(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deals'] }),
  });
}
