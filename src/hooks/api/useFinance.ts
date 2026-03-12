import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useCustomers(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['customers', params],
    queryFn: () => api.getCustomers(params),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });
}

export function useInvoices(params?: { page?: number; limit?: number; status?: string }) {
  return useQuery({
    queryKey: ['invoices', params],
    queryFn: () => api.getInvoices(params),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });
}

export function usePayments(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['payments', params],
    queryFn: () => api.getPayments(params),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });
}
