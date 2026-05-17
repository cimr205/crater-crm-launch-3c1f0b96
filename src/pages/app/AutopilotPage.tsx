import { useState, useCallback, useRef, useEffect } from 'react';
import { Send, Check, X, Zap, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/i18n';
import { DailyBriefCard } from '@/components/autopilot/DailyBriefCard';
import {
  useAutopilotActions,
  useWorkspaceEventsFeed,
  useApproveAction,
  useDismissAction,
  type WorkspaceEvent,
  type AutopilotAction,
} from '@/hooks/api/useAutopilot';
import { useWorkspaceEvents } from '@/hooks/useWorkspaceEvents';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000)  return 'nu';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}t`;
  return `${Math.floor(diff / 86400000)}d`;
}

function EventTypeChip({ type }: { type: string }) {
  const color =
    type.startsWith('deal.won')     ? 'bg-emerald-500/20 text-emerald-400' :
    type.startsWith('deal.lost')    ? 'bg-red-500/20 text-red-400' :
    type.startsWith('invoice.paid') ? 'bg-cyan-500/20 text-cyan-400' :
    type.startsWith('lead.')        ? 'bg-blue-500/20 text-blue-400' :
    'bg-muted text-muted-foreground';
  return (
    <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${color}`}>{type}</span>
  );
}

function SignalFeed({ events }: { events: WorkspaceEvent[] }) {
  const { t } = useI18n();
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground p-4">{t('autopilot.noEvents')}</p>;
  }
  return (
    <div className="space-y-1 p-2">
      {events.map(ev => (
        <div key={ev.id} className="flex items-start gap-2 rounded-lg px-3 py-2 hover:bg-muted/40 transition-colors">
          <Zap className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <EventTypeChip type={ev.type} />
              {ev.entity_type && (
                <span className="text-xs text-muted-foreground capitalize">{ev.entity_type}</span>
              )}
            </div>
            {ev.payload && Object.keys(ev.payload).length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {Object.entries(ev.payload)
                  .filter(([, v]) => v !== null && v !== undefined)
                  .slice(0, 3)
                  .map(([k, v]) => `${k}: ${String(v)}`)
                  .join(' · ')}
              </p>
            )}
          </div>
          <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />{timeAgo(ev.created_at)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ActionQueue({ actions }: { actions: AutopilotAction[] }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const approveMutation = useApproveAction();
  const dismissMutation = useDismissAction();

  const handleApprove = async (action: AutopilotAction) => {
    const { data: { session } } = await supabase.auth.getSession();
    await approveMutation.mutateAsync({
      actionId: action.id,
      authHeader: `Bearer ${session?.access_token ?? ''}`,
    });
    toast({ title: 'Handling godkendt og udført' });
  };

  if (actions.length === 0) {
    return <p className="text-sm text-muted-foreground p-4">{t('autopilot.noActions')}</p>;
  }

  return (
    <div className="space-y-2 p-2">
      {actions.map(action => (
        <div key={action.id} className="rounded-lg border border-border bg-card/60 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="text-xs capitalize">{action.action_type}</Badge>
            <span className="text-xs text-muted-foreground">{timeAgo(action.created_at)}</span>
          </div>
          <div className="text-sm">
            {action.payload && (
              <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-words">
                {JSON.stringify(action.payload, null, 2)}
              </pre>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground"
              onClick={() => dismissMutation.mutate(action.id)}
              disabled={dismissMutation.isPending}
            >
              <X className="h-3 w-3" />{t('autopilot.dismiss')}
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => handleApprove(action)}
              disabled={approveMutation.isPending}
            >
              <Check className="h-3 w-3" />{t('autopilot.approve')}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

interface ChatMessage { role: 'user' | 'assistant'; content: string; }

function ChatPanel() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey     = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/autopilot-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: anonKey },
        body: JSON.stringify({ chat_message: text, read_only: false }),
      });
      const json = await res.json() as { reply?: string; error?: string };
      setMessages(m => [...m, { role: 'assistant', content: json.reply ?? json.error ?? 'Ingen svar' }]);
    } catch (err) {
      toast({ title: (err as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <Skeleton className="h-8 w-32 rounded-xl" />
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      <div className="border-t border-border p-3 flex gap-2">
        <Textarea
          placeholder={t('autopilot.chatPlaceholder')}
          value={input}
          onChange={e => setInput(e.target.value)}
          rows={1}
          className="resize-none min-h-[36px] max-h-[120px]"
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }}}
        />
        <Button size="icon" onClick={() => void send()} disabled={loading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function AutopilotPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: actions = [], isLoading: actionsLoading } = useAutopilotActions();
  const { data: events  = [], isLoading: eventsLoading  } = useWorkspaceEventsFeed();

  // Realtime: invalidate queries when new events arrive
  useWorkspaceEvents(useCallback(() => {
    qc.invalidateQueries({ queryKey: ['workspace_events_feed'] });
    qc.invalidateQueries({ queryKey: ['autopilot_actions'] });
  }, [qc]));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('autopilot.title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('autopilot.subtitle')}</p>
      </div>

      <DailyBriefCard />

      {/* Mobile: tabs. Desktop: 3 columns */}
      <div className="md:hidden">
        <Tabs defaultValue="feed">
          <TabsList className="w-full">
            <TabsTrigger value="feed" className="flex-1">{t('autopilot.feed')}</TabsTrigger>
            <TabsTrigger value="queue" className="flex-1">
              {t('autopilot.queue')}
              {actions.length > 0 && (
                <Badge className="ml-1.5 h-4 px-1 text-xs">{actions.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex-1">{t('autopilot.chat')}</TabsTrigger>
          </TabsList>
          <TabsContent value="feed">
            <div className="rounded-xl border border-border bg-card/70 min-h-[300px]">
              {eventsLoading ? <Skeleton className="h-40 m-4" /> : <SignalFeed events={events} />}
            </div>
          </TabsContent>
          <TabsContent value="queue">
            <div className="rounded-xl border border-border bg-card/70 min-h-[300px]">
              {actionsLoading ? <Skeleton className="h-40 m-4" /> : <ActionQueue actions={actions} />}
            </div>
          </TabsContent>
          <TabsContent value="chat">
            <div className="rounded-xl border border-border bg-card/70 h-[400px] flex flex-col overflow-hidden">
              <ChatPanel />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <div className="hidden md:grid md:grid-cols-3 gap-4">
        {/* Signal Feed */}
        <div className="rounded-xl border border-border bg-card/70 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-medium">{t('autopilot.feed')}</h2>
          </div>
          <ScrollArea className="h-[500px]">
            {eventsLoading ? <Skeleton className="h-40 m-4" /> : <SignalFeed events={events} />}
          </ScrollArea>
        </div>

        {/* Action Queue */}
        <div className="rounded-xl border border-border bg-card/70 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <h2 className="text-sm font-medium">{t('autopilot.queue')}</h2>
            {actions.length > 0 && (
              <Badge className="h-4 px-1 text-xs">{actions.length}</Badge>
            )}
          </div>
          <ScrollArea className="h-[500px]">
            {actionsLoading ? <Skeleton className="h-40 m-4" /> : <ActionQueue actions={actions} />}
          </ScrollArea>
        </div>

        {/* Chat */}
        <div className="rounded-xl border border-border bg-card/70 overflow-hidden h-[548px] flex flex-col">
          <div className="px-4 py-3 border-b border-border shrink-0">
            <h2 className="text-sm font-medium">{t('autopilot.chat')}</h2>
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
