import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useLeads(params?: { status?: string; source?: string; q?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['leads', params],
    queryFn: () => api.listLeads({ page: params?.page ?? 1, limit: params?.limit ?? 25, ...params }),
    staleTime: 1000 * 60 * 4,
    gcTime: 1000 * 60 * 10,
    placeholderData: keepPreviousData,
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; phone: string; email?: string; company?: string; status?: string }) =>
      api.createLead(input),
    onMutate: async (newLead) => {
      await queryClient.cancelQueries({ queryKey: ['leads'] });
      const snapshots = queryClient.getQueriesData<{ data?: unknown[] }>({ queryKey: ['leads'] });
      queryClient.setQueriesData<{ data?: unknown[] }>({ queryKey: ['leads'] }, (old) => {
        if (!old) return old;
        const optimistic = {
          id: `opt-${Date.now()}`,
          ...newLead,
          status: newLead.status ?? 'cold',
          leadScore: 0,
          createdAt: new Date().toISOString(),
        };
        return { ...old, data: [optimistic, ...(old.data ?? [])] };
      });
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots?.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; status?: string; notes?: string; lastContactedAt?: string }) =>
      api.updateLead(id, input),
    onMutate: async ({ id, ...updates }) => {
      await queryClient.cancelQueries({ queryKey: ['leads'] });
      const snapshots = queryClient.getQueriesData<{ data?: unknown[] }>({ queryKey: ['leads'] });
      queryClient.setQueriesData<{ data?: unknown[] }>({ queryKey: ['leads'] }, (old) => {
        if (!old) return old;
        return { ...old, data: (old.data ?? []).map((l: unknown) => {
          const lead = l as Record<string, unknown>;
          return lead.id === id ? { ...lead, ...updates } : lead;
        }) };
      });
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots?.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });
}
