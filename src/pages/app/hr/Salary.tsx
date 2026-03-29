import { useState } from 'react';
import { Banknote, Download, TrendingUp, Calendar, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const MONTHS = ['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];

type Payslip = { month: string; year: number; gross: number; tax: number; net: number };

const DEMO_PAYSLIPS: Payslip[] = [
  { month: 'Marts', year: 2026, gross: 42000, tax: 14700, net: 27300 },
  { month: 'Februar', year: 2026, gross: 42000, tax: 14700, net: 27300 },
  { month: 'Januar', year: 2026, gross: 40000, tax: 14000, net: 26000 },
];

function fmt(n: number) { return n.toLocaleString('da-DK', { minimumFractionDigits: 0 }) + ' kr'; }

export default function SalaryPage() {
  const { toast } = useToast();
  const [year] = useState(2026);
  const latest = DEMO_PAYSLIPS[0];

  const download = (p: Payslip) => {
    toast({ title: `Lønseddel for ${p.month} ${p.year}`, description: 'Download starter...' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Løn</h1>
        <p className="text-sm text-muted-foreground">Lønudbetalinger og lønhistorik</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: <Banknote className="h-5 w-5 text-white" />, label: 'Brutto (mdr.)', value: fmt(latest.gross), color: 'bg-blue-500' },
          { icon: <CreditCard className="h-5 w-5 text-white" />, label: 'Netto (mdr.)', value: fmt(latest.net), color: 'bg-green-500' },
          { icon: <TrendingUp className="h-5 w-5 text-white" />, label: 'Skat (mdr.)', value: fmt(latest.tax), color: 'bg-red-400' },
          { icon: <Calendar className="h-5 w-5 text-white" />, label: 'Lønsedler i alt', value: String(DEMO_PAYSLIPS.length), color: 'bg-violet-500' },
        ].map((c, i) => (
          <div key={i} className="rounded-2xl border bg-card p-5">
            <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${c.color} mb-3`}>{c.icon}</div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{c.label}</p>
            <p className="text-xl font-bold mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Year overview bar chart */}
      <div className="rounded-2xl border bg-card p-5">
        <h3 className="font-semibold text-sm mb-4">Månedlig nettoudbetaling — {year}</h3>
        <div className="flex gap-1.5 items-end h-20">
          {MONTHS.map((m, i) => {
            const slip = DEMO_PAYSLIPS.find(p => p.month.startsWith(m));
            const h = slip ? Math.round((slip.net / 30000) * 60) : 0;
            return (
              <div key={m} className="flex-1 flex flex-col items-center gap-1">
                <div className={`w-full rounded-sm transition-all ${slip ? 'bg-blue-500' : 'bg-muted'}`} style={{ height: `${Math.max(4, h)}px` }} />
                <span className="text-[9px] text-muted-foreground">{m}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payslip list */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3 className="font-semibold text-sm">Lønsedler</h3>
        </div>
        <div className="divide-y">
          {DEMO_PAYSLIPS.map((p, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3">
              <div className="flex-1">
                <p className="text-sm font-medium">{p.month} {p.year}</p>
                <p className="text-xs text-muted-foreground">Brutto: {fmt(p.gross)} · Skat: {fmt(p.tax)}</p>
              </div>
              <p className="text-sm font-semibold text-green-600 dark:text-green-400">{fmt(p.net)}</p>
              <Button size="sm" variant="outline" onClick={() => download(p)} className="gap-1.5">
                <Download className="h-3.5 w-3.5" />PDF
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
