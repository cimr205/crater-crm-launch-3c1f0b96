import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AutopilotAction {
  id: string;
  company_id: string;
  suggested_by: string | null;
  action_type: string;
  payload: Record<string, unknown>;
  status: 'proposed' | 'approved' | 'executed' | 'dismissed';
  executed_at: string | null;
  result: Record<string, unknown> | null;
  created_at: string;
}

export interface WorkspaceEvent {
  id: string;
  company_id: string;
  type: string;
  source_module: string | null;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown>;
  actor_user_id: string | null;
  created_at: string;
}

export function useAutopilotActions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['autopilot_actions', user?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('autopilot_actions')
        .select('*')
        .eq('company_id', user!.company_id!)
        .in('status', ['proposed', 'approved'])
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as AutopilotAction[];
    },
    enabled: !!user?.company_id,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
  });
}

export function useWorkspaceEventsFeed() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['workspace_events_feed', user?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workspace_events')
        .select('*')
        .eq('company_id', user!.company_id!)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as WorkspaceEvent[];
    },
    enabled: !!user?.company_id,
    staleTime: 1000 * 15,
  });
}

export function useApproveAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ actionId, authHeader }: { actionId: string; authHeader: string }) => {
      // Mark approved in DB
      const { error } = await supabase
        .from('autopilot_actions')
        .update({ status: 'approved' })
        .eq('id', actionId);
      if (error) throw error;

      // Call autopilot-execute
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/autopilot-execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ action_id: actionId }),
      });
      if (!res.ok) throw new Error(`Execute failed: ${res.status}`);
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['autopilot_actions'] }),
  });
}

export function useDismissAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (actionId: string) => {
      const { error } = await supabase
        .from('autopilot_actions')
        .update({ status: 'dismissed' })
        .eq('id', actionId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['autopilot_actions'] }),
  });
}
