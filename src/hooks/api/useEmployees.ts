import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useEmployees() {
  return useQuery({
    queryKey: ['employees'],
    queryFn: () => api.getCompanyUsers(),
  });
}

export function useUpdateEmployeeRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.updateCompanyUserRole(userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });
}
