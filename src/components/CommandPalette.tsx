import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { isLocale } from '@/lib/i18n';
import { api } from '@/lib/api';
import {
  LayoutDashboard, Users, TrendingUp, FileText, CreditCard,
  Inbox, Mail, Settings, Zap, CheckSquare, Plus,
  ArrowRight, Search, ListTodo, BarChart2, Bot,
  UserSquare2, Banknote, CalendarDays, Send, Sparkles,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  group: string;
  action: () => void | Promise<void>;
  keywords?: string;
  isCreate?: boolean;
}

// ─── Global open callback ─────────────────────────────────────────────────────

let openCallback: (() => void) | null = null;
export function openCommandPalette() { openCallback?.(); }

// ─── Inline create forms ──────────────────────────────────────────────────────

function CreateLeadForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const submit = async () => {
    if (!name.trim() || !phone.trim()) return;
    setSaving(true);
    try {
      await api.createLead({ name: name.trim(), phone: phone.trim(), company: company.trim() || undefined });
      toast({ title: 'Lead oprettet', description: name });
      onDone();
    } catch (e) {
      toast({ title: 'Fejl', description: e instanceof Error ? e.message : 'Kunne ikke oprette lead', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 py-3 border-t space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Opret lead</p>
      <input
        ref={nameRef}
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Navn *"
        className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
        onKeyDown={e => e.key === 'Escape' && onCancel()}
      />
      <input
        value={phone}
        onChange={e => setPhone(e.target.value)}
        placeholder="Telefon *"
        className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
        onKeyDown={e => e.key === 'Escape' && onCancel()}
      />
      <input
        value={company}
        onChange={e => setCompany(e.target.value)}
        placeholder="Virksomhed (valgfrit)"
        className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
      />
      <div className="flex gap-2 pt-1">
        <button
          onClick={submit}
          disabled={saving || !name.trim() || !phone.trim()}
          className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {saving ? 'Opretter...' : 'Opret lead'}
        </button>
        <button onClick={onCancel} className="px-4 bg-muted rounded-lg py-2 text-sm hover:bg-muted/80 transition-colors">
          Annuller
        </button>
      </div>
    </div>
  );
}

function CreateTodoForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await api.createTodo({ title: title.trim() });
      toast({ title: 'To-do tilføjet', description: title });
      onDone();
    } catch (e) {
      toast({ title: 'Fejl', description: e instanceof Error ? e.message : 'Kunne ikke oprette to-do', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 py-3 border-t space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tilføj to-do</p>
      <input
        ref={inputRef}
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Hvad skal gøres?"
        className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
      />
      <div className="flex gap-2 pt-1">
        <button
          onClick={submit}
          disabled={saving || !title.trim()}
          className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {saving ? 'Gemmer...' : 'Tilføj to-do'}
        </button>
        <button onClick={onCancel} className="px-4 bg-muted rounded-lg py-2 text-sm hover:bg-muted/80 transition-colors">
          Annuller
        </button>
      </div>
    </div>
  );
}

// ─── CommandPalette ───────────────────────────────────────────────────────────

export default function CommandPalette() {
  const navigate = useNavigate();
  const params = useParams();
  const locale = isLocale(params.locale) ? params.locale : 'en';

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [leads, setLeads] = useState<Array<{ id: string; name: string; company?: string; status: string }>>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [inlineForm, setInlineForm] = useState<'lead' | 'todo' | null>(null);

  // Register open callback
  useEffect(() => {
    openCallback = () => { setOpen(true); setQuery(''); setInlineForm(null); setActiveIndex(0); };
    return () => { openCallback = null; };
  }, []);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(v => !v);
        setQuery('');
        setInlineForm(null);
        setActiveIndex(0);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Load leads when query changes
  useEffect(() => {
    if (!open || !query.trim()) { setLeads([]); return; }
    const timeout = setTimeout(async () => {
      setLeadsLoading(true);
      try {
        const data = await api.listLeads({ q: query });
        setLeads((data.data || []).slice(0, 5));
      } catch { setLeads([]); }
      finally { setLeadsLoading(false); }
    }, 200);
    return () => clearTimeout(timeout);
  }, [query, open]);

  const go = useCallback((path: string) => {
    setOpen(false);
    navigate(`/${locale}${path}`);
  }, [locale, navigate]);

  const closeForm = () => setInlineForm(null);

  // Static commands
  const staticCommands: Command[] = [
    // Quick create
    { id: 'new-lead', label: '+ Opret lead', description: 'Tilføj nyt lead direkte her', icon: <Plus className="h-4 w-4 text-green-500" />, group: 'Opret', action: () => setInlineForm('lead'), keywords: 'ny lead tilføj opret', isCreate: true },
    { id: 'new-todo', label: '+ Tilføj to-do', description: 'Opret en to-do direkte her', icon: <Plus className="h-4 w-4 text-purple-500" />, group: 'Opret', action: () => setInlineForm('todo'), keywords: 'ny todo opgave tilføj', isCreate: true },
    { id: 'new-invoice', label: '+ Opret faktura', description: 'Ny faktura til en kunde', icon: <Plus className="h-4 w-4 text-blue-500" />, group: 'Opret', action: () => go('/app/finance/invoices'), keywords: 'ny faktura opret' },
    { id: 'new-email', label: '+ Skriv email', description: 'Ny email via Gmail', icon: <Plus className="h-4 w-4 text-orange-500" />, group: 'Opret', action: () => go('/app/communication/emails'), keywords: 'ny email skriv send' },
    // Pages
    { id: 'dashboard', label: 'Dashboard', description: 'Overblik over virksomheden', icon: <LayoutDashboard className="h-4 w-4" />, group: 'Sider', action: () => go('/app/dashboard'), keywords: 'hjem home overview' },
    { id: 'leads', label: 'Leads', description: 'Se og administrer leads', icon: <Users className="h-4 w-4" />, group: 'Sider', action: () => go('/app/crm/leads'), keywords: 'kunder crm salg' },
    { id: 'deals', label: 'Deals / Pipeline', description: 'Kanban pipeline', icon: <TrendingUp className="h-4 w-4" />, group: 'Sider', action: () => go('/app/crm/deals'), keywords: 'pipeline salg stages' },
    { id: 'customers', label: 'Kunder', description: 'Kundeliste og 360° profil', icon: <UserSquare2 className="h-4 w-4" />, group: 'Sider', action: () => go('/app/customers'), keywords: 'kunder customer profil' },
    { id: 'invoices', label: 'Fakturaer', description: 'Opret og administrer fakturaer', icon: <FileText className="h-4 w-4" />, group: 'Sider', action: () => go('/app/finance/invoices'), keywords: 'faktura invoice finans' },
    { id: 'payments', label: 'Betalinger', description: 'Registrer betalinger', icon: <CreditCard className="h-4 w-4" />, group: 'Sider', action: () => go('/app/finance/payments'), keywords: 'betaling payment finans' },
    { id: 'salary', label: 'Løn', description: 'Lønudbetaling og oversigt', icon: <Banknote className="h-4 w-4" />, group: 'Sider', action: () => go('/app/hr/salary'), keywords: 'løn salary hr' },
    { id: 'inbox', label: 'Indbakke', description: 'Smart indbakke med prioritering', icon: <Inbox className="h-4 w-4" />, group: 'Sider', action: () => go('/app/inbox'), keywords: 'email gmail inbox beskeder' },
    { id: 'emails', label: 'Emails', description: 'Send emails via Gmail', icon: <Mail className="h-4 w-4" />, group: 'Sider', action: () => go('/app/emails'), keywords: 'email gmail send' },
    { id: 'todos', label: 'To-dos', description: 'Opgaveliste', icon: <ListTodo className="h-4 w-4" />, group: 'Sider', action: () => go('/app/todos'), keywords: 'todo opgave task' },
    { id: 'calendar', label: 'Kalender', description: 'Se og planlæg events', icon: <CalendarDays className="h-4 w-4" />, group: 'Sider', action: () => go('/app/calendar'), keywords: 'kalender møde dato' },
    { id: 'bulk-email', label: 'Bulk Email', description: 'Send mass-emails', icon: <Send className="h-4 w-4" />, group: 'Sider', action: () => go('/app/email/bulk'), keywords: 'bulk email campaign masse' },
    { id: 'meta', label: 'Meta Ads', description: 'Facebook & Instagram kampagner', icon: <BarChart2 className="h-4 w-4" />, group: 'Sider', action: () => go('/app/meta/ads'), keywords: 'meta facebook instagram ads' },
    { id: 'workflows', label: 'Workflows', description: 'Automatiseringer', icon: <Zap className="h-4 w-4" />, group: 'Sider', action: () => go('/app/workflows'), keywords: 'automation workflow ai' },
    { id: 'clowdbot', label: 'ClowdBot', description: 'AI-agent til lead-generering', icon: <Bot className="h-4 w-4" />, group: 'Sider', action: () => go('/app/clowdbot'), keywords: 'ai bot robot leads' },
    { id: 'ai-media', label: 'AI Medie', description: 'Generer billeder og indhold med AI', icon: <Sparkles className="h-4 w-4" />, group: 'Sider', action: () => go('/app/ai/media'), keywords: 'ai billeder content medie' },
    { id: 'tasks', label: 'Opgaver', description: 'AI-genererede opgaver', icon: <CheckSquare className="h-4 w-4" />, group: 'Sider', action: () => go('/app/tasks'), keywords: 'tasks opgaver ai' },
    { id: 'settings', label: 'Indstillinger', description: 'Virksomhedsindstillinger', icon: <Settings className="h-4 w-4" />, group: 'Sider', action: () => go('/app/settings/company'), keywords: 'settings indstillinger company' },
  ];

  const filtered = query.trim()
    ? staticCommands.filter(c => {
        const q = query.toLowerCase();
        return c.label.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q) || c.keywords?.toLowerCase().includes(q);
      })
    : staticCommands;

  const groups = ['Opret', 'Sider'];
  const grouped = groups.map(g => ({ group: g, commands: filtered.filter(c => c.group === g) })).filter(g => g.commands.length > 0);

  // Flattened list for keyboard navigation
  const allCommands = useMemo<Command[]>(() => [
    ...leads.map(lead => ({
      id: `lead-${lead.id}`,
      label: lead.name,
      description: lead.company,
      icon: null,
      group: 'Leads',
      action: () => { setOpen(false); navigate(`/${locale}/app/crm/leads`); },
    })),
    ...grouped.flatMap(g => g.commands),
  ], [leads, grouped, locale, navigate]);

  // Keyboard navigation
  useEffect(() => {
    if (!open || inlineForm) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(i => Math.min(i + 1, allCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = allCommands[activeIndex];
        if (cmd) { void cmd.action(); if (!cmd.isCreate) setOpen(false); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, activeIndex, allCommands, inlineForm]);

  // Reset active index on query change
  useEffect(() => { setActiveIndex(0); }, [query]);

  const statusColor: Record<string, string> = {
    cold: 'bg-blue-500', contacted: 'bg-yellow-500', qualified: 'bg-green-500',
    customer: 'bg-purple-500', lost: 'bg-red-500',
  };

  let globalIdx = 0;

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setInlineForm(null); }}>
      <DialogContent className="max-w-xl p-0 overflow-hidden gap-0 [&>button]:hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={e => { setQuery(e.target.value); setInlineForm(null); }}
            placeholder="Søg sider, leads, handlinger..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          <div className="flex items-center gap-1.5">
            <kbd className="text-xs text-muted-foreground border rounded px-1.5 py-0.5 font-mono">⌘K</kbd>
            <kbd className="text-xs text-muted-foreground border rounded px-1.5 py-0.5 font-mono">ESC</kbd>
          </div>
        </div>

        <div className="max-h-[420px] overflow-y-auto py-2">
          {/* Lead search results */}
          {query.trim() && (
            <div className="mb-2">
              {leadsLoading ? (
                <div className="px-4 py-2 text-xs text-muted-foreground">Søger leads...</div>
              ) : leads.length > 0 ? (
                <>
                  <div className="px-4 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Leads</div>
                  {leads.map(lead => {
                    const idx = globalIdx++;
                    return (
                      <button
                        key={lead.id}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${activeIndex === idx ? 'bg-muted' : 'hover:bg-muted/60'}`}
                        onClick={() => { setOpen(false); navigate(`/${locale}/app/crm/leads`); }}
                        onMouseEnter={() => setActiveIndex(idx)}
                      >
                        <div className={`h-2 w-2 rounded-full shrink-0 ${statusColor[lead.status] || 'bg-muted-foreground'}`} />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium">{lead.name}</span>
                          {lead.company && <span className="text-xs text-muted-foreground ml-2">{lead.company}</span>}
                        </div>
                        <span className="text-xs text-muted-foreground capitalize">{lead.status}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    );
                  })}
                </>
              ) : null}
            </div>
          )}

          {/* Static command groups */}
          {grouped.map(({ group, commands }) => (
            <div key={group} className="mb-1">
              <div className="px-4 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{group}</div>
              {commands.map(cmd => {
                const idx = globalIdx++;
                const isActive = activeIndex === idx;
                return (
                  <button
                    key={cmd.id}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${isActive ? 'bg-muted' : 'hover:bg-muted/60'}`}
                    onClick={() => { void cmd.action(); if (!cmd.isCreate) setOpen(false); }}
                    onMouseEnter={() => setActiveIndex(idx)}
                  >
                    <span className="text-muted-foreground shrink-0">{cmd.icon}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{cmd.label}</span>
                      {cmd.description && <span className="text-xs text-muted-foreground ml-2">{cmd.description}</span>}
                    </div>
                    {cmd.isCreate ? (
                      <span className="text-xs text-muted-foreground border rounded px-1.5 py-0.5">inline</span>
                    ) : (
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {filtered.length === 0 && leads.length === 0 && query.trim() && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Ingen resultater for "{query}"</div>
          )}

          {!query.trim() && !inlineForm && (
            <div className="px-4 pt-1 pb-2 text-xs text-muted-foreground border-t mt-2 flex items-center gap-4">
              <span><kbd className="border rounded px-1 font-mono">↑↓</kbd> naviger</span>
              <span><kbd className="border rounded px-1 font-mono">↵</kbd> vælg</span>
              <span><kbd className="border rounded px-1 font-mono">esc</kbd> luk</span>
            </div>
          )}
        </div>

        {/* Inline forms */}
        {inlineForm === 'lead' && (
          <CreateLeadForm onDone={() => { setInlineForm(null); setOpen(false); }} onCancel={closeForm} />
        )}
        {inlineForm === 'todo' && (
          <CreateTodoForm onDone={() => { setInlineForm(null); setOpen(false); }} onCancel={closeForm} />
        )}
      </DialogContent>
    </Dialog>
  );
}
