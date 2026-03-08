import { useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

const POLL_INTERVAL = 30_000; // 30 seconds

/**
 * Polls for new leads, open tasks and AI suggestions every 30s.
 * Shows a toast notification when new items are detected since last poll.
 * Mount once in AppShell so it runs globally while the user is logged in.
 */
export function useNotificationPoller() {
  const { toast } = useToast();

  // Store last-known counts in refs so they don't trigger re-renders
  const lastLeadCount = useRef<number | null>(null);
  const lastTaskCount = useRef<number | null>(null);
  const lastAiCount = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const [leadsRes, tasksRes, aiRes] = await Promise.allSettled([
          api.listLeads({ status: 'new' }),
          api.listTasks({ status: 'open' }),
          api.listAiActions(),
        ]);

        if (cancelled) return;

        // ── Leads ──────────────────────────────────────────────────────────
        if (leadsRes.status === 'fulfilled') {
          const count: number =
            (leadsRes.value as { data?: unknown[] }).data?.length ??
            (leadsRes.value as { leads?: unknown[] }).leads?.length ??
            0;
          if (lastLeadCount.current !== null && count > lastLeadCount.current) {
            const diff = count - lastLeadCount.current;
            toast({
              title: `${diff} ny${diff > 1 ? 'e' : ''} lead${diff > 1 ? 's' : ''}`,
              description: 'Nye leads er klar til opfølgning',
            });
          }
          lastLeadCount.current = count;
        }

        // ── Tasks ──────────────────────────────────────────────────────────
        if (tasksRes.status === 'fulfilled') {
          const count: number =
            (tasksRes.value as { data?: unknown[] }).data?.length ??
            (tasksRes.value as { tasks?: unknown[] }).tasks?.length ??
            0;
          if (lastTaskCount.current !== null && count > lastTaskCount.current) {
            const diff = count - lastTaskCount.current;
            toast({
              title: `${diff} ny${diff > 1 ? 'e' : ''} opgave${diff > 1 ? 'r' : ''}`,
              description: 'Nye opgaver kræver din opmærksomhed',
            });
          }
          lastTaskCount.current = count;
        }

        // ── AI suggestions ─────────────────────────────────────────────────
        if (aiRes.status === 'fulfilled') {
          const pending = (aiRes.value as { actions?: Array<{ status?: string }> }).actions
            ?.filter((a) => a.status === 'pending').length ?? 0;
          if (lastAiCount.current !== null && pending > lastAiCount.current) {
            const diff = pending - lastAiCount.current;
            toast({
              title: `${diff} nyt AI-forslag`,
              description: 'AI har nye forslag klar til godkendelse',
            });
          }
          lastAiCount.current = pending;
        }
      } catch {
        // Poller errors are silent — don't disturb the user
      }
    };

    // Initial poll after 5s (let the page settle first)
    const initialTimeout = setTimeout(() => void poll(), 5_000);
    const interval = setInterval(() => void poll(), POLL_INTERVAL);

    return () => {
      cancelled = true;
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [toast]);
}
