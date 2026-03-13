import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';

type CalEvent = { id: string; date: string; title: string; time: string; color: string };
const COLORS = ['bg-blue-500', 'bg-green-500', 'bg-violet-500', 'bg-amber-500', 'bg-red-400'];
const DAY_NAMES = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];
const MONTH_NAMES = ['Januar','Februar','Marts','April','Maj','Juni','Juli','August','September','Oktober','November','December'];

function daysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate(); }
function firstDayOfMonth(year: number, month: number) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1; // Monday=0
}

export default function CalendarPage() {
  const { toast } = useToast();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [events, setEvents] = useState<CalEvent[]>(() => {
    try { return JSON.parse(localStorage.getItem('calendar_events') || '[]'); } catch { return []; }
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('09:00');
  const [colorIdx, setColorIdx] = useState(0);

  const save = (updated: CalEvent[]) => {
    setEvents(updated);
    localStorage.setItem('calendar_events', JSON.stringify(updated));
  };

  const prev = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const next = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const addEvent = () => {
    if (!newTitle.trim() || !selected) return;
    const e: CalEvent = { id: crypto.randomUUID(), date: selected, title: newTitle, time: newTime, color: COLORS[colorIdx] };
    save([...events, e]);
    setNewTitle(''); setShowForm(false);
    toast({ title: 'Begivenhed tilføjet', description: `${newTitle} — ${selected}` });
  };

  const days = daysInMonth(year, month);
  const firstDay = firstDayOfMonth(year, month);
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Kalender</h1>
        <p className="text-sm text-muted-foreground">Møder, begivenheder og deadlines samlet ét sted</p>
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <button onClick={prev} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><ChevronLeft className="h-4 w-4" /></button>
          <h2 className="font-semibold">{MONTH_NAMES[month]} {year}</h2>
          <button onClick={next} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><ChevronRight className="h-4 w-4" /></button>
        </div>

        {/* Day names */}
        <div className="grid grid-cols-7 border-b">
          {DAY_NAMES.map(d => (
            <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (!day) return <div key={idx} className="border-r border-b border-border/40 min-h-[80px] bg-muted/10" />;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayEvents = events.filter(e => e.date === dateStr);
            const isToday = dateStr === todayStr;
            const isSelected = selected === dateStr;
            return (
              <div
                key={idx}
                onClick={() => { setSelected(dateStr); setShowForm(false); }}
                className={`border-r border-b border-border/40 min-h-[80px] p-1.5 cursor-pointer transition-colors hover:bg-muted/30 ${isSelected ? 'bg-primary/10' : ''}`}
              >
                <div className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium mb-1 ${isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'}`}>
                  {day}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 2).map(e => (
                    <div key={e.id} className={`${e.color} text-white text-[10px] px-1 rounded truncate`}>
                      {e.time} {e.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && <div className="text-[10px] text-muted-foreground">+{dayEvents.length - 2} mere</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add event */}
      {selected && (
        <div className="rounded-2xl border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">{selected}</h3>
            {!showForm && (
              <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />Tilføj begivenhed
              </Button>
            )}
          </div>
          {showForm && (
            <div className="space-y-3">
              <div className="flex gap-3">
                <Input placeholder="Titel..." value={newTitle} onChange={e => setNewTitle(e.target.value)} className="flex-1" onKeyDown={e => e.key === 'Enter' && addEvent()} />
                <Input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} className="w-28" />
              </div>
              <div className="flex gap-2 items-center">
                {COLORS.map((c, i) => (
                  <button key={c} onClick={() => setColorIdx(i)} className={`h-5 w-5 rounded-full ${c} ${i === colorIdx ? 'ring-2 ring-offset-2 ring-primary' : ''}`} />
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={addEvent}>Gem</Button>
                <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Annuller</Button>
              </div>
            </div>
          )}
          {events.filter(e => e.date === selected).map(e => (
            <div key={e.id} className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full shrink-0 ${e.color}`} />
              <span className="text-sm flex-1">{e.time} — {e.title}</span>
              <button onClick={() => save(events.filter(ev => ev.id !== e.id))} className="text-muted-foreground hover:text-destructive transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {events.filter(e => e.date === selected).length === 0 && !showForm && (
            <p className="text-xs text-muted-foreground">Ingen begivenheder denne dag</p>
          )}
        </div>
      )}

      {!selected && events.length === 0 && (
        <div className="rounded-2xl border border-border bg-card/70 p-8 flex flex-col items-center gap-3 text-center text-muted-foreground">
          <CalendarDays className="h-10 w-10 opacity-30" />
          <p className="text-sm">Klik på en dag for at tilføje begivenheder</p>
        </div>
      )}
    </div>
  );
}
