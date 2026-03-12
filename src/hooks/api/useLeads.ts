import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useLeads(params?: { status?: string; source?: string; q?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['leads', params],
    queryFn: () => api.listLeads({ page: params?.page ?? 1, limit: params?.limit ?? 25, ...params }),
    staleTime: 1000 * 60 * 3,
    gcTime: 1000 * 60 * 8,
    placeholderData: keepPreviousData,
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; phone: string; email?: string; company?: string; status?: string }) =>
      api.createLead(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; status?: string; notes?: string; lastContactedAt?: string }) =>
      api.updateLead(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });
}
