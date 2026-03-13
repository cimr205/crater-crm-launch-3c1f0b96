import { useEffect, useState } from 'react';
import { Clock, LogIn, LogOut, Calendar, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

type CheckEntry = { id: string; type: 'in' | 'out'; time: string; date: string };

function fmtMs(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}t ${m}m`;
}

export default function AttendancePage() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<CheckEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem('attendance_entries') || '[]'); } catch { return []; }
  });
  const [checkedIn, setCheckedIn] = useState<string | null>(() => localStorage.getItem('attendance_checkin'));
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!checkedIn) { setElapsed(0); return; }
    const tick = () => setElapsed(Date.now() - Number(checkedIn));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [checkedIn]);

  const save = (updated: CheckEntry[]) => {
    setEntries(updated);
    localStorage.setItem('attendance_entries', JSON.stringify(updated));
  };

  const checkIn = () => {
    const now = Date.now();
    localStorage.setItem('attendance_checkin', String(now));
    setCheckedIn(String(now));
    const e: CheckEntry = {
      id: crypto.randomUUID(),
      type: 'in',
      time: new Date(now).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }),
      date: new Date(now).toLocaleDateString('da-DK'),
    };
    save([e, ...entries]);
    toast({ title: 'Check-in registreret', description: e.time });
  };

  const checkOut = () => {
    const now = Date.now();
    localStorage.removeItem('attendance_checkin');
    const e: CheckEntry = {
      id: crypto.randomUUID(),
      type: 'out',
      time: new Date(now).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }),
      date: new Date(now).toLocaleDateString('da-DK'),
    };
    save([e, ...entries]);
    setCheckedIn(null);
    toast({ title: 'Check-ud registreret', description: e.time });
  };

  const todayStr = new Date().toLocaleDateString('da-DK');
  const todayCount = entries.filter(e => e.date === todayStr).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Fremmøde</h1>
        <p className="text-sm text-muted-foreground">Registrer og se medarbejdernes fremmøde</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: <Clock className="h-5 w-5 text-white" />, label: 'Status', value: checkedIn ? 'Tjekket ind' : 'Ikke tjekket ind', color: checkedIn ? 'bg-green-500' : 'bg-slate-400' },
          { icon: <TrendingUp className="h-5 w-5 text-white" />, label: 'Timer nu', value: checkedIn ? fmtMs(elapsed) : '0t 0m', color: 'bg-blue-500' },
          { icon: <Calendar className="h-5 w-5 text-white" />, label: 'Registreringer total', value: String(entries.length), color: 'bg-violet-500' },
          { icon: <LogIn className="h-5 w-5 text-white" />, label: 'I dag', value: `${todayCount} hændelser`, color: 'bg-amber-500' },
        ].map((c, i) => (
          <div key={i} className="rounded-2xl border bg-card p-5">
            <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${c.color} mb-3`}>{c.icon}</div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{c.label}</p>
            <p className="text-lg font-bold mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border bg-card p-8 flex flex-col items-center gap-4 text-center">
        <div className={`h-20 w-20 rounded-full flex items-center justify-center ${checkedIn ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'}`}>
          <Clock className={`h-10 w-10 ${checkedIn ? 'text-green-500' : 'text-muted-foreground'}`} />
        </div>
        {checkedIn ? (
          <>
            <div>
              <p className="text-3xl font-bold tabular-nums">{fmtMs(elapsed)}</p>
              <p className="text-sm text-muted-foreground">Tjekket ind kl. {new Date(Number(checkedIn)).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <Button size="lg" variant="destructive" onClick={checkOut} className="gap-2">
              <LogOut className="h-4 w-4" />Check ud
            </Button>
          </>
        ) : (
          <>
            <div>
              <p className="font-semibold">Ikke tjekket ind endnu</p>
              <p className="text-sm text-muted-foreground">Klik for at starte din arbejdsdag</p>
            </div>
            <Button size="lg" onClick={checkIn} className="gap-2">
              <LogIn className="h-4 w-4" />Check ind
            </Button>
          </>
        )}
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3 className="font-semibold text-sm">Historik</h3>
        </div>
        {entries.length === 0 ? (
          <div className="p-12 flex flex-col items-center gap-3 text-muted-foreground">
            <Clock className="h-10 w-10 opacity-30" />
            <p className="text-sm">Ingen fremmøderegistreringer endnu</p>
          </div>
        ) : (
          <div className="divide-y">
            {entries.slice(0, 20).map(e => (
              <div key={e.id} className="flex items-center gap-4 px-5 py-3">
                <Badge variant={e.type === 'in' ? 'default' : 'secondary'} className="w-20 justify-center shrink-0">
                  {e.type === 'in' ? 'Check ind' : 'Check ud'}
                </Badge>
                <span className="text-sm font-medium">{e.time}</span>
                <span className="text-sm text-muted-foreground ml-auto">{e.date}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
