import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useLeadGenSessions(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['lead-gen-sessions', params],
    queryFn: () => api.listLeadGenSessions(params),
    staleTime: 1000 * 30,       // sessions update frequently
    gcTime: 1000 * 60 * 5,
  });
}

export function useLeadGenSession(id: string | null, pollWhileRunning = false) {
  return useQuery({
    queryKey: ['lead-gen-session', id],
    queryFn: () => api.getLeadGenSession(id!),
    enabled: !!id,
    staleTime: pollWhileRunning ? 0 : 1000 * 60,
    gcTime: 1000 * 60 * 10,
    refetchInterval: pollWhileRunning ? 3000 : false,
  });
}

export function useCreateLeadGenSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createLeadGenSession.bind(api),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lead-gen-sessions'] }),
  });
}

export function useCancelLeadGenSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.cancelLeadGenSession(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['lead-gen-session', id] });
      queryClient.invalidateQueries({ queryKey: ['lead-gen-sessions'] });
    },
  });
}

export function useImportLeadGenResults() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, resultIds }: { sessionId: string; resultIds: string[] }) =>
      api.importLeadGenResults(sessionId, resultIds),
    onSuccess: (_data, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: ['lead-gen-session', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useLeadGenSavedSearches() {
  return useQuery({
    queryKey: ['lead-gen-saved'],
    queryFn: () => api.listLeadGenSavedSearches(),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 20,
  });
}

export function useSaveLeadGenSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.saveLeadGenSearch.bind(api),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lead-gen-saved'] }),
  });
}

export function useDeleteLeadGenSavedSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteLeadGenSavedSearch(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lead-gen-saved'] }),
  });
}
