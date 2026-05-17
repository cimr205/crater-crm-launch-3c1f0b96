import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface EventSubscription {
  id: string;
  company_id: string;
  event_pattern: string;
  action_type: 'workflow' | 'webhook' | 'autopilot';
  action_ref: string;
  is_active: boolean;
  conditions: Condition[];
  created_at: string;
  updated_at: string;
}

export interface Condition {
  field: string;
  op: string;
  value: string;
}

export interface CreateSubscriptionInput {
  event_pattern: string;
  action_type: 'workflow' | 'webhook' | 'autopilot';
  action_ref: string;
  conditions?: Condition[];
}

export function useEventSubscriptions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['event_subscriptions', user?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_subscriptions')
        .select('*')
        .eq('company_id', user!.company_id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as EventSubscription[];
    },
    enabled: !!user?.company_id,
    staleTime: 1000 * 60 * 2,
  });
}

export function useCreateSubscription() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSubscriptionInput) => {
      const { data, error } = await supabase
        .from('event_subscriptions')
        .insert({ ...input, company_id: user!.company_id!, conditions: input.conditions ?? [] })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event_subscriptions'] }),
  });
}

export function useUpdateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<EventSubscription> & { id: string }) => {
      const { error } = await supabase
        .from('event_subscriptions')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event_subscriptions'] }),
  });
}

export function useDeleteSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('event_subscriptions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event_subscriptions'] }),
  });
}
