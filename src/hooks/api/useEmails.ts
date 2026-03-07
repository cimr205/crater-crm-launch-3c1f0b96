import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useEmails(params?: { folder?: string; q?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['emails', params],
    queryFn: () => api.listEmails(params),
  });
}

export function useSendEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { to: string[]; subject: string; body: string; cc?: string[]; bcc?: string[]; replyTo?: string }) =>
      api.sendEmail(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['emails'] }),
  });
}
