import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type GmailMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { isLocale } from '@/lib/i18n';
import { isConfigured, getServiceConfig } from '@/lib/serviceConfig';
import * as ee from '@/lib/emailengine';
import * as ac from '@/lib/emailclassify';
import {
  Inbox, Mail, Star, RefreshCw, CheckSquare, X, ExternalLink, Settings
} from 'lucide-react';

// ─── Priority engine (keyword fallback) ──────────────────────────────────────

const HIGH_PRIORITY_KEYWORDS = [
  'møde', 'meeting', 'mødeinvitation', 'invitation',
  'deadline', 'vigtig', 'urgent', 'haster', 'asap',
  'faktura', 'invoice', 'betaling', 'payment', 'forfald', 'overdue',
  'kontrakt', 'contract', 'tilbud', 'offer',
  'interview', 'opkald', 'call', 'følg op', 'follow up',
];
const TODO_KEYWORDS = ['møde', 'meeting', 'deadline', 'haster', 'urgent', 'asap', 'follow up', 'følg op', 'opkald', 'call'];

function kwPriority(subject: string, snippet: string): 'high' | 'normal' {
  const text = `${subject} ${snippet}`.toLowerCase();
  return HIGH_PRIORITY_KEYWORDS.some((k) => text.includes(k)) ? 'high' : 'normal';
}
function isTodoCand(subject: string, snippet: string): boolean {
  const text = `${subject} ${snippet}`.toLowerCase();
  return TODO_KEYWORDS.some((k) => text.includes(k));
}
function prioReason(subject: string, snippet: string): string {
  const t = `${subject} ${snippet}`.toLowerCase();
  if (['møde', 'meeting', 'interview'].some((k) => t.includes(k))) return 'Møde';
  if (['deadline', 'haster', 'urgent', 'asap'].some((k) => t.includes(k))) return 'Deadline';
  if (['faktura', 'invoice', 'betaling', 'payment', 'forfald'].some((k) => t.includes(k))) return 'Betaling';
  if (['kontrakt', 'tilbud'].some((k) => t.includes(k))) return 'Kontrakt';
  return 'Vigtig';
}

// ─── Unified message type ─────────────────────────────────────────────────────

interface UnifiedMessage {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  internalDate: string;
  read: boolean;
  snippet: string;
  priority: 'high' | 'normal';
  priorityLabel: string;
  isTodoCandidate: boolean;
  source: 'emailengine' | 'gmail';
}

function mapEE(msg: ee.EEMessage, aiPrio: 'high' | 'normal' = 'normal'): UnifiedMessage {
  const fromArr = msg.from ?? [];
  const fromStr = fromArr.length ? `${fromArr[0].name ?? ''} <${fromArr[0].address}>`.trim() : '';
  const toArr = msg.to ?? [];
  const preview = msg.preview ?? msg.text?.plain?.slice(0, 120) ?? '';
  const subject = msg.subject ?? '(ingen emne)';
  const kp = kwPriority(subject, preview);
  return {
    id: msg.id,
    subject,
    from: fromStr,
    to: toArr.map((t) => t.address).join(', '),
    date: msg.date,
    internalDate: String(new Date(msg.date).getTime()),
    read: msg.seen,
    snippet: preview,
    priority: aiPrio === 'high' || kp === 'high' ? 'high' : 'normal',
    priorityLabel: prioReason(subject, preview),
    isTodoCandidate: isTodoCand(subject, preview),
    source: 'emailengine',
  };
}

