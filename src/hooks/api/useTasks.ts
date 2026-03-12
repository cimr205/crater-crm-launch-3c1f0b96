import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useTasks(params?: { status?: string }) {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: () => api.listTasks(params),
    staleTime: 1000 * 60 * 3,
    gcTime: 1000 * 60 * 8,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; type?: string; due_at?: string; lead_id?: string; customer_id?: string }) =>
      api.createTask(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; status?: string; title?: string }) =>
      api.updateTask(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });
}
