import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type GmailMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { isLocale } from '@/lib/i18n';
import {
  Inbox, Mail, AlertCircle, Calendar, Clock, Star, RefreshCw,
  CheckSquare, X, ExternalLink
} from 'lucide-react';

// ─── Priority engine ──────────────────────────────────────────────────────────

const HIGH_PRIORITY_KEYWORDS = [
  'møde', 'meeting', 'mødeinvitation', 'invitation',
  'deadline', 'vigtig', 'urgent', 'haster', 'asap',
  'faktura', 'invoice', 'betaling', 'payment', 'forfald', 'overdue',
  'kontrakt', 'contract', 'tilbud', 'offer',
  'interview', 'opkald', 'call', 'følg op', 'follow up',
];

const TODO_KEYWORDS = [
  'møde', 'meeting', 'deadline', 'haster', 'urgent', 'asap',
  'follow up', 'følg op', 'opkald', 'call',
];

function getPriority(msg: GmailMessage): 'high' | 'normal' {
  const text = `${msg.subject} ${msg.snippet}`.toLowerCase();
  return HIGH_PRIORITY_KEYWORDS.some(kw => text.includes(kw)) ? 'high' : 'normal';
}

function isTodoCandidate(msg: GmailMessage): boolean {
  const text = `${msg.subject} ${msg.snippet}`.toLowerCase();
  return TODO_KEYWORDS.some(kw => text.includes(kw));
}

