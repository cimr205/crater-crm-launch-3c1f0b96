import { useState } from 'react';
import { Palmtree, Plus, X, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

type LeaveStatus = 'pending' | 'approved' | 'rejected';
type LeaveRequest = { id: string; type: string; from: string; to: string; days: number; reason: string; status: LeaveStatus; submitted: string };

const LEAVE_TYPES = ['Ferie', 'Sygedag', 'Barn syg', 'Omsorg', 'Kursus', 'Andet'];
const STATUS_COLOR: Record<LeaveStatus, string> = { pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
const STATUS_ICON: Record<LeaveStatus, React.ReactNode> = { pending: <Clock className="h-3 w-3" />, approved: <CheckCircle2 className="h-3 w-3" />, rejected: <XCircle className="h-3 w-3" /> };
const STATUS_LABEL: Record<LeaveStatus, string> = { pending: 'Afventer', approved: 'Godkendt', rejected: 'Afvist' };

function daysBetween(from: string, to: string) {
  if (!from || !to) return 0;
  const diff = new Date(to).getTime() - new Date(from).getTime();
  return Math.max(1, Math.round(diff / 86400000) + 1);
}

export default function VacationPage() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<LeaveRequest[]>(() => {
    try { return JSON.parse(localStorage.getItem('vacation_requests') || '[]'); } catch { return []; }
  });
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState(LEAVE_TYPES[0]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');

  const save = (updated: LeaveRequest[]) => {
    setRequests(updated);
    localStorage.setItem('vacation_requests', JSON.stringify(updated));
  };

  const submit = () => {
    if (!from || !to) { toast({ title: 'Vælg start- og slutdato', variant: 'destructive' }); return; }
    const req: LeaveRequest = {
      id: crypto.randomUUID(),
      type,
      from,
      to,
      days: daysBetween(from, to),
      reason,
      status: 'pending',
      submitted: new Date().toLocaleDateString('da-DK'),
    };
    save([req, ...requests]);
    setShowForm(false);
    setFrom(''); setTo(''); setReason('');
    toast({ title: 'Ansøgning indsendt', description: `${req.days} dag(e) ${type}` });
  };

  const totalDays = requests.filter(r => r.status === 'approved').reduce((s, r) => s + r.days, 0);
  const pending = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Ferie & Fravær</h1>
          <p className="text-sm text-muted-foreground">Administrer ferieansøgninger og -saldi</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Luk' : 'Ny ansøgning'}
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Godkendte dage', value: String(totalDays), color: 'bg-green-500' },
          { label: 'Afventende', value: String(pending), color: 'bg-amber-500' },
          { label: 'Ansøgninger i alt', value: String(requests.length), color: 'bg-blue-500' },
          { label: 'Feriedage tilbage', value: `${Math.max(0, 25 - totalDays)}`, color: 'bg-violet-500' },
        ].map((c, i) => (
          <div key={i} className="rounded-2xl border bg-card p-5">
            <div className={`h-2 w-8 rounded-full ${c.color} mb-3`} />
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{c.label}</p>
            <p className="text-2xl font-bold mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <h3 className="font-semibold">Ny fraværsansøgning</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <select value={type} onChange={e => setType(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div />
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Fra dato</label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Til dato</label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} min={from} />
            </div>
          </div>
          {from && to && <p className="text-sm text-muted-foreground">{daysBetween(from, to)} dag(e)</p>}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Bemærkning (valgfri)</label>
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Beskriv årsagen..." />
          </div>
          <div className="flex gap-2">
            <Button onClick={submit}>Indsend ansøgning</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Annuller</Button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3 className="font-semibold text-sm">Mine ansøgninger</h3>
        </div>
        {requests.length === 0 ? (
          <div className="p-12 flex flex-col items-center gap-3 text-muted-foreground">
            <Palmtree className="h-10 w-10 opacity-30" />
            <p className="text-sm">Ingen ansøgninger endnu</p>
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)}><Plus className="h-3 w-3 mr-1" />Indsend ansøgning</Button>
          </div>
        ) : (
          <div className="divide-y">
            {requests.map(r => (
              <div key={r.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{r.type} — {r.days} dag(e)</p>
                  <p className="text-xs text-muted-foreground">{r.from} → {r.to}</p>
                </div>
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[r.status]}`}>
                  {STATUS_ICON[r.status]}{STATUS_LABEL[r.status]}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">{r.submitted}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
