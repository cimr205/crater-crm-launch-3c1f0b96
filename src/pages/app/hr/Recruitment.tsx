import { useState } from 'react';
import { UserPlus, Plus, X, Mail, Phone, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

type Stage = 'applied' | 'screening' | 'interview' | 'offer';
type Candidate = { id: string; name: string; role: string; email: string; phone: string; stage: Stage; added: string };

const STAGES: { key: Stage; label: string; color: string; bg: string }[] = [
  { key: 'applied',   label: 'Ansøgt',      color: 'text-blue-700 dark:text-blue-300',   bg: 'bg-blue-50 dark:bg-blue-950/30' },
  { key: 'screening', label: 'Screening',   color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  { key: 'interview', label: 'Samtale',     color: 'text-violet-700 dark:text-violet-300', bg: 'bg-violet-50 dark:bg-violet-950/30' },
  { key: 'offer',     label: 'Tilbud',      color: 'text-green-700 dark:text-green-300', bg: 'bg-green-50 dark:bg-green-950/30' },
];

export default function RecruitmentPage() {
  const { toast } = useToast();
  const [candidates, setCandidates] = useState<Candidate[]>(() => {
    try { return JSON.parse(localStorage.getItem('recruitment_candidates') || '[]'); } catch { return []; }
  });
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const save = (updated: Candidate[]) => {
    setCandidates(updated);
    localStorage.setItem('recruitment_candidates', JSON.stringify(updated));
  };

  const add = () => {
    if (!name.trim() || !role.trim()) { toast({ title: 'Navn og stilling er påkrævet', variant: 'destructive' }); return; }
    const c: Candidate = { id: crypto.randomUUID(), name, role, email, phone, stage: 'applied', added: new Date().toLocaleDateString('da-DK') };
    save([...candidates, c]);
    setName(''); setRole(''); setEmail(''); setPhone(''); setShowForm(false);
    toast({ title: `${name} tilføjet`, description: role });
  };

  const advance = (id: string) => {
    const order: Stage[] = ['applied', 'screening', 'interview', 'offer'];
    setCandidates(prev => {
      const updated = prev.map(c => {
        if (c.id !== id) return c;
        const idx = order.indexOf(c.stage);
        return idx < order.length - 1 ? { ...c, stage: order[idx + 1] } : c;
      });
      localStorage.setItem('recruitment_candidates', JSON.stringify(updated));
      return updated;
    });
  };

  const remove = (id: string) => save(candidates.filter(c => c.id !== id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Rekruttering</h1>
          <p className="text-sm text-muted-foreground">Administrer jobopslag og kandidater</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Luk' : 'Tilføj kandidat'}
        </Button>
      </div>

      {showForm && (
        <div className="rounded-2xl border bg-card p-5 space-y-4">
          <h3 className="font-semibold text-sm">Ny kandidat</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Navn *" value={name} onChange={e => setName(e.target.value)} />
            <Input placeholder="Stilling *" value={role} onChange={e => setRole(e.target.value)} />
            <Input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
            <Input placeholder="Telefon" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button onClick={add}>Tilføj</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Annuller</Button>
          </div>
        </div>
      )}

      {/* Kanban board */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        {STAGES.map(stage => {
          const cols = candidates.filter(c => c.stage === stage.key);
          return (
            <div key={stage.key} className={`rounded-2xl border p-4 space-y-3 ${stage.bg}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold uppercase tracking-wider ${stage.color}`}>{stage.label}</span>
                <Badge variant="secondary" className="text-xs">{cols.length}</Badge>
              </div>
              {cols.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Ingen kandidater</p>
              ) : (
                cols.map(c => (
                  <div key={c.id} className="rounded-xl border bg-card p-3 space-y-2 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.role}</p>
                      </div>
                      <button onClick={() => remove(c.id)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {(c.email || c.phone) && (
                      <div className="flex gap-2 text-muted-foreground">
                        {c.email && <Mail className="h-3 w-3" />}
                        {c.phone && <Phone className="h-3 w-3" />}
                      </div>
                    )}
                    {stage.key !== 'offer' && (
                      <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={() => advance(c.id)}>
                        <MoreHorizontal className="h-3 w-3 mr-1" />Ryk frem
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>

      {candidates.length === 0 && (
        <div className="rounded-2xl border border-border bg-card/70 p-12 flex flex-col items-center gap-3 text-center text-muted-foreground">
          <UserPlus className="h-10 w-10 opacity-30" />
          <p className="text-sm">Ingen kandidater endnu — tilføj en for at komme i gang</p>
        </div>
      )}
    </div>
  );
}