function mapGmail(msg: GmailMessage): UnifiedMessage {
  const subject = msg.subject ?? '(ingen emne)';
  const snippet = msg.snippet ?? '';
  return {
    id: msg.id,
    subject,
    from: msg.from ?? '',
    to: msg.to ?? '',
    date: msg.date,
    internalDate: msg.internalDate ?? String(Date.now()),
    read: msg.read ?? false,
    snippet,
    priority: kwPriority(subject, snippet),
    priorityLabel: prioReason(subject, snippet),
    isTodoCandidate: isTodoCand(subject, snippet),
    source: 'gmail',
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return 'Lige nu';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} t`;
    if (diff < 7 * 86_400_000) return d.toLocaleDateString('da-DK', { weekday: 'short' });
    return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
  } catch { return dateStr; }
}
function extractName(from: string): string {
  const m = from.match(/^([^<]+)</);
  return m ? m[1].trim().replace(/"/g, '') : from.split('@')[0];
}

// ─── Todo suggestion pill ─────────────────────────────────────────────────────

function TodoSuggestion({ msg, onAdd, onDismiss }: {
  msg: UnifiedMessage;
  onAdd: (msg: UnifiedMessage) => void;
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 text-sm">
      <CheckSquare className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
      <span className="flex-1 text-blue-800 dark:text-blue-300 truncate">
        <span className="font-medium">Tilføj til To-do?</span> — {msg.subject}
      </span>
      <Button size="sm" variant="ghost" className="h-6 px-2 text-blue-700 dark:text-blue-300 hover:bg-blue-100" onClick={() => onAdd(msg)}>
        Ja
      </Button>
      <button className="text-blue-400 hover:text-blue-600" onClick={() => onDismiss(msg.id)}>
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

  const useEmailEngine = isConfigured('emailengine');
  const useAiClassify = isConfigured('aiclassify');
  const eeAccountId = useEmailEngine ? (getServiceConfig('emailengine')?.accountId ?? '') : '';

  const [messages, setMessages] = useState<UnifiedMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [accountLabel, setAccountLabel] = useState('');

  // Gmail-only state
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [todoSyncEnabled, setTodoSyncEnabled] = useState(true);

  const [dismissedTodos, setDismissedTodos] = useState<Set<string>>(new Set());
  const [addingTodo, setAddingTodo] = useState<string | null>(null);

  const _classifyCache = useRef<Record<string, 'high' | 'normal'>>({});

  useEffect(() => {
    if (useEmailEngine) void fetchEE();
    else void checkGmail();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── EmailEngine ───────────────────────────────────────────────────────────────

  const fetchEE = async () => {
    if (!eeAccountId) return;
    setLoading(true);
    try {
      const raw = await ee.listMessages(eeAccountId, 'INBOX');
      setAccountLabel(eeAccountId);
      let mapped = raw.map((m) => mapEE(m));

      if (useAiClassify && mapped.length > 0) {
        try {
          const results = await ac.batchClassify(
            mapped.map((m) => ({ subject: m.subject, body: m.snippet, sender: m.from })),
          );
          mapped = mapped.map((m, i) => {
            const ai = results[i];
            if (!ai) return m;
            _classifyCache.current[m.id] = ai.priority === 'high' ? 'high' : 'normal';
            return { ...m, priority: _classifyCache.current[m.id] };
          });
        } catch { /* fallback to keyword priority */ }
      }

      setMessages(sortMessages(mapped));
    } catch (err) {
      toast({ title: (err as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ── Gmail ─────────────────────────────────────────────────────────────────────

  const checkGmail = async () => {
    try {
      const status = await api.getGmailStatus();
      setGmailConnected(status.connected);
      if (status.todo_sync_enabled !== undefined) setTodoSyncEnabled(status.todo_sync_enabled);
      if (status.gmail_email) setAccountLabel(status.gmail_email);
      if (status.connected) void fetchGmail();
    } catch { setGmailConnected(false); }
  };

  const fetchGmail = async () => {
    setLoading(true);
    try {
      const msgs = await api.getGmailMessages('INBOX');
      setMessages(sortMessages(msgs.map(mapGmail)));
    } catch (err) {
      toast({ title: (err as Error).message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const handleConnectGmail = async () => {
    setConnecting(true);
    try {
      const { auth_url } = await api.getGmailAuthUrl();
      window.location.href = auth_url;
    } catch (err) {
      toast({ title: (err as Error).message, variant: 'destructive' });
      setConnecting(false);
    }
  };

  const handleToggleTodoSync = async () => {
    const v = !todoSyncEnabled;
    setTodoSyncEnabled(v);
    try { await api.updateGmailSettings({ todo_sync_enabled: v }); }
    catch { setTodoSyncEnabled(!v); }
  };

  // ── To-do ─────────────────────────────────────────────────────────────────────

  const handleAddTodo = async (msg: UnifiedMessage) => {
    setAddingTodo(msg.id);
    try {
      await api.createTodo({ title: msg.subject, description: `Fra: ${msg.from}\n\n${msg.snippet}` });
      toast({ title: 'To-do tilføjet' });
      setDismissedTodos((p) => new Set([...p, msg.id]));
    } catch (err) {
      toast({ title: (err as Error).message, variant: 'destructive' });
    } finally { setAddingTodo(null); }
  };

  // ── Derived ───────────────────────────────────────────────────────────────────

  function sortMessages(msgs: UnifiedMessage[]) {
    return msgs.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1;
      return Number(b.internalDate) - Number(a.internalDate);
    });
  }

  const highPriority = messages.filter((m) => m.priority === 'high');
  const todoSuggestions = todoSyncEnabled
    ? messages.filter((m) => m.isTodoCandidate && !dismissedTodos.has(m.id)).slice(0, 3)
    : [];

  // ── States ────────────────────────────────────────────────────────────────────

  if (useEmailEngine && !eeAccountId) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-semibold">Indbakke</h1></div>
        <div className="rounded-2xl border bg-card p-12 flex flex-col items-center gap-5 text-center max-w-md mx-auto">
          <Mail className="h-12 w-12 text-muted-foreground/40" />
          <div>
            <h3 className="text-lg font-semibold mb-1">EmailEngine konto mangler</h3>
            <p className="text-sm text-muted-foreground">Angiv account ID under Integrationer → EmailEngine.</p>
          </div>
          <Button onClick={() => navigate(`/${locale}/app/integrations`)}>
            <Settings className="h-4 w-4 mr-2" />Gå til Integrationer
          </Button>
        </div>
      </div>
    );
  }

  if (!useEmailEngine && gmailConnected === false) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-semibold">Indbakke</h1><p className="text-sm text-muted-foreground">E-mail synkronisering</p></div>
        <div className="rounded-2xl border bg-card p-12 flex flex-col items-center gap-5 text-center max-w-md mx-auto">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <Mail className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-1">Forbind din e-mail</h3>
            <p className="text-sm text-muted-foreground">Brug <strong>EmailEngine</strong> (self-hosted) eller Gmail OAuth.</p>
          </div>
          <div className="space-y-2 text-sm text-left w-full bg-muted/40 rounded-lg p-4">
            <div className="flex items-center gap-2"><Star className="h-4 w-4 text-yellow-500" /><span>Auto-prioritering af vigtige emails</span></div>
            <div className="flex items-center gap-2"><CheckSquare className="h-4 w-4 text-blue-500" /><span>Møder og deadlines → To-do liste</span></div>
            <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-green-500" /><span>Send emails direkte fra CRM</span></div>
          </div>
          <div className="flex flex-col gap-2 w-full">
            <Button onClick={() => navigate(`/${locale}/app/integrations`)} variant="outline">
              <Settings className="h-4 w-4 mr-2" />Konfigurér EmailEngine (anbefalet)
            </Button>
            <Button onClick={() => void handleConnectGmail()} disabled={connecting}>
              {connecting ? 'Forbinder...' : 'Forbind Gmail'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!useEmailEngine && gmailConnected === null) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />Forbinder...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Indbakke</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-sm text-muted-foreground">{accountLabel || (useEmailEngine ? 'EmailEngine' : 'Gmail')}</p>
            {useEmailEngine && <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full">EmailEngine</span>}
            {useAiClassify && <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded-full">AI klassificering</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!useEmailEngine && (
            <button
              className={`text-xs px-2 py-1 rounded-full border transition-colors ${todoSyncEnabled ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-muted text-muted-foreground border-border'}`}
              onClick={() => void handleToggleTodoSync()}
            >
              <CheckSquare className="h-3 w-3 inline mr-1" />
              To-do synk {todoSyncEnabled ? 'til' : 'fra'}
            </button>
          )}
          <Button size="sm" variant="outline" onClick={() => void (useEmailEngine ? fetchEE() : fetchGmail())} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />Opdater
          </Button>
        </div>
      </div>

      {/* To-do suggestions */}
      {todoSuggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Foreslåede To-dos</p>
          {todoSuggestions.map((msg) => (
            <TodoSuggestion
              key={msg.id}
              msg={msg}
              onAdd={(m) => void handleAddTodo(m)}
              onDismiss={(id) => setDismissedTodos((p) => new Set([...p, id]))}
            />
          ))}
        </div>
      )}

      {/* Priority panel */}
      {highPriority.length > 0 && (
        <div className="rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Star className="h-4 w-4 text-yellow-500" />
            <p className="text-sm font-semibold">Dagens prioriteter ({highPriority.length})</p>
          </div>
          <div className="space-y-2">
            {highPriority.slice(0, 3).map((msg) => (
              <div key={msg.id} className="flex items-start gap-3 text-sm">
                <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 shrink-0">{msg.priorityLabel}</span>
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

      {/* Full list */}
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
            {messages.map((msg) => {
              const isAdding = addingTodo === msg.id;
              return (
                <div key={msg.id} className={`flex items-start gap-3 px-4 py-3 hover:bg-muted/20 transition-colors group ${!msg.read ? 'bg-muted/10' : ''}`}>
                  <div className="shrink-0 mt-1">
                    <div className={`h-2 w-2 rounded-full ${msg.priority === 'high' ? 'bg-yellow-500' : 'bg-muted'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className={`text-sm truncate ${!msg.read ? 'font-semibold' : 'font-medium text-muted-foreground'}`}>{extractName(msg.from)}</span>
                      {msg.priority === 'high' && (
                        <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 shrink-0">{msg.priorityLabel}</span>
                      )}
                    </div>
                    <p className={`text-sm truncate ${!msg.read ? 'font-medium' : 'text-muted-foreground'}`}>{msg.subject}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{msg.snippet}</p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span className="text-xs text-muted-foreground">{formatDate(msg.date)}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {msg.isTodoCandidate && !dismissedTodos.has(msg.id) && todoSyncEnabled && (
                        <button className="text-xs text-blue-600 dark:text-blue-400 hover:underline" disabled={isAdding} onClick={() => void handleAddTodo(msg)}>
                          {isAdding ? '...' : '+ To-do'}
                        </button>
                      )}
                      {msg.source === 'gmail' && (
                        <a href={`https://mail.google.com/mail/u/0/#inbox/${msg.id}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
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
