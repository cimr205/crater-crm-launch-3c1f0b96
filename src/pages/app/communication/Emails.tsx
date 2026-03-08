import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, type GmailMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { isConfigured, getServiceConfig } from '@/lib/serviceConfig';
import * as ee from '@/lib/emailengine';
import { Mail, Send, RefreshCw, Unlink, CheckCircle, PenSquare, Settings } from 'lucide-react';

// ─── Sent message row shape ────────────────────────────────────────────────────

interface SentMessage {
  id: string;
  to: string;
  subject: string;
  snippet: string;
  date: string;
}

function fromGmail(msg: GmailMessage): SentMessage {
  return { id: msg.id, to: msg.to ?? '', subject: msg.subject ?? '', snippet: msg.snippet ?? '', date: msg.date };
}

function fromEE(msg: ee.EEMessage): SentMessage {
  const toArr = msg.to ?? [];
  return {
    id: msg.id,
    to: toArr.map((t) => t.address).join(', '),
    subject: msg.subject ?? '',
    snippet: msg.preview ?? msg.text?.plain?.slice(0, 100) ?? '',
    date: msg.date,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const diff = Date.now() - d.getTime();
    if (diff < 86_400_000) return d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
  } catch { return dateStr; }
}

// ─── Compose dialog ────────────────────────────────────────────────────────────

