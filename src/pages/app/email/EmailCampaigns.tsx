import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';
import { isConfigured } from '@/lib/serviceConfig';
import * as lm from '@/lib/listmonk';
import { Mail, Plus, Send, RefreshCw, BarChart2, X, Settings } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'sending' | 'sent' | 'paused' | 'finished' | 'cancelled';

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: CampaignStatus;
  recipientCount: number;
  sentCount: number;
  openCount: number;
  replyCount: number;
  createdAt: string;
  scheduledAt: string | null;
  sentAt: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Kladde', scheduled: 'Planlagt', running: 'Sender...',
  sending: 'Sender...', sent: 'Sendt', paused: 'Pauset',
  finished: 'Færdig', cancelled: 'Annulleret',
};
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  scheduled: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  running: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  sending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  sent: 'bg-green-500/10 text-green-600 border-green-500/20',
  finished: 'bg-green-500/10 text-green-600 border-green-500/20',
  paused: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  cancelled: 'bg-red-500/10 text-red-600 border-red-500/20',
};

// Map Listmonk campaign → unified Campaign
function fromListmonk(c: lm.ListmonkCampaign): Campaign {
  const statusMap: Record<string, CampaignStatus> = {
    draft: 'draft', scheduled: 'scheduled', running: 'running',
    paused: 'paused', cancelled: 'cancelled', finished: 'finished',
  };
  return {
    id: String(c.id),
    name: c.name,
    subject: c.subject,
    status: statusMap[c.status] ?? 'draft',
    recipientCount: c.to_send,
    sentCount: c.sent,
    openCount: c.views,
    replyCount: 0,
    createdAt: c.created_at,
    scheduledAt: c.send_at,
    sentAt: c.started_at,
  };
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EmailCampaignsPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const useListmonk = isConfigured('listmonk');

  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [listmonkLists, setListmonkLists] = useState<lm.ListmonkList[]>([]);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  const [newName, setNewName] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newRecipients, setNewRecipients] = useState('');

  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      if (useListmonk) {
        const [lists, camps] = await Promise.all([
          lm.getLists(),
          lm.getCampaigns(),
        ]);
        setListmonkLists(lists);
        if (lists.length && !selectedListId) setSelectedListId(lists[0].id);
        setCampaigns(camps.map(fromListmonk));
      } else {
        const [gmailRes, campaignsRes] = await Promise.all([
          api.getGmailStatus(),
          api.listEmailCampaigns().catch(() => ({ data: [] })),
        ]);
        setGmailConnected(gmailRes.connected);
        setGmailEmail(gmailRes.gmail_email ?? null);
        setCampaigns((campaignsRes as { data: Campaign[] }).data || []);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Kunne ikke hente kampagner');
    }
  }, [useListmonk, selectedListId]);

  useEffect(() => { void loadData(); }, [loadData]);

  // ── Gmail flow (fallback) ─────────────────────────────────────────────────────

  const handleConnectGmail = async () => {
    try {
      const { auth_url } = await api.getGmailAuthUrl();
      if (!auth_url) { toast({ title: 'Kunne ikke hente Gmail-URL', variant: 'destructive' }); return; }
      const w = 520, h = 700;
      const l = window.screenX + (window.outerWidth - w) / 2;
      const t = window.screenY + (window.outerHeight - h) / 2;
      const popup = window.open(auth_url, 'Connect Gmail', `width=${w},height=${h},left=${l},top=${t},resizable=yes,scrollbars=yes`);
      const timer = setInterval(() => { if (popup?.closed) { clearInterval(timer); void loadData(); } }, 1000);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Gmail-tilslutning fejlede', variant: 'destructive' });
    }
  };

  const handleDisconnectGmail = async () => {
    setLoading(true);
    try {
      await api.disconnectGmail();
      toast({ title: 'Gmail afbrudt' });
      await loadData();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Disconnect failed', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const handleSyncInbox = async () => {
    setLoading(true);
    try {
      const res = await api.syncGmailInbox();
      toast({ title: `${res.synced} mails synkroniseret` });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Sync failed', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  // ── Create campaign ────────────────────────────────────────────────────────────

  const handleCreateCampaign = async () => {
    if (!newName.trim() || !newSubject.trim() || !newBody.trim()) return;
    setLoading(true);
    try {
      if (useListmonk) {
        if (!selectedListId) { toast({ title: 'Vælg en mailing-liste', variant: 'destructive' }); return; }
        await lm.createCampaign({
          name: newName,
          subject: newSubject,
          body: newBody,
          list_ids: [selectedListId],
          content_type: 'plain',
        });
        // Also add recipients entered manually as subscribers
        const lines = newRecipients.split('\n').map((l) => l.trim()).filter(Boolean);
        for (const line of lines) {
          const [email, name] = line.split(',').map((s) => s.trim());
          if (email) await lm.upsertSubscriber(email, name ?? email, [selectedListId]).catch(() => undefined);
        }
        toast({ title: 'Kampagne oprettet i Listmonk' });
      } else {
        const recipients = newRecipients.split('\n').map((l) => l.trim()).filter(Boolean)
          .map((l) => { const [email, name] = l.split(',').map((s) => s.trim()); return { email, name }; });
        await api.createEmailCampaign({ name: newName, subject: newSubject, body: newBody, recipients, trackOpens: true, trackReplies: true });
        toast({ title: 'Kampagne oprettet' });
      }
      setShowCreate(false);
      setNewName(''); setNewSubject(''); setNewBody(''); setNewRecipients('');
      await loadData();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Could not create campaign', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  // ── Send / pause campaign ──────────────────────────────────────────────────────

  const handleSendCampaign = async (campaign: Campaign) => {
    setLoading(true);
    try {
      if (useListmonk) {
        await lm.updateCampaignStatus(Number(campaign.id), 'running');
        toast({ title: 'Kampagne startet i Listmonk' });
      } else {
        const res = await api.sendEmailCampaign(campaign.id);
        toast({ title: `Kampagne sendt — ${res.queued} i kø` });
      }
      await loadData();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Send failed', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const handlePauseCampaign = async (campaign: Campaign) => {
    setLoading(true);
    try {
      if (useListmonk) {
        await lm.updateCampaignStatus(Number(campaign.id), 'paused');
        toast({ title: 'Kampagne pauset' });
      } else {
        await api.pauseEmailCampaign(campaign.id);
        toast({ title: 'Kampagne pauset' });
      }
      await loadData();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Pause failed', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const isConnected = useListmonk || gmailConnected;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">E-mail kampagner</h1>
          <p className="text-sm text-muted-foreground">
            {useListmonk ? 'Listmonk — self-hosted mailing-list platform' : 'Send bulk e-mails via din Gmail'}
          </p>
        </div>
        <div className="flex gap-2">
          {isConnected && (
            <>
              {!useListmonk && (
                <Button variant="outline" size="sm" onClick={() => void handleSyncInbox()} disabled={loading}>
                  <RefreshCw className="h-4 w-4 mr-1" />Sync indbakke
                </Button>
              )}
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-1" />Ny kampagne
              </Button>
            </>
          )}
        </div>
      </div>

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}

      {/* Connection card */}
      <Card className="p-5 bg-card/70 border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-9 w-9 rounded-full flex items-center justify-center ${useListmonk ? 'bg-purple-500/10' : 'bg-red-500/10'}`}>
              <Mail className={`h-4 w-4 ${useListmonk ? 'text-purple-500' : 'text-red-500'}`} />
            </div>
            <div>
              <div className="text-sm font-medium">{useListmonk ? 'Listmonk' : 'Gmail'}</div>
              <div className="text-xs text-muted-foreground">
                {useListmonk
                  ? `${listmonkLists.length} mailing-liste(r) fundet`
                  : gmailConnected ? `Forbundet som ${gmailEmail}` : 'Ikke forbundet'}
              </div>
            </div>
          </div>
          {useListmonk ? (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">Aktiv</Badge>
              <Button size="sm" variant="ghost" onClick={() => navigate('/app/integrations')}>
                <Settings className="h-3.5 w-3.5 mr-1" />Indstillinger
              </Button>
            </div>
          ) : gmailConnected ? (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">Aktiv</Badge>
              <Button size="sm" variant="ghost" onClick={() => void handleDisconnectGmail()} disabled={loading}>Afbryd</Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => void handleConnectGmail()}>Forbind Gmail</Button>
          )}
        </div>
      </Card>

      {/* Listmonk: list picker */}
      {useListmonk && listmonkLists.length > 0 && (
        <div className="flex items-center gap-3">
          <label className="text-sm text-muted-foreground shrink-0">Mailing-liste:</label>
          <select
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            value={selectedListId ?? ''}
            onChange={(e) => setSelectedListId(Number(e.target.value))}
          >
            {listmonkLists.map((l) => (
              <option key={l.id} value={l.id}>{l.name} ({l.subscriber_count} abonnenter)</option>
            ))}
          </select>
        </div>
      )}

      {/* Not connected state */}
      {!isConnected && (
        <Card className="p-6 bg-card/70 border-dashed border-border">
          <div className="text-center space-y-3">
            <div className="text-4xl">📧</div>
            <div className="font-semibold">Forbind for at starte kampagner</div>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Brug <strong>Listmonk</strong> (self-hosted, anbefalet til bulk-udsendelse) eller forbind din Gmail.
            </p>
            <div className="flex justify-center gap-2">
              <Button onClick={() => navigate('/app/integrations')} variant="outline">
                <Settings className="h-4 w-4 mr-1" />Konfigurér Listmonk
              </Button>
              <Button onClick={() => void handleConnectGmail()}>Forbind Gmail</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Create form */}
      {showCreate && (
        <Card className="p-5 bg-card/70 border-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Ny e-mail kampagne</div>
            <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          {useListmonk && listmonkLists.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Mailing-liste *</label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={selectedListId ?? ''}
                onChange={(e) => setSelectedListId(Number(e.target.value))}
              >
                {listmonkLists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <Input placeholder="Kampagnenavn (til intern reference)" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Input placeholder="Emne / Subject line" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} />
          </div>
          <Textarea placeholder="Mail-indhold — brug {{name}} til personalisering" value={newBody} onChange={(e) => setNewBody(e.target.value)} rows={6} />
          <div>
            <div className="text-xs text-muted-foreground mb-1">
              {useListmonk ? 'Tilføj modtagere (abonnenter) — én pr. linje: email eller email, navn' : 'Modtagere — én pr. linje. Format: email eller email, navn'}
            </div>
            <Textarea
              placeholder={`john@example.com, John\njane@example.com\nbob@example.com, Bob Smith`}
              value={newRecipients} onChange={(e) => setNewRecipients(e.target.value)} rows={4}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => void handleCreateCampaign()} disabled={loading || !newName.trim() || !newSubject.trim()}>Opret kampagne</Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Annuller</Button>
          </div>
        </Card>
      )}

      {/* Campaign list */}
      {isConnected && (
        <Card className="p-5 bg-card/70 border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Kampagner</div>
            <Button size="sm" variant="ghost" onClick={() => void loadData()} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          {campaigns.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Ingen kampagner endnu. Opret din første kampagne.</div>
          ) : (
            <div className="space-y-2">
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{campaign.name}</span>
                        <Badge variant="outline" className={`text-xs ${STATUS_COLORS[campaign.status] ?? ''}`}>
                          {STATUS_LABEL[campaign.status] ?? campaign.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{campaign.subject}</div>
                    </div>
                    <div className="flex gap-2">
                      {(campaign.status === 'draft') && (
                        <Button size="sm" onClick={() => void handleSendCampaign(campaign)} disabled={loading}>
                          <Send className="h-3 w-3 mr-1" />Send
                        </Button>
                      )}
                      {(campaign.status === 'running' || campaign.status === 'sending') && (
                        <Button size="sm" variant="outline" onClick={() => void handlePauseCampaign(campaign)} disabled={loading}>Pause</Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setSelectedCampaign(selectedCampaign?.id === campaign.id ? null : campaign)}>
                        <BarChart2 className="h-3 w-3 mr-1" />Stats
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div><div className="text-sm font-medium">{campaign.recipientCount}</div><div className="text-xs text-muted-foreground">Modtagere</div></div>
                    <div><div className="text-sm font-medium">{campaign.sentCount}</div><div className="text-xs text-muted-foreground">Sendt</div></div>
                    <div>
                      <div className="text-sm font-medium">{campaign.sentCount > 0 ? `${((campaign.openCount / campaign.sentCount) * 100).toFixed(0)}%` : '—'}</div>
                      <div className="text-xs text-muted-foreground">Åbnet</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium">{campaign.sentCount > 0 ? `${((campaign.replyCount / campaign.sentCount) * 100).toFixed(0)}%` : '—'}</div>
                      <div className="text-xs text-muted-foreground">Besvaret</div>
                    </div>
                  </div>
                  {campaign.sentAt && (
                    <div className="text-xs text-muted-foreground">Sendt: {new Date(campaign.sentAt).toLocaleString('da-DK')}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Info */}
      <Card className="p-5 bg-card/70 border-border">
        <div className="text-sm font-semibold mb-2">Sådan fungerer det</div>
        <ul className="text-sm text-muted-foreground space-y-1">
          {useListmonk ? (
            <>
              <li>→ <strong>Listmonk</strong> er en self-hosted mailing-list platform der sender millioner af mails</li>
              <li>→ Opret mailing-lister i Listmonk og tilføj modtagere her via email-feltet</li>
              <li>→ Tracks åbninger (views) og klik automatisk via Listmonk</li>
              <li>→ Konfigurér din SMTP-server i Listmonk → Settings → SMTP</li>
            </>
          ) : (
            <>
              <li>→ Hver medarbejder forbinder sin <strong>egen Gmail-konto</strong></li>
              <li>→ Mails sendes fra din personlige Gmail — ikke en fælles konto</li>
              <li>→ Systemet tracker hvornår modtagere åbner og svarer på mails</li>
              <li>→ Brug til outreach, mødebooking, opfølgning og kolde kampagner</li>
            </>
          )}
        </ul>
      </Card>
    </div>
  );
}
