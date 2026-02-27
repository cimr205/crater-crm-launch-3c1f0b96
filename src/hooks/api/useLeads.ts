import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useLeads(params?: { status?: string; source?: string; q?: string }) {
  return useQuery({
    queryKey: ['leads', params],
    queryFn: () => api.listLeads(params),
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