function ComposeDialog({
  onClose, onSent,
  useEE, eeAccountId,
}: {
  onClose: () => void;
  onSent: () => void;
  useEE: boolean;
  eeAccountId: string;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showCc, setShowCc] = useState(false);

  const handleSend = async () => {
    const toArr = to.split(',').map((s) => s.trim()).filter(Boolean);
    if (!toArr.length) { toast({ title: 'Modtager mangler', variant: 'destructive' }); return; }
    if (!subject.trim()) { toast({ title: 'Emne mangler', variant: 'destructive' }); return; }
    if (!body.trim()) { toast({ title: 'Besked mangler', variant: 'destructive' }); return; }
    setLoading(true);
    try {
      const ccArr = cc.split(',').map((s) => s.trim()).filter(Boolean);
      if (useEE) {
        await ee.sendMessage(eeAccountId, { to: toArr, subject, text: body, cc: ccArr.length ? ccArr : undefined });
      } else {
        await api.sendGmailMessage({ to: toArr, subject, body, cc: ccArr.length ? ccArr : undefined });
      }
      toast({ title: 'Email sendt' });
      onSent();
      onClose();
    } catch (err) {
      toast({ title: (err as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Ny email</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input placeholder="Til (adskil med komma)" value={to} onChange={(e) => setTo(e.target.value)} className="flex-1" />
            <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowCc((v) => !v)}>CC</button>
          </div>
          {showCc && <Input placeholder="CC (adskil med komma)" value={cc} onChange={(e) => setCc(e.target.value)} />}
          <Input placeholder="Emne" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <textarea
            className="w-full min-h-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Skriv din besked her..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>Annuller</Button>
            <Button onClick={() => void handleSend()} disabled={loading}>
              <Send className="h-4 w-4 mr-2" />{loading ? 'Sender...' : 'Send'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EmailsPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const useEE = isConfigured('emailengine');
  const eeAccountId = useEE ? (getServiceConfig('emailengine')?.accountId ?? '') : '';

  const [connected, setConnected] = useState<boolean | null>(null);
  const [accountLabel, setAccountLabel] = useState('');
  const [sentMessages, setSentMessages] = useState<SentMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  useEffect(() => {
    if (useEE) {
      if (eeAccountId) {
        setConnected(true);
        setAccountLabel(eeAccountId);
        void fetchSent();
      } else {
        setConnected(false);
      }
      return;
    }
    const gmailParam = searchParams.get('gmail');
    const reason = searchParams.get('reason');
    if (gmailParam === 'connected') {
      toast({ title: 'Gmail forbundet' });
      setSearchParams({});
      void checkGmailStatus();
    } else if (gmailParam === 'error') {
      toast({ title: `Gmail fejl: ${reason ?? 'ukendt fejl'}`, variant: 'destructive' });
      setSearchParams({});
    } else {
      void checkGmailStatus();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const checkGmailStatus = async () => {
    try {
      const status = await api.getGmailStatus();
      setConnected(status.connected);
      if (status.gmail_email) setAccountLabel(status.gmail_email);
      if (status.connected) void fetchSent();
    } catch { setConnected(false); }
  };

  const fetchSent = async () => {
    setLoading(true);
    try {
      if (useEE && eeAccountId) {
        const msgs = await ee.listMessages(eeAccountId, '[Gmail]/Sent Mail');
        setSentMessages(msgs.map(fromEE));
      } else {
        const msgs = await api.getGmailMessages('SENT');
        setSentMessages(msgs.map(fromGmail));
      }
    } catch (err) {
      toast({ title: (err as Error).message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const handleConnectGmail = async () => {
    setConnecting(true);
    try {
      const { auth_url } = await api.getGmailAuthUrl();
      window.location.href = auth_url;
    } catch (err) {
      toast({ title: (err as Error).message, variant: 'destructive' });
      setConnecting(false);
    }
  };

  const handleDisconnectGmail = async () => {
    if (!confirm('Er du sikker på at du vil frakoble Gmail?')) return;
    try {
      await api.disconnectGmail();
      setConnected(false);
      setAccountLabel('');
      setSentMessages([]);
      toast({ title: 'Gmail frakoblet' });
    } catch (err) {
      toast({ title: (err as Error).message, variant: 'destructive' });
    }
  };

  // ── Not connected ─────────────────────────────────────────────────────────────

  if (connected === false) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-semibold">Emails</h1><p className="text-sm text-muted-foreground">Send og se emails</p></div>
        <div className="rounded-2xl border bg-card p-10 flex flex-col items-center gap-5 text-center max-w-md mx-auto">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <Mail className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-1">Forbind din email for at sende</h3>
            <p className="text-sm text-muted-foreground">
              {useEE ? 'EmailEngine er konfigureret men mangler et account ID.' : 'Brug EmailEngine (self-hosted) eller forbind din Gmail via OAuth.'}
            </p>
          </div>
          {useEE ? (
            <Button onClick={() => navigate('/app/integrations')} variant="outline">
              <Settings className="h-4 w-4 mr-2" />Indstil account ID
            </Button>
          ) : (
            <div className="flex flex-col gap-2 w-full">
              <Button onClick={() => navigate('/app/integrations')} variant="outline">
                <Settings className="h-4 w-4 mr-2" />Konfigurér EmailEngine (anbefalet)
              </Button>
              <Button onClick={() => void handleConnectGmail()} disabled={connecting}>
                {connecting ? 'Forbinder...' : 'Forbind Gmail'}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (connected === null) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />Forbinder...
      </div>
    );
  }

  // ── Connected ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Emails</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
            <p className="text-sm text-muted-foreground">{accountLabel}</p>
            {useEE && <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full">EmailEngine</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void fetchSent()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />Opdater
          </Button>
          <Button onClick={() => setComposeOpen(true)}>
            <PenSquare className="h-4 w-4 mr-2" />Ny email
          </Button>
        </div>
      </div>

      {/* Account bar */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2.5 text-sm">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">{useEE ? 'EmailEngine konto' : 'Forbundet som'}</span>
          <span className="font-medium">{accountLabel}</span>
        </div>
        {!useEE && (
          <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors" onClick={() => void handleDisconnectGmail()}>
            <Unlink className="h-3.5 w-3.5" />Frakobl
          </button>
        )}
      </div>

      {/* Sent emails */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <p className="text-sm font-medium">Sendt</p>
        </div>
        {loading && sentMessages.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />Henter sendte emails...
          </div>
        ) : sentMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
            <Send className="h-8 w-8 opacity-40" />
            <p className="text-sm">Ingen sendte emails</p>
            <Button size="sm" variant="outline" onClick={() => setComposeOpen(true)}>
              <PenSquare className="h-3.5 w-3.5 mr-1" />Skriv email
            </Button>
          </div>
        ) : (
          <div className="divide-y">
            {sentMessages.map((msg) => (
              <div key={msg.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                <Send className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium truncate">Til: {msg.to}</span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{msg.subject}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{msg.snippet}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{formatDate(msg.date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {composeOpen && (
        <ComposeDialog
          onClose={() => setComposeOpen(false)}
          onSent={() => void fetchSent()}
          useEE={useEE}
          eeAccountId={eeAccountId}
        />
      )}
    </div>
  );
}
