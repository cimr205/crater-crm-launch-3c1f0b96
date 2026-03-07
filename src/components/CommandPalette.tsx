import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { isLocale } from '@/lib/i18n';
import { api } from '@/lib/api';
import {
  LayoutDashboard, Users, TrendingUp, FileText, CreditCard,
  Inbox, Mail, Settings, Zap, CheckSquare, User, Plus,
  ArrowRight, Search, Star
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  group: string;
  action: () => void;
  keywords?: string;
}

// ─── Global state ─────────────────────────────────────────────────────────────

let openCallback: (() => void) | null = null;
export function openCommandPalette() { openCallback?.(); }

// ─── CommandPalette component ─────────────────────────────────────────────────

export default function CommandPalette() {
  const navigate = useNavigate();
  const params = useParams();
  const locale = isLocale(params.locale) ? params.locale : 'en';

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [leads, setLeads] = useState<Array<{ id: string; name: string; company?: string; status: string }>>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);

  // Register open callback
  useEffect(() => {
    openCallback = () => { setOpen(true); setQuery(''); };
    return () => { openCallback = null; };
  }, []);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(v => !v);
        setQuery('');
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

  // Static commands
  const staticCommands: Command[] = [
    // Pages
    { id: 'dashboard', label: 'Dashboard', description: 'Overblik over virksomheden', icon: <LayoutDashboard className="h-4 w-4" />, group: 'Sider', action: () => go('/app/dashboard'), keywords: 'hjem home overview' },
    { id: 'leads', label: 'Leads', description: 'Se og administrer leads', icon: <Users className="h-4 w-4" />, group: 'Sider', action: () => go('/app/crm/leads'), keywords: 'kunder crm salg' },
    { id: 'deals', label: 'Deals / Pipeline', description: 'Kanban pipeline', icon: <TrendingUp className="h-4 w-4" />, group: 'Sider', action: () => go('/app/crm/deals'), keywords: 'pipeline salg stages' },
    { id: 'invoices', label: 'Fakturaer', description: 'Opret og administrer fakturaer', icon: <FileText className="h-4 w-4" />, group: 'Sider', action: () => go('/app/finance/invoices'), keywords: 'faktura invoice finans' },
    { id: 'payments', label: 'Betalinger', description: 'Registrer betalinger', icon: <CreditCard className="h-4 w-4" />, group: 'Sider', action: () => go('/app/finance/payments'), keywords: 'betaling payment finans' },
    { id: 'inbox', label: 'Indbakke', description: 'Gmail-indbakke med prioritering', icon: <Inbox className="h-4 w-4" />, group: 'Sider', action: () => go('/app/communication/inbox'), keywords: 'email gmail inbox beskeder' },
    { id: 'emails', label: 'Emails', description: 'Send emails via Gmail', icon: <Mail className="h-4 w-4" />, group: 'Sider', action: () => go('/app/communication/emails'), keywords: 'email gmail send' },
    { id: 'todos', label: 'To-dos', description: 'Opgaveliste', icon: <CheckSquare className="h-4 w-4" />, group: 'Sider', action: () => go('/app/productivity/todos'), keywords: 'todo opgave task' },
    { id: 'workflows', label: 'Workflows', description: 'Automatiseringer', icon: <Zap className="h-4 w-4" />, group: 'Sider', action: () => go('/app/workflows'), keywords: 'automation workflow ai' },
    { id: 'settings', label: 'Indstillinger', description: 'Virksomhedsindstillinger', icon: <Settings className="h-4 w-4" />, group: 'Sider', action: () => go('/app/settings/company'), keywords: 'settings indstillinger company' },
    // Quick create
    { id: 'new-lead', label: '+ Opret lead', description: 'Tilføj nyt lead til CRM', icon: <Plus className="h-4 w-4 text-green-500" />, group: 'Opret', action: () => go('/app/crm/leads'), keywords: 'ny lead tilføj' },
    { id: 'new-invoice', label: '+ Opret faktura', description: 'Ny faktura til en kunde', icon: <Plus className="h-4 w-4 text-blue-500" />, group: 'Opret', action: () => go('/app/finance/invoices'), keywords: 'ny faktura opret' },
    { id: 'new-email', label: '+ Skriv email', description: 'Ny email via Gmail', icon: <Plus className="h-4 w-4 text-purple-500" />, group: 'Opret', action: () => go('/app/communication/emails'), keywords: 'ny email skriv send' },
  ];

  const filtered = query.trim()
    ? staticCommands.filter(c => {
        const q = query.toLowerCase();
        return c.label.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q) || c.keywords?.toLowerCase().includes(q);
      })
    : staticCommands;

  // Group commands
  const groups = ['Opret', 'Sider'];
  const grouped = groups.map(g => ({ group: g, commands: filtered.filter(c => c.group === g) })).filter(g => g.commands.length > 0);

  const statusColor: Record<string, string> = {
    cold: 'bg-blue-500', contacted: 'bg-yellow-500', qualified: 'bg-green-500',
    customer: 'bg-purple-500', lost: 'bg-red-500',
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl p-0 overflow-hidden gap-0 [&>button]:hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Søg sider, leads, handlinger..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          <kbd className="text-xs text-muted-foreground border rounded px-1.5 py-0.5 font-mono">ESC</kbd>
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
                  {leads.map(lead => (
                    <button
                      key={lead.id}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition-colors text-left"
                      onClick={() => { setOpen(false); navigate(`/${locale}/app/crm/leads`); }}
                    >
                      <div className={`h-2 w-2 rounded-full shrink-0 ${statusColor[lead.status] || 'bg-muted-foreground'}`} />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{lead.name}</span>
                        {lead.company && <span className="text-xs text-muted-foreground ml-2">{lead.company}</span>}
                      </div>
                      <span className="text-xs text-muted-foreground capitalize">{lead.status}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  ))}
                </>
              ) : null}
            </div>
          )}

          {/* Static commands */}
          {grouped.map(({ group, commands }) => (
            <div key={group} className="mb-1">
              <div className="px-4 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{group}</div>
              {commands.map(cmd => (
                <button
                  key={cmd.id}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition-colors text-left"
                  onClick={() => { cmd.action(); setOpen(false); }}
                >
                  <span className="text-muted-foreground shrink-0">{cmd.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{cmd.label}</span>
                    {cmd.description && <span className="text-xs text-muted-foreground ml-2">{cmd.description}</span>}
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          ))}

          {filtered.length === 0 && leads.length === 0 && query.trim() && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Ingen resultater for "{query}"</div>
          )}

          {!query.trim() && (
            <div className="px-4 pt-1 pb-2 text-xs text-muted-foreground border-t mt-2 flex items-center gap-4">
              <span><kbd className="border rounded px-1 font-mono">↑↓</kbd> naviger</span>
              <span><kbd className="border rounded px-1 font-mono">↵</kbd> vælg</span>
              <span><kbd className="border rounded px-1 font-mono">esc</kbd> luk</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
