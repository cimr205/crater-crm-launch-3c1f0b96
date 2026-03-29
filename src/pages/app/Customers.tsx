import { useEffect, useState } from 'react';
import { api, type Customer } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Users, Search, X, Phone, Mail, Building2, MapPin,
  FileText, CreditCard, ChevronRight, TrendingUp, AlertCircle,
  Clock,
} from 'lucide-react';

function fmt(n: number) {
  return n.toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-pink-500', 'bg-indigo-500',
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

// ─── Customer Detail Panel ────────────────────────────────────────────────────

interface DetailPanelProps {
  customer: Customer;
  onClose: () => void;
}

function CustomerDetailPanel({ customer, onClose }: DetailPanelProps) {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Array<{
    id: string; invoice_number?: string; status: string; total?: number; due_amount?: number; invoice_date?: string; due_date?: string;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getInvoices().then(data => {
      // Filter invoices for this customer
      const filtered = (data as Array<{
        id: string; invoice_number?: string; status: string; total?: number;
        due_amount?: number; invoice_date?: string; due_date?: string;
        customer?: { id: number };
      }>).filter(inv => inv.customer?.id === customer.id || (inv as Record<string, unknown>).customer_id === customer.id);
      setInvoices(filtered);
    }).catch(() => {
      toast({ title: 'Kunne ikke hente fakturaer', variant: 'destructive' });
    }).finally(() => setLoading(false));
  }, [customer.id, toast]);

  const totalRevenue = invoices
    .filter(i => i.status === 'PAID' || i.status === 'paid')
    .reduce((s, i) => s + (i.total ?? 0), 0);

  const statusColors: Record<string, string> = {
    PAID: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    SENT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    OVERDUE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    DRAFT: 'bg-muted text-muted-foreground',
    draft: 'bg-muted text-muted-foreground',
  };

  const statusLabel: Record<string, string> = {
    PAID: 'Betalt', paid: 'Betalt', SENT: 'Sendt', sent: 'Sendt',
    OVERDUE: 'Forfalden', overdue: 'Forfalden', DRAFT: 'Kladde', draft: 'Kladde',
  };

  const address = customer.billing_address;
  const fullAddress = [
    address?.address_street_1,
    address?.city && address?.zip ? `${address.zip} ${address.city}` : address?.city || address?.zip,
    address?.country,
  ].filter(Boolean).join(', ');

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative z-10 h-full w-full max-w-md bg-background border-l border-border overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-background/95 backdrop-blur border-b px-6 py-4 flex items-center justify-between">
          <h2 className="font-semibold text-base">Kundeprofil</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Customer identity */}
          <div className="flex items-start gap-4">
            <div className={`h-14 w-14 rounded-2xl ${avatarColor(customer.name)} flex items-center justify-center text-white font-bold text-lg shrink-0`}>
              {initials(customer.name)}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold truncate">{customer.name}</h3>
              {customer.company_name && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  {customer.company_name}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Kunde siden {new Date(customer.created_at).toLocaleDateString('da-DK', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Contact info */}
          <div className="rounded-2xl border bg-card p-4 space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kontaktinfo</h4>
            {customer.email && (
              <a href={`mailto:${customer.email}`} className="flex items-center gap-3 text-sm hover:text-primary transition-colors">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                {customer.email}
              </a>
            )}
            {customer.phone && (
              <a href={`tel:${customer.phone}`} className="flex items-center gap-3 text-sm hover:text-primary transition-colors">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                {customer.phone}
              </a>
            )}
            {fullAddress && (
              <div className="flex items-start gap-3 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                {fullAddress}
              </div>
            )}
          </div>

          {/* Financial summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-xs text-muted-foreground font-medium">Total omsætning</span>
              </div>
              <p className="text-2xl font-bold tabular-nums">{fmt(totalRevenue)} <span className="text-sm font-normal text-muted-foreground">kr</span></p>
            </div>
            <div className={`rounded-2xl border p-4 ${customer.due_amount > 0 ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' : 'bg-card'}`}>
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className={`h-4 w-4 ${customer.due_amount > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
                <span className="text-xs text-muted-foreground font-medium">Udestående</span>
              </div>
              <p className={`text-2xl font-bold tabular-nums ${customer.due_amount > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                {fmt(customer.due_amount)} <span className="text-sm font-normal text-muted-foreground">kr</span>
              </p>
            </div>
          </div>

          {/* Invoices */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Fakturaer ({invoices.length})
              </h4>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => (
                  <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : invoices.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center">
                <CreditCard className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Ingen fakturaer endnu</p>
              </div>
            ) : (
              <div className="space-y-2">
                {invoices.map(inv => (
                  <div key={inv.id} className="rounded-xl border bg-card p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{inv.invoice_number || `#${inv.id}`}</p>
                      {inv.due_date && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          Forfald {new Date(inv.due_date).toLocaleDateString('da-DK')}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold tabular-nums">{fmt(inv.total ?? 0)} kr</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[inv.status] || 'bg-muted text-muted-foreground'}`}>
                        {statusLabel[inv.status] || inv.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Customers Page ──────────────────────────────────────────────────────

export default function CustomersPage() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Customer | null>(null);

  useEffect(() => {
    api.getCustomers({ limit: 100 })
      .then(res => setCustomers(res.data))
      .catch(() => toast({ title: 'Kunne ikke hente kunder', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [toast]);

  const filtered = query.trim()
    ? customers.filter(c =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.email?.toLowerCase().includes(query.toLowerCase()) ||
        c.company_name?.toLowerCase().includes(query.toLowerCase())
      )
    : customers;

  const totalDue = customers.reduce((s, c) => s + c.due_amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Kunder</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? 'Henter...' : `${customers.length} kunder · ${fmt(totalDue)} kr udestående i alt`}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      {!loading && customers.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border bg-card p-5">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500 mb-3">
              <Users className="h-5 w-5 text-white" />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Kunder i alt</p>
            <p className="text-3xl font-bold mt-0.5">{customers.length}</p>
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-green-500 mb-3">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Med aktivt udestående</p>
            <p className="text-3xl font-bold mt-0.5">{customers.filter(c => c.due_amount > 0).length}</p>
          </div>
          <div className="rounded-2xl border bg-card p-5 col-span-2 sm:col-span-1">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-500 mb-3">
              <AlertCircle className="h-5 w-5 text-white" />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Totalt udestående</p>
            <p className="text-3xl font-bold mt-0.5 tabular-nums">{fmt(totalDue)} <span className="text-lg font-normal text-muted-foreground">kr</span></p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Søg efter navn, email, virksomhed..."
          className="pl-9"
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Customer list */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 flex flex-col items-center gap-3 text-center">
          <Users className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {query ? `Ingen kunder matcher "${query}"` : 'Ingen kunder endnu'}
          </p>
          {query && (
            <Button variant="outline" size="sm" onClick={() => setQuery('')}>Ryd søgning</Button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="divide-y">
            {filtered.map(customer => (
              <button
                key={customer.id}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/40 transition-colors text-left"
                onClick={() => setSelected(customer)}
              >
                {/* Avatar */}
                <div className={`h-10 w-10 rounded-xl ${avatarColor(customer.name)} flex items-center justify-center text-white font-semibold text-sm shrink-0`}>
                  {initials(customer.name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{customer.name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {customer.company_name && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {customer.company_name}
                      </span>
                    )}
                    {customer.email && (
                      <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {customer.email}
                      </span>
                    )}
                  </div>
                </div>

                {/* Due amount */}
                {customer.due_amount > 0 && (
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400 tabular-nums">{fmt(customer.due_amount)} kr</p>
                    <p className="text-xs text-muted-foreground">udestående</p>
                  </div>
                )}

                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 360° detail panel */}
      {selected && (
        <CustomerDetailPanel
          customer={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
