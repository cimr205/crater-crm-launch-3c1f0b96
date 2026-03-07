import { useState, useEffect, useRef } from 'react';
import { api, type InvoiceSummary, type InvoiceDetail, type InvoiceStats, type CreateInvoiceItem } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Download, Eye, Trash2, FileText, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';

// ─── Country / VAT helpers ──────────────────────────────────────────────────

const EU_COUNTRIES = ['AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU','IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK'];

function getVatInfo(country: string, customerType: string): { rate: number; note?: string } {
  if (country === 'DK') return { rate: 25 };
  if (EU_COUNTRIES.includes(country)) {
    if (customerType === 'company') return { rate: 0, note: 'Reverse charge – VAT handled by the customer' };
    return { rate: 25, note: 'EU privatkunde (OSS-regler)' };
  }
  return { rate: 0, note: 'Outside scope of EU VAT – VAT exempt export' };
}

const CURRENCIES = ['DKK', 'EUR', 'USD', 'GBP', 'SEK', 'NOK'];
const COUNTRIES = [
  { code: 'DK', label: 'Danmark' }, { code: 'DE', label: 'Germany' },
  { code: 'SE', label: 'Sweden' }, { code: 'NO', label: 'Norway' },
  { code: 'NL', label: 'Netherlands' }, { code: 'FR', label: 'France' },
  { code: 'GB', label: 'United Kingdom' }, { code: 'US', label: 'United States' },
  { code: 'AT', label: 'Austria' }, { code: 'BE', label: 'Belgium' },
  { code: 'ES', label: 'Spain' }, { code: 'IT', label: 'Italy' },
  { code: 'PL', label: 'Poland' }, { code: 'FI', label: 'Finland' },
  { code: 'CH', label: 'Switzerland' }, { code: 'CA', label: 'Canada' },
  { code: 'AU', label: 'Australia' }, { code: 'JP', label: 'Japan' },
];
const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bankoverførsel' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'quickpay', label: 'QuickPay' },
  { value: 'mobilepay', label: 'MobilePay' },
  { value: 'manual', label: 'Manuel' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    overdue: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    cancelled: 'bg-muted text-muted-foreground',
  };
  const labels: Record<string, string> = { draft: 'Kladde', sent: 'Sendt', paid: 'Betalt', overdue: 'Forfalden', cancelled: 'Annulleret' };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls[status] || cls.draft}`}>{labels[status] || status}</span>;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface CompanyInfo { name: string; cvr?: string | null; address?: string | null; phone?: string | null; email?: string | null; }
interface LineItem extends CreateInvoiceItem { id: string; }

// ─── Invoice print view ───────────────────────────────────────────────────────

function InvoicePrintView({ inv, company }: { inv: InvoiceDetail; company: CompanyInfo }) {
  const subtotal = inv.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const vatAmount = subtotal * (inv.vat_rate / 100);
  const total = subtotal + vatAmount;

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#000', background: '#fff', padding: '40px', maxWidth: '760px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{inv.customer_name}</div>
          {inv.customer_address && <div style={{ whiteSpace: 'pre-line', marginTop: '4px' }}>{inv.customer_address}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '10px' }}>{company.name}</div>
          <table style={{ fontSize: '11px', borderCollapse: 'collapse', marginLeft: 'auto' }}>
            <tbody>
              <tr><td style={{ paddingRight: '10px', color: '#666' }}>Side:</td><td>1 af 1</td></tr>
              <tr><td style={{ paddingRight: '10px', color: '#666' }}>Kundenummer:</td><td>{inv.id.slice(0, 8).toUpperCase()}</td></tr>
              {inv.customer_cvr && <tr><td style={{ paddingRight: '10px', color: '#666' }}>Kunde CVR-nr.:</td><td>{inv.customer_cvr}</td></tr>}
              {inv.customer_vat && <tr><td style={{ paddingRight: '10px', color: '#666' }}>Kunde VAT-nr.:</td><td>{inv.customer_vat}</td></tr>}
              <tr><td style={{ paddingRight: '10px', color: '#666' }}>Fakturadato:</td><td>{inv.invoice_date}</td></tr>
              <tr><td style={{ paddingRight: '10px', color: '#666' }}>Forfaldsdato:</td><td>{inv.due_date}</td></tr>
              <tr><td style={{ paddingRight: '10px', color: '#666' }}>Fakturanr:</td><td style={{ fontWeight: 'bold' }}>{inv.invoice_number}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <hr style={{ borderTop: '2px solid #000', margin: '0 0 12px' }} />
      <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>FAKTURA</div>
      {inv.notes && <div style={{ marginBottom: '12px', color: '#555', fontStyle: 'italic' }}>{inv.notes}</div>}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '12px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #ccc' }}>
            <th style={{ textAlign: 'left', paddingBottom: '5px', width: '50%' }}>Beskrivelse</th>
            <th style={{ textAlign: 'right', paddingBottom: '5px', width: '15%' }}>Antal</th>
            <th style={{ textAlign: 'right', paddingBottom: '5px', width: '17%' }}>Stk. pris</th>
            <th style={{ textAlign: 'right', paddingBottom: '5px', width: '18%' }}>Sum</th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((item, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '4px 0' }}>{item.description}</td>
              <td style={{ textAlign: 'right', padding: '4px 0' }}>{item.quantity}</td>
              <td style={{ textAlign: 'right', padding: '4px 0' }}>{fmt(item.unit_price)}</td>
              <td style={{ textAlign: 'right', padding: '4px 0' }}>{fmt(item.quantity * item.unit_price)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table style={{ width: '100%', marginTop: '12px', borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ width: '55%' }} />
            <td style={{ textAlign: 'right', padding: '3px 0', borderTop: '1px solid #ccc' }}>Subtotal</td>
            <td style={{ textAlign: 'right', padding: '3px 0', borderTop: '1px solid #ccc', paddingLeft: '20px', minWidth: '110px' }}>{fmt(subtotal)} {inv.currency}</td>
          </tr>
          <tr>
            <td />
            <td style={{ textAlign: 'right', padding: '3px 0' }}>
              {inv.vat_rate > 0 ? `Moms (${inv.vat_rate}%)` : 'Moms'}
              {inv.vat_note && <div style={{ fontSize: '10px', color: '#666' }}>{inv.vat_note}</div>}
            </td>
            <td style={{ textAlign: 'right', padding: '3px 0', paddingLeft: '20px' }}>{fmt(vatAmount)} {inv.currency}</td>
          </tr>
          <tr style={{ fontWeight: 'bold', borderTop: '2px solid #000' }}>
            <td style={{ fontWeight: 'normal', fontSize: '10px', color: '#555', verticalAlign: 'top', paddingTop: '4px' }}>
              {inv.bank_account && `Beløb bedes indbetalt til: ${inv.bank_account}`}
            </td>
            <td style={{ textAlign: 'right', padding: '4px 0 4px 0' }}>Total</td>
            <td style={{ textAlign: 'right', padding: '4px 0 4px 20px' }}>{fmt(total)} {inv.currency}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginTop: '20px', fontSize: '11px' }}>
        <div style={{ fontWeight: 'bold' }}>Fakturaen betales senest: {inv.due_date}</div>
        <div style={{ marginTop: '4px', color: '#555' }}>Ved for sen betaling pålægges rente i henhold til gældende lovgivning.</div>
        <div style={{ marginTop: '6px' }}>Betalingen påføres fakturanummer: {inv.invoice_number}</div>
      </div>

      <div style={{ marginTop: '40px', paddingTop: '10px', borderTop: '1px solid #ccc', textAlign: 'center', fontSize: '10px', color: '#555' }}>
        {[company.name, company.address, company.phone && `Tlf: ${company.phone}`, company.email && `Mail: ${company.email}`, company.cvr && `CVR-nr: ${company.cvr}`].filter(Boolean).join(' • ')}
      </div>
    </div>
  );
}

// ─── Print dialog ─────────────────────────────────────────────────────────────

function PrintDialog({ inv, company, onClose }: { inv: InvoiceDetail; company: CompanyInfo; onClose: () => void }) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Faktura ${inv.invoice_number}</title>
      <style>body{margin:0;font-family:Arial,sans-serif;font-size:12px;}@media print{body{-webkit-print-color-adjust:exact;}}</style>
      </head><body>${el.innerHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Faktura {inv.invoice_number}</DialogTitle></DialogHeader>
        <div className="flex gap-2 mb-4">
          <Button onClick={handlePrint}><Download className="h-4 w-4 mr-2" />Download / Print PDF</Button>
        </div>
        <div ref={printRef} className="border rounded-lg overflow-hidden bg-white">
          <InvoicePrintView inv={inv} company={company} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create invoice dialog ────────────────────────────────────────────────────

function CreateInvoiceDialog({ open, onClose, company, onCreated }: { open: boolean; onClose: () => void; company: CompanyInfo; onCreated: () => void }) {
  const { toast } = useToast();
  const today = new Date().toISOString().split('T')[0];
  const dueDefault = new Date(Date.now() + 14 * 86400_000).toISOString().split('T')[0];

  const [loading, setLoading] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [dueDate, setDueDate] = useState(dueDefault);
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerCountry, setCustomerCountry] = useState('DK');
  const [customerType, setCustomerType] = useState<'company' | 'private'>('company');
  const [customerCvr, setCustomerCvr] = useState('');
  const [customerVat, setCustomerVat] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [currency, setCurrency] = useState('DKK');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [paymentTermsDays, setPaymentTermsDays] = useState(14);
  const [bankAccount, setBankAccount] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LineItem[]>([{ id: '1', description: '', quantity: 1, unit_price: 0 }]);

  const vatInfo = getVatInfo(customerCountry, customerType);
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const vatAmount = subtotal * (vatInfo.rate / 100);
  const total = subtotal + vatAmount;
  const isDK = customerCountry === 'DK';
  const isEU = EU_COUNTRIES.includes(customerCountry) && !isDK;

  const addItem = () => setItems(p => [...p, { id: String(Date.now()), description: '', quantity: 1, unit_price: 0 }]);
  const removeItem = (id: string) => { if (items.length > 1) setItems(p => p.filter(i => i.id !== id)); };
  const updateItem = (id: string, field: keyof LineItem, value: string | number) =>
    setItems(p => p.map(i => i.id === id ? { ...i, [field]: field === 'description' ? value : (parseFloat(String(value)) || 0) } : i));

  const handleSubmit = async () => {
    if (!customerName.trim()) { toast({ title: 'Kundenavn mangler', variant: 'destructive' }); return; }
    if (items.some(i => !i.description.trim())) { toast({ title: 'Alle linjer skal have en beskrivelse', variant: 'destructive' }); return; }
    setLoading(true);
    try {
      await api.createInvoice({
        invoice_date: invoiceDate, due_date: dueDate,
        customer_name: customerName, customer_address: customerAddress || undefined,
        customer_country: customerCountry, customer_type: customerType,
        customer_cvr: customerCvr || undefined, customer_vat: customerVat || undefined,
        customer_email: customerEmail || undefined,
        currency, vat_rate: vatInfo.rate, vat_note: vatInfo.note,
        payment_method: paymentMethod, payment_terms_days: paymentTermsDays,
        bank_account: bankAccount || undefined, notes: notes || undefined,
        items: items.map(({ description, quantity, unit_price }) => ({ description, quantity, unit_price })),
      });
      toast({ title: 'Faktura oprettet' });
      onCreated();
      onClose();
    } catch (err) {
      toast({ title: (err as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Opret faktura</DialogTitle></DialogHeader>
        <div className="space-y-5 py-1">

          {/* Seller (read-only) */}
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-xs uppercase tracking-wide font-semibold text-muted-foreground mb-1">Din virksomhed</p>
            <p className="font-semibold">{company.name}</p>
            {company.address && <p className="text-sm text-muted-foreground">{company.address}</p>}
            {company.cvr && <p className="text-sm text-muted-foreground">CVR: {company.cvr}</p>}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-muted-foreground">Fakturadato</label><Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} /></div>
            <div><label className="text-xs text-muted-foreground">Forfaldsdato</label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
          </div>

          {/* Customer */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">Kunde</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Land</label>
                <Select value={customerCountry} onValueChange={setCustomerCountry}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Kundetype</label>
                <Select value={customerType} onValueChange={v => setCustomerType(v as 'company' | 'private')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company">Virksomhed</SelectItem>
                    <SelectItem value="private">Privat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Input placeholder="Kundenavn *" value={customerName} onChange={e => setCustomerName(e.target.value)} />
            <Input placeholder="Adresse" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              {isDK && <Input placeholder="CVR-nummer" value={customerCvr} onChange={e => setCustomerCvr(e.target.value)} />}
              {isEU && customerType === 'company' && <Input placeholder="VAT-nummer (krævet for EU)" value={customerVat} onChange={e => setCustomerVat(e.target.value)} />}
              <Input type="email" placeholder="Kundens email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} />
            </div>
          </div>

          {/* VAT info */}
          <div className={`rounded-lg p-3 text-sm ${vatInfo.rate === 0 ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800' : 'bg-muted/40'}`}>
            <span className="font-medium">Moms: {vatInfo.rate}%</span>
            {vatInfo.note && <span className="ml-2 text-muted-foreground text-xs">— {vatInfo.note}</span>}
          </div>

          {/* Line items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Linjer</p>
              <Button type="button" size="sm" variant="outline" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Tilføj linje</Button>
            </div>
            <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground font-medium px-1">
              <span className="col-span-5">Beskrivelse</span><span className="col-span-2">Antal</span>
              <span className="col-span-3">Stk. pris ({currency})</span><span className="col-span-2 text-right">Sum</span>
            </div>
            {items.map(item => (
              <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                <Input className="col-span-5 h-8 text-sm" placeholder="Beskrivelse" value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} />
                <Input className="col-span-2 h-8 text-sm" type="number" min="0.01" step="0.01" value={item.quantity} onChange={e => updateItem(item.id, 'quantity', e.target.value)} />
                <Input className="col-span-3 h-8 text-sm" type="number" min="0" step="0.01" value={item.unit_price} onChange={e => updateItem(item.id, 'unit_price', e.target.value)} />
                <span className="col-span-1 text-sm text-right tabular-nums">{fmt(item.quantity * item.unit_price)}</span>
                <button className="col-span-1 flex justify-center text-muted-foreground hover:text-destructive" onClick={() => removeItem(item.id)}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            <div className="border-t pt-2 space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{fmt(subtotal)} {currency}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Moms ({vatInfo.rate}%)</span><span>{fmt(vatAmount)} {currency}</span></div>
              <div className="flex justify-between font-bold text-base border-t pt-1"><span>Total</span><span>{fmt(total)} {currency}</span></div>
            </div>
          </div>

          {/* Payment settings */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Betalingsmetode</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Betalingsfrist (dage)</label>
              <Input type="number" min={0} value={paymentTermsDays} onChange={e => setPaymentTermsDays(parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Valuta</label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <Input placeholder="Bankkonto (Reg. XXXX – Konto XXXXXXXXXX)" value={bankAccount} onChange={e => setBankAccount(e.target.value)} />
          <Input placeholder="Note (vises på faktura)" value={notes} onChange={e => setNotes(e.target.value)} />

          <div className="flex gap-3 justify-end pt-1">
            <Button variant="outline" onClick={onClose} disabled={loading}>Annuller</Button>
            <Button onClick={handleSubmit} disabled={loading}>{loading ? 'Opretter...' : 'Opret faktura'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [stats, setStats] = useState<InvoiceStats | null>(null);
  const [company, setCompany] = useState<CompanyInfo>({ name: '' });
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [printInv, setPrintInv] = useState<InvoiceDetail | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [invList, statsData, settings] = await Promise.all([api.getInvoices(), api.getInvoiceStats(), api.getCompanySettings()]);
      setInvoices(invList);
      setStats(statsData);
      setCompany({ name: settings.tenant.name, cvr: settings.tenant.cvr, address: settings.tenant.address, phone: settings.tenant.phone, email: settings.tenant.email });
    } catch (err) {
      toast({ title: (err as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleView = async (id: string) => {
    try { setPrintInv(await api.getInvoice(id)); }
    catch (err) { toast({ title: (err as Error).message, variant: 'destructive' }); }
  };

  const handleMarkSent = async (id: string) => {
    try { await api.updateInvoice(id, { status: 'sent' }); toast({ title: 'Markeret som sendt' }); void load(); }
    catch (err) { toast({ title: (err as Error).message, variant: 'destructive' }); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Fakturaer</h1>
          <p className="text-sm text-muted-foreground">Opret og administrer fakturaer</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" />Opret faktura</Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-1"><FileText className="h-4 w-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">Sendte fakturaer</span></div>
            <p className="text-2xl font-bold">{stats.sent}</p>
            <p className="text-xs text-muted-foreground">{fmt(stats.total_sent_amount)} DKK samlet</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-1"><CheckCircle className="h-4 w-4 text-green-500" /><span className="text-xs text-muted-foreground">Betalte</span></div>
            <p className="text-2xl font-bold">{stats.paid}</p>
            <p className="text-xs text-muted-foreground">{fmt(stats.total_paid_amount)} DKK modtaget</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-blue-500" /><span className="text-xs text-muted-foreground">Kladder</span></div>
            <p className="text-2xl font-bold">{stats.draft}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-1"><AlertCircle className="h-4 w-4 text-red-500" /><span className="text-xs text-muted-foreground">Forfaldne</span></div>
            <p className="text-2xl font-bold">{stats.overdue}</p>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground">Indlæser...</div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
            <FileText className="h-10 w-10 opacity-40" />
            <p>Ingen fakturaer endnu</p>
            <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-3 w-3 mr-1" />Opret første faktura</Button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Fakturanr.</th>
                <th className="text-left px-4 py-3 font-medium">Kunde</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Dato</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Forfald</th>
                <th className="text-right px-4 py-3 font-medium">Total</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Handlinger</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id} className="border-b hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">{inv.invoice_number}</td>
                  <td className="px-4 py-3">{inv.customer_name}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{inv.invoice_date}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{inv.due_date}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{fmt(inv.total)} {inv.currency}</td>
                  <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => handleView(inv.id)}><Eye className="h-3.5 w-3.5 mr-1" />PDF</Button>
                      {inv.status === 'draft' && <Button size="sm" variant="outline" onClick={() => handleMarkSent(inv.id)}>Marker sendt</Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {createOpen && <CreateInvoiceDialog open={createOpen} onClose={() => setCreateOpen(false)} company={company} onCreated={load} />}
      {printInv && <PrintDialog inv={printInv} company={company} onClose={() => setPrintInv(null)} />}
    </div>
  );
}
