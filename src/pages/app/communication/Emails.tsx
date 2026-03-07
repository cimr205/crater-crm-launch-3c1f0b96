import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, type GmailMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Mail, Send, RefreshCw, Unlink, CheckCircle, AlertCircle, PenSquare, X } from 'lucide-react';

// ─── Compose dialog ────────────────────────────────────────────────────────────

function ComposeDialog({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showCc, setShowCc] = useState(false);

  const handleSend = async () => {
    const toArr = to.split(',').map(s => s.trim()).filter(Boolean);
    if (!toArr.length) { toast({ title: 'Modtager mangler', variant: 'destructive' }); return; }
    if (!subject.trim()) { toast({ title: 'Emne mangler', variant: 'destructive' }); return; }
    if (!body.trim()) { toast({ title: 'Besked mangler', variant: 'destructive' }); return; }
    setLoading(true);
    try {
      const ccArr = cc.split(',').map(s => s.trim()).filter(Boolean);
      await api.sendGmailMessage({ to: toArr, subject, body, cc: ccArr.length ? ccArr : undefined });
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
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Ny email</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input placeholder="Til (adskil med komma)" value={to} onChange={e => setTo(e.target.value)} className="flex-1" />
            <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowCc(v => !v)}>CC</button>
          </div>
          {showCc && <Input placeholder="CC (adskil med komma)" value={cc} onChange={e => setCc(e.target.value)} />}
          <Input placeholder="Emne" value={subject} onChange={e => setSubject(e.target.value)} />
          <textarea
            className="w-full min-h-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Skriv din besked her..."
            value={body}
            onChange={e => setBody(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>Annuller</Button>
            <Button onClick={handleSend} disabled={loading}>
              <Send className="h-4 w-4 mr-2" />{loading ? 'Sender...' : 'Send'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sent email row ────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86_400_000) return d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
  } catch { return dateStr; }
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EmailsPage() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [connected, setConnected] = useState<boolean | null>(null);
  const [gmailEmail, setGmailEmail] = useState('');
  const [sentMessages, setSentMessages] = useState<GmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  // Handle callback from Gmail OAuth
  useEffect(() => {
    const gmailParam = searchParams.get('gmail');
    const reason = searchParams.get('reason');
    if (gmailParam === 'connected') {
      toast({ title: 'Gmail forbundet' });
      setSearchParams({});
      void checkStatus();
    } else if (gmailParam === 'error') {
      toast({ title: `Gmail fejl: ${reason || 'ukendt fejl'}`, variant: 'destructive' });
      setSearchParams({});
    } else {
      void checkStatus();
    }
  }, []);

  const checkStatus = async () => {
    try {
      const status = await api.getGmailStatus();
      setConnected(status.connected);
      if (status.gmail_email) setGmailEmail(status.gmail_email);
      if (status.connected) void fetchSent();
    } catch {
      setConnected(false);
    }
  };

  const fetchSent = async () => {
    setLoading(true);
    try {
      const msgs = await api.getGmailMessages('SENT');
      setSentMessages(msgs);
    } catch (err) {
      toast({ title: (err as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { auth_url } = await api.getGmailAuthUrl();
      window.location.href = auth_url;
    } catch (err) {
      toast({ title: (err as Error).message, variant: 'destructive' });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Er du sikker på at du vil frakoble Gmail?')) return;
    try {
      await api.disconnectGmail();
      setConnected(false);
      setGmailEmail('');
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
        <div>
          <h1 className="text-2xl font-semibold">Emails</h1>
          <p className="text-sm text-muted-foreground">Send emails via Gmail</p>
        </div>

        <div className="rounded-2xl border bg-card p-10 flex flex-col items-center justify-center gap-5 text-center max-w-md mx-auto">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <Mail className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-1">Forbind Gmail for at sende emails</h3>
            <p className="text-sm text-muted-foreground">
              Tilslut din Gmail-konto for at sende emails direkte fra CRM'et.
              Alle sendte emails vises her.
            </p>
          </div>
          <Button onClick={handleConnect} disabled={connecting} className="w-full">
            {connecting ? 'Forbinder...' : 'Forbind Gmail'}
          </Button>
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
            <p className="text-sm text-muted-foreground">{gmailEmail}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={fetchSent} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />Opdater
          </Button>
          <Button onClick={() => setComposeOpen(true)}>
            <PenSquare className="h-4 w-4 mr-2" />Ny email
          </Button>
        </div>
      </div>

      {/* Gmail status bar */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2.5 text-sm">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Forbundet som</span>
          <span className="font-medium">{gmailEmail}</span>
        </div>
        <button
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
          onClick={handleDisconnect}
        >
          <Unlink className="h-3.5 w-3.5" />Frakobl
        </button>
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
            {sentMessages.map(msg => (
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

      {composeOpen && <ComposeDialog onClose={() => setComposeOpen(false)} onSent={fetchSent} />}
    </div>
  );
}
