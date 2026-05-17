import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DailyBrief {
  id: string;
  company_id: string;
  date: string;
  content: string;
  created_at: string;
}

export function useDailyBrief() {
  const { user } = useAuth();
  const today = new Date().toISOString().split('T')[0];
  return useQuery({
    queryKey: ['daily_brief', user?.company_id, today],
    queryFn: async () => {
      const { data } = await supabase
        .from('daily_briefs')
        .select('*')
        .eq('company_id', user!.company_id!)
        .eq('date', today)
        .maybeSingle();
      return data as DailyBrief | null;
    },
    enabled: !!user?.company_id,
    staleTime: 1000 * 60 * 10,
  });
}

export function useGenerateBrief() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey     = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/autopilot-brief`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
        },
        body: JSON.stringify({ company_id: user?.company_id }),
      });
      if (!res.ok) throw new Error(`Brief generation failed: ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily_brief'] });
    },
  });
}
