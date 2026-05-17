import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { WorkspaceEvent } from '@/hooks/api/useAutopilot';

export function useWorkspaceEvents(onEvent: (event: WorkspaceEvent) => void) {
  const { user } = useAuth();
  const companyId = user?.company_id;

  const stableHandler = useCallback(onEvent, [onEvent]);

  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel(`workspace-events-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'workspace_events',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => stableHandler(payload.new as WorkspaceEvent)
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [companyId, stableHandler]);
}
