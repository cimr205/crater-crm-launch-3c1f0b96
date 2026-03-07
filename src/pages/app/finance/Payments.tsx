import { useState, useEffect } from 'react';
import { api, type PaymentRecord, type InvoiceSummary } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, CreditCard, TrendingUp, CheckCircle } from 'lucide-react';

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bankoverførsel' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'quickpay', label: 'QuickPay' },
  { value: 'mobilepay', label: 'MobilePay' },
  { value: 'manual', label: 'Manuel' },
];

function fmt(n: number) { return n.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function MethodBadge({ method }: { method: string }) {
  const labels: Record<string, string> = { bank_transfer: 'Bankoverførsel', stripe: 'Stripe', quickpay: 'QuickPay', mobilepay: 'MobilePay', manual: 'Manuel' };
  return <span className="px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">{labels[method] || method}</span>;
}

function RegisterPaymentDialog({ open, onClose, invoices, onCreated }: {
  open: boolean; onClose: () => void; invoices: InvoiceSummary[]; onCreated: () => void;
}) {
  const { toast } = useToast();
  const today = new Date().toISOString().split('T')[0];
  const [loading, setLoading] = useState(false);
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('DKK');
  const [paymentDate, setPaymentDate] = useState(today);
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [notes, setNotes] = useState('');

  // Auto-fill amount when invoice selected
  useEffect(() => {
    const inv = invoices.find(i => i.id === invoiceId);
    if (inv) { setAmount(String(inv.total)); setCurrency(inv.currency); }
  }, [invoiceId, invoices]);

  const handleSubmit = async () => {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) { toast({ title: 'Angiv et gyldigt beløb', variant: 'destructive' }); return; }
    setLoading(true);
    try {
      await api.createPayment({
        invoice_id: invoiceId || undefined,
        amount: amountNum, currency, payment_date: paymentDate,
        payment_method: paymentMethod, notes: notes || undefined,
      });
      toast({ title: 'Betaling registreret' });
      onCreated();
      onClose();
    } catch (err) {
      toast({ title: (err as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const unpaidInvoices = invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled');

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Registrer betaling</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs text-muted-foreground">Tilknyt faktura (valgfri)</label>
            <Select value={invoiceId} onValueChange={setInvoiceId}>
              <SelectTrigger><SelectValue placeholder="Vælg faktura..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Ingen faktura</SelectItem>
                {unpaidInvoices.map(inv => (
                  <SelectItem key={inv.id} value={inv.id}>
                    {inv.invoice_number} — {inv.customer_name} ({fmt(inv.total)} {inv.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-muted-foreground">Beløb</label><Input type="number" min="0.01" step="0.01" placeholder="0,00" value={amount} onChange={e => setAmount(e.target.value)} /></div>
            <div>
              <label className="text-xs text-muted-foreground">Valuta</label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['DKK','EUR','USD','GBP'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><label className="text-xs text-muted-foreground">Betalingsdato</label><Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} /></div>
          <div>
            <label className="text-xs text-muted-foreground">Betalingsmetode</label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Input placeholder="Note (valgfri)" value={notes} onChange={e => setNotes(e.target.value)} />
          <div className="flex gap-3 justify-end pt-1">
            <Button variant="outline" onClick={onClose} disabled={loading}>Annuller</Button>
            <Button onClick={handleSubmit} disabled={loading}>{loading ? 'Gemmer...' : 'Registrer betaling'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PaymentsPage() {
  const { toast } = useToast();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [stats, setStats] = useState<{ count: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [pList, statsData, invList] = await Promise.all([api.getPayments(), api.getPaymentStats(), api.getInvoices()]);
      setPayments(pList);
      setStats(statsData);
      setInvoices(invList);
    } catch (err) {
      toast({ title: (err as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Betalinger</h1>
          <p className="text-sm text-muted-foreground">Registrer og se betalinger</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" />Registrer betaling</Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-1"><CheckCircle className="h-4 w-4 text-green-500" /><span className="text-xs text-muted-foreground">Antal betalinger</span></div>
            <p className="text-2xl font-bold">{stats.count}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-blue-500" /><span className="text-xs text-muted-foreground">Samlet modtaget</span></div>
            <p className="text-2xl font-bold">{fmt(stats.total)}</p>
            <p className="text-xs text-muted-foreground">DKK</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-1"><CreditCard className="h-4 w-4 text-purple-500" /><span className="text-xs text-muted-foreground">Åbne fakturaer</span></div>
            <p className="text-2xl font-bold">{invoices.filter(i => i.status === 'sent' || i.status === 'overdue').length}</p>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground">Indlæser...</div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
            <CreditCard className="h-10 w-10 opacity-40" />
            <p>Ingen betalinger endnu</p>
            <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-3 w-3 mr-1" />Registrer betaling</Button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Dato</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Faktura</th>
                <th className="text-right px-4 py-3 font-medium">Beløb</th>
                <th className="text-left px-4 py-3 font-medium">Metode</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Note</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id} className="border-b hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">{p.payment_date}</td>
                  <td className="px-4 py-3 font-mono text-xs hidden md:table-cell">{p.invoice_number || '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-green-600 dark:text-green-400">+{fmt(p.amount)} {p.currency}</td>
                  <td className="px-4 py-3"><MethodBadge method={p.payment_method} /></td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">{p.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {createOpen && <RegisterPaymentDialog open={createOpen} onClose={() => setCreateOpen(false)} invoices={invoices} onCreated={load} />}
    </div>
  );
}
