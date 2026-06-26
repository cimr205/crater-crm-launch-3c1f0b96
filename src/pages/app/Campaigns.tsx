import { useCallback, useEffect, useState } from 'react';
import { Megaphone, Plus, X, Mail, BarChart2, ArrowRight, Send, Pause, RefreshCw, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useNavigate, useParams } from 'react-router-dom';
import { isLocale } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';
import { api, type Campaign } from '@/lib/api';

const STATUS_MAP: Record<Campaign['status'], { label: string; color: string }> = {
  draft:     { label: 'Kladde',    color: 'bg-muted text-muted-foreground' },
  scheduled: { label: 'Planlagt',  color: 'bg-blue-500/15 text-blue-400' },
  sent:      { label: 'Sendt',     color: 'bg-emerald-500/15 text-emerald-400' },
  cancelled: { label: 'Annulleret',color: 'bg-destructive/15 text-destructive' },
};

export default function CampaignsPage() {
  const navigate = useNavigate();
  const { locale } = useParams();
  const loc = isLocale(locale) ? locale : 'en';
  const { toast } = useToast();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listCampaigns();
      setCampaigns(res.data ?? []);
    } catch (err) {
      toast({ title: (err as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    if (!name.trim() || !subject.trim() || !body.trim()) {
      toast({ title: 'Navn, emne og indhold er påkrævet', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await api.createCampaign({ name: name.trim(), subject: subject.trim(), body: body.trim() });
      toast({ title: `Kampagne "${name}" oprettet` });
      setName(''); setSubject(''); setBody(''); setShowForm(false);
      await load();
    } catch (err) {
      toast({ title: (err as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const sendCampaign = async (id: string, cName: string) => {
    setSendingId(id);
    try {
      await api.sendEmailCampaign(id);
      toast({ title: `"${cName}" er nu sendt` });
      await load();
    } catch (err) {
      toast({ title: (err as Error).message, variant: 'destructive' });
    } finally {
      setSendingId(null);
    }
  };

  const pauseCampaign = async (id: string) => {
    try {
      await api.pauseEmailCampaign(id);
      await load();
      toast({ title: 'Kampagne pauset' });
    } catch (err) {
      toast({ title: (err as Error).message, variant: 'destructive' });
    }
  };

  const draftCount = campaigns.filter(c => c.status === 'draft').length;
  const sentCount = campaigns.filter(c => c.status === 'sent').length;
  const scheduledCount = campaigns.filter(c => c.status === 'scheduled').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Kampagner</h1>
          <p className="text-sm text-muted-foreground">Email-kampagner til leads og kunder</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" onClick={() => navigate(`/${loc}/app/meta/ads`)} className="gap-2">
            <BarChart2 className="h-4 w-4" />Meta Ads
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
          <Button onClick={() => setShowForm(!showForm)} className="gap-2">
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? 'Luk' : 'Ny kampagne'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Megaphone, label: 'I alt', value: campaigns.length, color: 'text-primary' },
          { icon: Mail, label: 'Kladder', value: draftCount, color: 'text-muted-foreground' },
          { icon: Calendar, label: 'Planlagt', value: scheduledCount, color: 'text-blue-400' },
          { icon: Send, label: 'Sendt', value: sentCount, color: 'text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{s.label}</p>
            <p className="text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h3 className="font-semibold">Ny email-kampagne</h3>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Kampagnenavn *</label>
              <Input placeholder="fx. Sommerkampagne 2026" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Emne *</label>
              <Input placeholder="Email-emnelinjen dine leads ser" value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Indhold *</label>
              <Textarea
                placeholder="Skriv email-indholdet her..."
                value={body}
                onChange={e => setBody(e.target.value)}
                className="min-h-[120px]"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={create} disabled={saving || !name.trim() || !subject.trim() || !body.trim()}>
              {saving ? 'Gemmer...' : 'Opret kampagne'}
            </Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setName(''); setSubject(''); setBody(''); }}>
              Annuller
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-sm">Alle kampagner</h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />Indlæser...
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <Megaphone className="h-10 w-10 opacity-30" />
            <p className="text-sm">Ingen kampagner endnu</p>
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />Opret første kampagne
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {campaigns.map(c => {
              const status = STATUS_MAP[c.status];
              return (
                <div key={c.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{c.subject}</p>
                    {c.sentAt && (
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5 font-mono">
                        Sendt {new Date(c.sentAt).toLocaleDateString('da-DK')}
                      </p>
                    )}
                    {c.scheduledAt && c.status === 'scheduled' && (
                      <p className="text-[11px] text-blue-400 mt-0.5 font-mono">
                        Planlagt {new Date(c.scheduledAt).toLocaleDateString('da-DK')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.status === 'draft' && (
                      <Button
                        size="sm"
                        className="gap-1.5 h-8"
                        onClick={() => sendCampaign(c.id, c.name)}
                        disabled={sendingId === c.id}
                      >
                        <Send className="h-3.5 w-3.5" />
                        {sendingId === c.id ? 'Sender...' : 'Send nu'}
                      </Button>
                    )}
                    {c.status === 'scheduled' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 h-8"
                        onClick={() => pauseCampaign(c.id)}
                      >
                        <Pause className="h-3.5 w-3.5" />Pause
                      </Button>
                    )}
                    <p className="text-[11px] font-mono text-muted-foreground/60">
                      {new Date(c.createdAt).toLocaleDateString('da-DK')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Link to advanced email campaigns */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Avancerede email-kampagner</p>
          <p className="text-xs text-muted-foreground mt-0.5">Bulk-email, A/B-test, tracking og automatiske sekvenser</p>
        </div>
        <Button variant="outline" onClick={() => navigate(`/${loc}/app/email/campaigns`)} className="gap-2 shrink-0">
          <Mail className="h-4 w-4" />Åbn
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
