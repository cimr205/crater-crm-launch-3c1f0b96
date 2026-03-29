import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

const TTL = 1000 * 60 * 4;
const GC = 1000 * 60 * 10;

export function useLeadDashboard() {
  return useQuery({ queryKey: ['lead-dashboard'], queryFn: () => api.getLeadDashboard(), staleTime: TTL, gcTime: GC });
}

export function useDashboard() {
  return useQuery({ queryKey: ['dashboard'], queryFn: () => api.getDashboard(), staleTime: TTL, gcTime: GC });
}

export function useInvoiceStats() {
  return useQuery({ queryKey: ['invoice-stats'], queryFn: () => api.getInvoiceStats(), staleTime: TTL, gcTime: GC });
}

export function usePaymentStats() {
  return useQuery({ queryKey: ['payment-stats'], queryFn: () => api.getPaymentStats(), staleTime: TTL, gcTime: GC });
}

export function useDailyFocus() {
  return useQuery({ queryKey: ['daily-focus'], queryFn: () => api.getDailyFocus(), staleTime: TTL, gcTime: GC });
}

export function useMetaStatus() {
  return useQuery({ queryKey: ['meta-status'], queryFn: () => api.getMetaStatus(), staleTime: TTL, gcTime: GC });
}

export function useMetaCampaigns(enabled: boolean) {
  return useQuery({ queryKey: ['meta-campaigns'], queryFn: () => api.getMetaCampaigns(), staleTime: TTL, gcTime: GC, enabled });
}
