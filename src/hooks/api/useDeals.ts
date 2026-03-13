import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const TTL = 1000 * 60 * 4;
const GC = 1000 * 60 * 10;

export function useDeals(params?: { stage?: string; q?: string }) {
  return useQuery({
    queryKey: ['deals', params],
    queryFn: () => api.listDeals(params),
    staleTime: TTL,
    gcTime: GC,
  });
}

export function useCreateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; value?: number; stage_id?: string; customer_id?: string; lead_id?: string }) =>
      api.createDeal(input),
    onMutate: async (newDeal) => {
      await queryClient.cancelQueries({ queryKey: ['deals'] });
      const snapshots = queryClient.getQueriesData<{ data?: unknown[] }>({ queryKey: ['deals'] });
      queryClient.setQueriesData<{ data?: unknown[] }>({ queryKey: ['deals'] }, (old) => {
        if (!old) return old;
        const optimistic = {
          id: `opt-${Date.now()}`,
          ...newDeal,
          stage_id: newDeal.stage_id ?? 'new_lead',
          value: newDeal.value ?? 0,
          notes: null,
          created_at: new Date().toISOString(),
        };
        return { ...old, data: [optimistic, ...(old.data ?? [])] };
      });
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots?.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['deals'] }),
  });
}

export function useUpdateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; stage_id?: string; value?: number; title?: string }) =>
      api.updateDeal(id, input),
    onMutate: async ({ id, ...updates }) => {
      await queryClient.cancelQueries({ queryKey: ['deals'] });
      const snapshots = queryClient.getQueriesData<{ data?: unknown[] }>({ queryKey: ['deals'] });
      queryClient.setQueriesData<{ data?: unknown[] }>({ queryKey: ['deals'] }, (old) => {
        if (!old) return old;
        return {
          ...old,
          data: (old.data ?? []).map((d: unknown) => {
            const deal = d as Record<string, unknown>;
            return deal.id === id ? { ...deal, ...updates } : deal;
          }),
        };
      });
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots?.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['deals'] }),
  });
}
