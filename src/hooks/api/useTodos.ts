import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useTodos(params?: { status?: string; assignedTo?: string }) {
  return useQuery({
    queryKey: ['todos', params],
    queryFn: () => api.listTodos(params),
  });
}

export function useCreateTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; description?: string; dueDate?: string; assignedTo?: string }) =>
      api.createTodo(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  });
}

export function useUpdateTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; status?: string; title?: string; description?: string; dueDate?: string }) =>
      api.updateTodo(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  });
}

export function useDeleteTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTodo(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  });
}