function getPriorityReason(msg: GmailMessage): string {
  const text = `${msg.subject} ${msg.snippet}`.toLowerCase();
  if (['møde', 'meeting', 'mødeinvitation', 'interview'].some(k => text.includes(k))) return 'Møde';
  if (['deadline', 'haster', 'urgent', 'asap'].some(k => text.includes(k))) return 'Deadline';
  if (['faktura', 'invoice', 'betaling', 'payment', 'forfald'].some(k => text.includes(k))) return 'Betaling';
  if (['kontrakt', 'tilbud'].some(k => text.includes(k))) return 'Kontrakt';
  return 'Vigtig';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return 'Lige nu';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} t`;
    if (diff < 7 * 86_400_000) {
      return d.toLocaleDateString('da-DK', { weekday: 'short' });
    }
    return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}

function extractName(from: string): string {
  const match = from.match(/^([^<]+)</);
  if (match) return match[1].trim().replace(/"/g, '');
  return from.split('@')[0];
}

// ─── Todo suggestion pill ─────────────────────────────────────────────────────

function TodoSuggestion({ msg, onAdd, onDismiss }: {
  msg: GmailMessage;
  onAdd: (msg: GmailMessage) => void;
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 text-sm">
      <CheckSquare className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
      <span className="flex-1 text-blue-800 dark:text-blue-300 truncate">
        <span className="font-medium">Tilføj til To-do?</span> — {msg.subject}
      </span>
      <Button size="sm" variant="ghost" className="h-6 px-2 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800" onClick={() => onAdd(msg)}>
        Ja
      </Button>
      <button className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-200" onClick={() => onDismiss(msg.id)}>
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Main inbox ───────────────────────────────────────────────────────────────

export default function InboxPage() {
  const { toast } = useToast();
  const params = useParams();
  const navigate = useNavigate();
  const locale = isLocale(params.locale) ? params.locale : 'en';

  const [connected, setConnected] = useState<boolean | null>(null);
  const [gmailEmail, setGmailEmail] = useState('');
  const [todoSyncEnabled, setTodoSyncEnabled] = useState(true);
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [dismissedTodos, setDismissedTodos] = useState<Set<string>>(new Set());
  const [addingTodo, setAddingTodo] = useState<string | null>(null);

  useEffect(() => {
    void checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const status = await api.getGmailStatus();
      setConnected(status.connected);
      if (status.gmail_email) setGmailEmail(status.gmail_email);
      if (status.todo_sync_enabled !== undefined) setTodoSyncEnabled(status.todo_sync_enabled);
      if (status.connected) void fetchMessages();
    } catch {
      setConnected(false);
    }
  };

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const msgs = await api.getGmailMessages('INBOX');
      setMessages(msgs);
    } catch (err) {
      toast({ title: (err as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { auth_url } = await api.getGmailAuthUrl();
      window.location.href = auth_url;
    } catch (err) {
      toast({ title: (err as Error).message, variant: 'destructive' });
      setConnecting(false);
    }
  };

  const handleAddTodo = async (msg: GmailMessage) => {
    setAddingTodo(msg.id);
    try {
      await api.createTodo({ title: msg.subject, description: `Fra: ${msg.from}\n\n${msg.snippet}` });
      toast({ title: 'To-do tilføjet' });
      setDismissedTodos(prev => new Set([...prev, msg.id]));
    } catch (err) {
      toast({ title: (err as Error).message, variant: 'destructive' });
    } finally {
      setAddingTodo(null);
    }
  };

  const handleDismissTodo = (id: string) => {
    setDismissedTodos(prev => new Set([...prev, id]));
  };

  const handleToggleTodoSync = async () => {
    const newVal = !todoSyncEnabled;
    setTodoSyncEnabled(newVal);
    try {
      await api.updateGmailSettings({ todo_sync_enabled: newVal });
    } catch {
      setTodoSyncEnabled(!newVal);
    }
  };

  // Sort: high priority first, then by date
  const sortedMessages = [...messages].sort((a, b) => {
    const pa = getPriority(a) === 'high' ? 0 : 1;
    const pb = getPriority(b) === 'high' ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return Number(b.internalDate) - Number(a.internalDate);
  });

  const highPriority = sortedMessages.filter(m => getPriority(m) === 'high');
  const todoSuggestions = todoSyncEnabled
    ? sortedMessages.filter(m => isTodoCandidate(m) && !dismissedTodos.has(m.id)).slice(0, 3)
    : [];

  // ── Not connected state ──────────────────────────────────────────────────────

  if (connected === false) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Indbakke</h1>
          <p className="text-sm text-muted-foreground">Gmail-synkronisering</p>
        </div>
        <div className="rounded-2xl border bg-card p-12 flex flex-col items-center justify-center gap-5 text-center max-w-md mx-auto">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <Mail className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-1">Forbind din Gmail</h3>
            <p className="text-sm text-muted-foreground">
              Tilslut din Gmail-konto for at se alle dine emails direkte i CRM'et med smart prioritering og To-do synkronisering.
            </p>
          </div>
          <div className="space-y-2 text-sm text-left w-full bg-muted/40 rounded-lg p-4">
            <div className="flex items-center gap-2"><Star className="h-4 w-4 text-yellow-500" /><span>Auto-prioritering af vigtige emails</span></div>
            <div className="flex items-center gap-2"><CheckSquare className="h-4 w-4 text-blue-500" /><span>Møder og deadlines → To-do liste</span></div>
            <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-green-500" /><span>Send emails direkte fra CRM</span></div>
          </div>
          <Button onClick={handleConnect} disabled={connecting} className="w-full">
            {connecting ? 'Forbinder...' : 'Forbind Gmail'}
          </Button>
          <p className="text-xs text-muted-foreground">
            Gå til <button className="underline" onClick={() => navigate(`/${locale}/app/emails`)}>Emails</button> for at sende emails
          </p>
        </div>
      </div>
    );
  }

  // ── Loading state ────────────────────────────────────────────────────────────

  if (connected === null) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />Forbinder...
      </div>
    );
  }

  // ── Connected state ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Indbakke</h1>
          <p className="text-sm text-muted-foreground">{gmailEmail}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`text-xs px-2 py-1 rounded-full border transition-colors ${todoSyncEnabled ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' : 'bg-muted text-muted-foreground border-border'}`}
            onClick={handleToggleTodoSync}
            title="To-do synk til/fra"
          >
            <CheckSquare className="h-3 w-3 inline mr-1" />
            To-do synk {todoSyncEnabled ? 'til' : 'fra'}
          </button>
          <Button size="sm" variant="outline" onClick={fetchMessages} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />Opdater
          </Button>
        </div>
      </div>

      {/* To-do suggestions */}
      {todoSuggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Foreslåede To-dos</p>
          {todoSuggestions.map(msg => (
            <TodoSuggestion
              key={msg.id}
              msg={msg}
              onAdd={m => void handleAddTodo(m)}
              onDismiss={handleDismissTodo}
            />
          ))}
        </div>
      )}

      {/* Today's priorities panel */}
      {highPriority.length > 0 && (
        <div className="rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Star className="h-4 w-4 text-yellow-500" />
            <p className="text-sm font-semibold">Dagens prioriteter ({highPriority.length})</p>
          </div>
          <div className="space-y-2">
            {highPriority.slice(0, 3).map(msg => (
              <div key={msg.id} className="flex items-start gap-3 text-sm">
                <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 shrink-0">
                  {getPriorityReason(msg)}
                </span>
                <div className="flex-1 min-w-0">
                  <span className={`font-medium ${!msg.read ? 'text-foreground' : 'text-muted-foreground'}`}>{msg.subject}</span>
                  <span className="text-muted-foreground ml-2 text-xs">{extractName(msg.from)}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{formatDate(msg.date)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full email list */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />Henter emails...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
            <Inbox className="h-10 w-10 opacity-40" />
            <p>Ingen emails</p>
          </div>
        ) : (
          <div className="divide-y">
            {sortedMessages.map(msg => {
              const priority = getPriority(msg);
              const isAdding = addingTodo === msg.id;
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-muted/20 transition-colors group ${!msg.read ? 'bg-muted/10' : ''}`}
                >
                  {/* Priority indicator */}
                  <div className="shrink-0 mt-1">
                    {priority === 'high' ? (
                      <div className="h-2 w-2 rounded-full bg-yellow-500" title="Høj prioritet" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-muted" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className={`text-sm truncate ${!msg.read ? 'font-semibold' : 'font-medium text-muted-foreground'}`}>
                        {extractName(msg.from)}
                      </span>
                      {priority === 'high' && (
                        <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 shrink-0">
                          {getPriorityReason(msg)}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm truncate ${!msg.read ? 'font-medium' : 'text-muted-foreground'}`}>{msg.subject}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{msg.snippet}</p>
                  </div>

                  {/* Right side */}
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span className="text-xs text-muted-foreground">{formatDate(msg.date)}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isTodoCandidate(msg) && !dismissedTodos.has(msg.id) && todoSyncEnabled && (
                        <button
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          disabled={isAdding}
                          onClick={() => void handleAddTodo(msg)}
                        >
                          {isAdding ? '...' : '+ To-do'}
                        </button>
                      )}
                      <a
                        href={`https://mail.google.com/mail/u/0/#inbox/${msg.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                        title="Åbn i Gmail"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
