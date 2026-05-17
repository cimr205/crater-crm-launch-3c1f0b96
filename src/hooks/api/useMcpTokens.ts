import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface McpToken {
  id: string;
  company_id: string;
  name: string;
  token: string;
  created_at: string;
  last_used_at: string | null;
}

export function useMcpTokens() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['mcp_tokens', user?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mcp_tokens')
        .select('*')
        .eq('company_id', user!.company_id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as McpToken[];
    },
    enabled: !!user?.company_id,
    staleTime: 1000 * 60 * 5,
  });
}

export function useIssueMcpToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.rpc('issue_mcp_token', { token_name: name });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mcp_tokens'] }),
  });
}

export function useRevokeMcpToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('mcp_tokens').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mcp_tokens'] }),
  });
}
