import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';
import { Mail, Plus, Send, RefreshCw, BarChart2, X } from 'lucide-react';

type Campaign = {
  id: string;
  name: string;
  subject: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused';
  recipientCount: number;
  sentCount: number;
  openCount: number;
  replyCount: number;
  createdAt: string;
  scheduledAt: string | null;
  sentAt: string | null;
};

const statusLabel: Record<string, string> = {
  draft: 'Kladde',
  scheduled: 'Planlagt',
  sending: 'Sender...',
  sent: 'Sendt',
  paused: 'Pauset',
};

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  scheduled: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  sending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  sent: 'bg-green-500/10 text-green-600 border-green-500/20',
  paused: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
};

export default function EmailCampaignsPage() {
  const { toast } = useToast();
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newRecipients, setNewRecipients] = useState('');

  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const [gmailRes, campaignsRes] = await Promise.all([
        api.getGmailStatus(),
        api.listEmailCampaigns().catch(() => ({ data: [] })),
      ]);
      setGmailConnected(gmailRes.connected);
      setGmailEmail(gmailRes.gmail_email ?? null);
      setCampaigns((campaignsRes as { data: Campaign[] }).data || []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load email data');
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleConnectGmail = async () => {
    try {
      const { auth_url } = await api.getGmailAuthUrl();
      if (!auth_url) {
        toast({ title: 'Kunne ikke hente Gmail-URL', variant: 'destructive' });
        return;
      }
      const width = 520, height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const popup = window.open(auth_url, 'Connect Gmail', `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
      const timer = setInterval(() => {
        if (popup?.closed) {
          clearInterval(timer);
          loadData();
        }
      }, 1000);
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
    } finally {
      setLoading(false);
    }
  };

  const handleSyncInbox = async () => {
    setLoading(true);
    try {
      const res = await api.syncGmailInbox();
      toast({ title: `${res.synced} mails synkroniseret` });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Sync failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = async () => {
    if (!newName.trim() || !newSubject.trim() || !newBody.trim()) return;
    setLoading(true);
    try {
      const recipients = newRecipients
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [email, name] = line.split(',').map((s) => s.trim());
          return { email, name };
        });
      await api.createEmailCampaign({
        name: newName,
        subject: newSubject,
        body: newBody,
        recipients,
        trackOpens: true,
        trackReplies: true,
      });
      toast({ title: 'Kampagne oprettet' });
      setShowCreate(false);
      setNewName('');
      setNewSubject('');
      setNewBody('');
      setNewRecipients('');
      await loadData();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Could not create campaign', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSendCampaign = async (campaignId: string) => {
    setLoading(true);
    try {
      const res = await api.sendEmailCampaign(campaignId);
      toast({ title: `Kampagne sendt — ${res.queued} i kø` });
      await loadData();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Send failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handlePauseCampaign = async (campaignId: string) => {
    setLoading(true);
    try {
      await api.pauseEmailCampaign(campaignId);
      toast({ title: 'Kampagne pauset' });
      await loadData();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Pause failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">E-mail kampagner</h1>
          <p className="text-sm text-muted-foreground">
            Send bulk e-mails via din Gmail — med tracking på opens og svar
          </p>
        </div>
        <div className="flex gap-2">
          {gmailConnected && (
            <>
              <Button variant="outline" size="sm" onClick={handleSyncInbox} disabled={loading}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Sync indbakke
              </Button>
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Ny kampagne
              </Button>
            </>
          )}
        </div>
      </div>

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}

      {/* Gmail connection */}
      <Card className="p-5 bg-card/70 border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-red-500/10 flex items-center justify-center">
              <Mail className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <div className="text-sm font-medium">Gmail</div>
              <div className="text-xs text-muted-foreground">
                {gmailConnected ? `Forbundet som ${gmailEmail}` : 'Ikke forbundet'}
              </div>
            </div>
          </div>
          {gmailConnected ? (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">
                Aktiv
              </Badge>
              <Button size="sm" variant="ghost" onClick={handleDisconnectGmail} disabled={loading}>
                Afbryd
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={handleConnectGmail}>
              Forbind Gmail
            </Button>
          )}
        </div>
      </Card>

      {!gmailConnected && (
        <Card className="p-6 bg-card/70 border-dashed border-border">
          <div className="text-center space-y-3">
            <div className="text-4xl">📧</div>
            <div className="font-semibold">Forbind din Gmail for at starte</div>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Hver medarbejder forbinder sin egen Gmail-konto. Mails sendes fra din personlige
              konto, og du kan tracke opens og svar.
            </p>
            <Button onClick={handleConnectGmail}>Forbind Gmail</Button>
          </div>
        </Card>
      )}

      {/* Create campaign form */}
      {showCreate && (
        <Card className="p-5 bg-card/70 border-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Ny e-mail kampagne</div>
            <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Kampagnenavn (til intern reference)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Input
              placeholder="Emne / Subject line"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
            />
          </div>
          <Textarea
            placeholder="Mail-indhold — brug {{name}} til personalisering"
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            rows={6}
          />
          <div>
            <div className="text-xs text-muted-foreground mb-1">
              Modtagere — én pr. linje. Format: email eller email, navn
            </div>
            <Textarea
              placeholder={`john@example.com, John\njane@example.com\nbob@example.com, Bob Smith`}
              value={newRecipients}
              onChange={(e) => setNewRecipients(e.target.value)}
              rows={4}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreateCampaign} disabled={loading || !newName.trim() || !newSubject.trim()}>
              Opret kampagne
            </Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>
              Annuller
            </Button>
          </div>
        </Card>
      )}

      {/* Campaign list */}
      {gmailConnected && (
        <Card className="p-5 bg-card/70 border-border space-y-3">
          <div className="text-sm font-semibold">Kampagner</div>

          {campaigns.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Ingen kampagner endnu. Opret din første kampagne.
            </div>
          ) : (
            <div className="space-y-2">
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="rounded-lg border border-border p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{campaign.name}</span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${statusColors[campaign.status] || ''}`}
                        >
                          {statusLabel[campaign.status] || campaign.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{campaign.subject}</div>
                    </div>
                    <div className="flex gap-2">
                      {campaign.status === 'draft' && (
                        <Button
                          size="sm"
                          onClick={() => handleSendCampaign(campaign.id)}
                          disabled={loading}
                        >
                          <Send className="h-3 w-3 mr-1" />
                          Send
                        </Button>
                      )}
                      {campaign.status === 'sending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePauseCampaign(campaign.id)}
                          disabled={loading}
                        >
                          Pause
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setSelectedCampaign(selectedCampaign?.id === campaign.id ? null : campaign)
                        }
                      >
                        <BarChart2 className="h-3 w-3 mr-1" />
                        Stats
                      </Button>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div>
                      <div className="text-sm font-medium">{campaign.recipientCount}</div>
                      <div className="text-xs text-muted-foreground">Modtagere</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium">{campaign.sentCount}</div>
                      <div className="text-xs text-muted-foreground">Sendt</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium">
                        {campaign.sentCount > 0
                          ? `${((campaign.openCount / campaign.sentCount) * 100).toFixed(0)}%`
                          : '—'}
                      </div>
                      <div className="text-xs text-muted-foreground">Åbnet</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium">
                        {campaign.sentCount > 0
                          ? `${((campaign.replyCount / campaign.sentCount) * 100).toFixed(0)}%`
                          : '—'}
                      </div>
                      <div className="text-xs text-muted-foreground">Besvaret</div>
                    </div>
                  </div>

                  {campaign.sentAt && (
                    <div className="text-xs text-muted-foreground">
                      Sendt: {new Date(campaign.sentAt).toLocaleString('da-DK')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Info box */}
      <Card className="p-5 bg-card/70 border-border">
        <div className="text-sm font-semibold mb-2">Sådan fungerer det</div>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>→ Hver medarbejder forbinder sin <strong>egen Gmail-konto</strong></li>
          <li>→ Mails sendes fra din personlige Gmail — ikke en fælles konto</li>
          <li>→ Systemet tracker hvornår modtagere åbner og svarer på mails</li>
          <li>→ AI-systemet analyserer svar og foreslår automatisk opgaver</li>
          <li>→ Brug til outreach, mødebooking, opfølgning og kolde kampagner</li>
        </ul>
      </Card>
    </div>
  );
}
