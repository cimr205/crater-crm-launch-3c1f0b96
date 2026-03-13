import { useState } from 'react';
import { Megaphone, Plus, X, Mail, BarChart2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useNavigate, useParams } from 'react-router-dom';
import { isLocale } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';

type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed';
type Campaign = { id: string; name: string; type: string; status: CampaignStatus; leads: number; opens: number; clicks: number; created: string };

const STATUS_BADGE: Record<CampaignStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Kladde', variant: 'secondary' },
  active: { label: 'Aktiv', variant: 'default' },
  paused: { label: 'Pauset', variant: 'outline' },
  completed: { label: 'Afsluttet', variant: 'secondary' },
};

export default function CampaignsPage() {
  const navigate = useNavigate();
  const { locale } = useParams();
  const loc = isLocale(locale) ? locale : 'en';
  const { toast } = useToast();

  const [campaigns, setCampaigns] = useState<Campaign[]>(() => {
    try { return JSON.parse(localStorage.getItem('campaigns_list') || '[]'); } catch { return []; }
  });
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('Email');

  const save = (updated: Campaign[]) => {
    setCampaigns(updated);
    localStorage.setItem('campaigns_list', JSON.stringify(updated));
  };

  const create = () => {
    if (!name.trim()) { toast({ title: 'Navn er påkrævet', variant: 'destructive' }); return; }
    const c: Campaign = {
      id: crypto.randomUUID(),
      name,
      type,
      status: 'draft',
      leads: 0,
      opens: 0,
      clicks: 0,
      created: new Date().toLocaleDateString('da-DK'),
    };
    save([c, ...campaigns]);
    setName(''); setShowForm(false);
    toast({ title: `Kampagne "${name}" oprettet` });
  };

  const remove = (id: string) => save(campaigns.filter(c => c.id !== id));

  const totalLeads = campaigns.reduce((s, c) => s + c.leads, 0);
  const activeCount = campaigns.filter(c => c.status === 'active').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Kampagner</h1>
          <p className="text-sm text-muted-foreground">Opret og administrer marketingkampagner</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/${loc}/app/email/campaigns`)} className="gap-2">
            <Mail className="h-4 w-4" />Email kampagner
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
          <Button onClick={() => setShowForm(!showForm)} className="gap-2">
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? 'Luk' : 'Ny kampagne'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Kampagner i alt', value: String(campaigns.length), icon: <Megaphone className="h-5 w-5 text-white" />, color: 'bg-violet-500' },
          { label: 'Aktive', value: String(activeCount), icon: <BarChart2 className="h-5 w-5 text-white" />, color: 'bg-green-500' },
          { label: 'Leads nået', value: String(totalLeads), icon: <Mail className="h-5 w-5 text-white" />, color: 'bg-blue-500' },
          { label: 'Åbningsrate', value: campaigns.length > 0 ? `${Math.round(campaigns.reduce((s, c) => s + (c.leads > 0 ? c.opens / c.leads * 100 : 0), 0) / campaigns.length)}%` : '—', icon: <BarChart2 className="h-5 w-5 text-white" />, color: 'bg-amber-500' },
        ].map((c, i) => (
          <div key={i} className="rounded-2xl border bg-card p-5">
            <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${c.color} mb-3`}>{c.icon}</div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{c.label}</p>
            <p className="text-2xl font-bold mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="rounded-2xl border bg-card p-5 space-y-4">
          <h3 className="font-semibold text-sm">Ny kampagne</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Kampagnenavn *" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && create()} />
            <select value={type} onChange={e => setType(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
              {['Email', 'Meta Ads', 'LinkedIn', 'SMS', 'Andet'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <Button onClick={create}>Opret kampagne</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Annuller</Button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-sm">Alle kampagner</h3>
          <button onClick={() => navigate(`/${loc}/app/email/campaigns`)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            Email kampagner <ArrowRight className="h-3 w-3" />
          </button>
        </div>
        {campaigns.length === 0 ? (
          <div className="p-12 flex flex-col items-center gap-3 text-muted-foreground">
            <Megaphone className="h-10 w-10 opacity-30" />
            <p className="text-sm">Ingen kampagner endnu</p>
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)}><Plus className="h-3 w-3 mr-1" />Opret kampagne</Button>
          </div>
        ) : (
          <div className="divide-y">
            {campaigns.map(c => (
              <div key={c.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.type} · {c.created}</p>
                </div>
                <div className="hidden md:flex gap-4 text-xs text-muted-foreground">
                  <span>{c.leads} leads</span>
                  <span>{c.opens} åbninger</span>
                </div>
                <Badge variant={STATUS_BADGE[c.status].variant}>{STATUS_BADGE[c.status].label}</Badge>
                <button onClick={() => remove(c.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
