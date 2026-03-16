import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Device, type Call } from '@twilio/voice-sdk';
import { useI18n } from '@/lib/i18n';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import {
  Phone, PhoneOff, PhoneIncoming, PhoneMissed, Mic, MicOff,
  RefreshCw, Info, X, Volume2, VolumeX,
} from 'lucide-react';
import { useLeads } from '@/hooks/api/useLeads';

// ── Types ─────────────────────────────────────────────────────────────────────

type DeviceStatus = 'offline' | 'connecting' | 'ready' | 'busy' | 'error';

interface LogEntry {
  id: string;
  time: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'call';
}

// ── Constants ─────────────────────────────────────────────────────────────────

// In dev:  Vite proxy forwards /api/twilio/* → http://localhost:3001/*
// In prod: set VITE_TWILIO_SERVER_URL to your deployed twilio-server URL
const TWILIO_API = import.meta.env.VITE_TWILIO_SERVER_URL ?? '/api/twilio';

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<DeviceStatus, { dot: string; pulse: boolean }> = {
  offline:    { dot: 'bg-gray-400',   pulse: false },
  connecting: { dot: 'bg-yellow-400', pulse: true  },
  ready:      { dot: 'bg-green-500',  pulse: false },
  busy:       { dot: 'bg-blue-500',   pulse: true  },
  error:      { dot: 'bg-red-500',    pulse: false },
};

const STATUS_LABEL: Record<DeviceStatus, string> = {
  offline:    'Offline',
  connecting: 'Tilslutter...',
  ready:      'Klar',
  busy:       'I gang',
  error:      'Fejl — klik Genopret',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function SoftphonePage() {
  const { t } = useI18n();
  const { toast } = useToast();

  // ── Device / call refs (mutable, must NOT cause re-renders) ───────────────
  const deviceRef     = useRef<Device | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [status,       setStatus]       = useState<DeviceStatus>('offline');
  const [phoneNumber,  setPhoneNumber]  = useState('');
  const [identity,     setIdentity]     = useState('');
  const [isInCall,     setIsInCall]     = useState(false);
  const [isRinging,    setIsRinging]    = useState(false);  // outbound ringing
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [isMuted,      setIsMuted]      = useState(false);
  const [isSpeaker,    setIsSpeaker]    = useState(false);
  const [duration,     setDuration]     = useState(0);
  const [callLog,      setCallLog]      = useState<LogEntry[]>([]);
  const [quickDial,    setQuickDial]    = useState('');

  // Load leads for quick-dial list
  const leadsQuery = useLeads({ status: 'cold' });
  type LeadRow = { id: string; name: string; phone: string; company?: string };
  const coldLeads: LeadRow[] = useMemo(() => {
    const raw = (leadsQuery.data as { data?: unknown[] } | undefined)?.data ?? [];
    return (raw as Record<string, unknown>[])
      .map(r => ({
        id:      String(r.id ?? ''),
        name:    String(r.name ?? ''),
        phone:   String(r.phone ?? ''),
        company: r.company != null ? String(r.company) : undefined,
      }))
      .filter(l => !!l.phone);
  }, [leadsQuery.data]);

  // ── Log helper ────────────────────────────────────────────────────────────
  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setCallLog(prev => [
      { id: `${Date.now()}-${Math.random()}`, time: new Date().toLocaleTimeString('da-DK'), message, type },
      ...prev,
    ].slice(0, 100));
  }, []);

  // ── Fetch token (multi-tenant) ────────────────────────────────────────────
  // Priority:
  //   1. Railway API /v1/phone/voice-token — uses company's own Twilio creds
  //   2. twilio-server /api/twilio/token   — JWT-aware fallback
  const fetchToken = useCallback(async (): Promise<{ token: string; identity: string }> => {
    // 1. Try Railway API (company-specific credentials)
    try {
      const data = await api.getTwilioVoiceToken();
      return { token: data.token, identity: data.identity };
    } catch {
      // endpoint not yet implemented on Railway API → fall through
    }

    // 2. Fall back to twilio-server with JWT so it can look up company creds
    const jwt = api.getToken();
    const headers: Record<string, string> = {};
    if (jwt) headers['Authorization'] = `Bearer ${jwt}`;

    const res = await fetch(`${TWILIO_API}/token`, { headers });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Token fetch failed (${res.status}): ${body}`);
    }
    return res.json() as Promise<{ token: string; identity: string }>;
  }, []);

  // ── Wire up call events ───────────────────────────────────────────────────
  const wireCall = useCallback((call: Call, direction: 'outgoing' | 'incoming') => {
    activeCallRef.current = call;

    // Outbound: we are ringing (waiting for answer); incoming: we already accepted
    setIsRinging(direction === 'outgoing');

    call.on('ringing', () => {
      setIsRinging(true);
      addLog('Ringer...', 'info');
    });

    call.on('accept', () => {
      setIsInCall(true);
      setIsRinging(false);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      const target = (call.parameters.To as string | undefined) ?? (call.parameters.From as string | undefined) ?? '?';
      addLog(`Opkald forbundet  ${target}`, 'success');
    });

    call.on('disconnect', () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setIsInCall(false);
      setIsRinging(false);
      setIncomingCall(null);
      setIsMuted(false);
      setDuration(0);
      activeCallRef.current = null;
      setStatus('ready');
      addLog('Opkald afsluttet', 'info');
    });

    call.on('cancel', () => {
      setIsInCall(false);
      setIsRinging(false);
      setIncomingCall(null);
      activeCallRef.current = null;
      setStatus('ready');
      addLog('Opkald annulleret', 'info');
    });

    call.on('reject', () => {
      setIsInCall(false);
      setIsRinging(false);
      setIncomingCall(null);
      activeCallRef.current = null;
      setStatus('ready');
      addLog('Opkald afvist', 'info');
    });

    call.on('error', (err: Error) => {
      setIsInCall(false);
      setIsRinging(false);
      addLog(`Opkaldsfejl: ${err.message}`, 'error');
      setStatus('ready');
      toast({ title: 'Opkaldsfejl', description: err.message, variant: 'destructive' });
    });

    call.on('mute', (muted: boolean) => {
      setIsMuted(muted);
      addLog(muted ? 'Mikrofon slået fra' : 'Mikrofon slået til', 'info');
    });
  }, [addLog, toast]);

  // ── Initialise / reconnect Device ─────────────────────────────────────────
  const initDevice = useCallback(async () => {
    setStatus('connecting');
    addLog('Forbinder til Twilio...', 'info');

    try {
      const { token, identity: id } = await fetchToken();
      setIdentity(id);

      // Destroy previous device cleanly
      if (deviceRef.current) {
        try { deviceRef.current.destroy(); } catch { /* ignore */ }
        deviceRef.current = null;
      }

      const device = new Device(token, {
        // @ts-expect-error SDK typings lag behind
        codecPreferences: ['opus', 'pcmu'],
        enableImprovedSignalingErrorPrecision: true,
        logLevel: import.meta.env.DEV ? 1 : 0,
      });

      device.on('registered', () => {
        setStatus('ready');
        addLog(`Device registreret  (${id})`, 'success');
      });

      device.on('unregistered', () => {
        setStatus('offline');
        addLog('Device afregistreret', 'info');
      });

      device.on('error', (err: { message: string; code?: number }) => {
        setStatus('error');
        addLog(`Device fejl [${err.code ?? '?'}]: ${err.message}`, 'error');
        console.error('[Softphone] Device error', err);
      });

      device.on('incoming', (call: Call) => {
        const from = (call.parameters.From as string | undefined) ?? 'Ukendt';
        addLog(`Indgående opkald fra: ${from}`, 'call');

        // Already in a call → reject automatically
        if (activeCallRef.current) {
          call.reject();
          addLog(`Indgående opkald afvist (allerede i samtale)`, 'info');
          return;
        }

        setStatus('busy');
        setIncomingCall(call);

        // If caller hangs up before we answer
        call.on('cancel', () => {
          setIncomingCall(null);
          setStatus('ready');
          addLog(`${from} lagde på inden besvarelse`, 'info');
        });
      });

      // Refresh token ~3 min before expiry (SDK fires this event)
      device.on('tokenWillExpire', async () => {
        addLog('Token udløber snart — fornyelse...', 'info');
        try {
          const { token: newToken } = await fetchToken();
          device.updateToken(newToken);
          addLog('Token fornyet', 'success');
        } catch (err) {
          addLog('Token fornyelse fejlede — genopret manuelt', 'error');
          console.error('[Softphone] Token refresh failed', err);
        }
      });

      await device.register();
      deviceRef.current = device;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus('error');
      addLog(`Initialisering fejlede: ${msg}`, 'error');
      toast({ title: 'Kunne ikke tilslutte softphone', description: msg, variant: 'destructive' });
    }
  }, [fetchToken, addLog, toast]);

  // ── Outbound call ─────────────────────────────────────────────────────────
  const makeCall = useCallback(async (target?: string) => {
    const to = (target ?? phoneNumber).trim();

    if (!deviceRef.current || status !== 'ready') {
      toast({ title: 'Device ikke klar', variant: 'destructive' }); return;
    }
    if (!to) {
      toast({ title: 'Indtast et telefonnummer', variant: 'destructive' }); return;
    }
    if (!isValidPhoneOrClient(to)) {
      toast({
        title: 'Ugyldigt nummer',
        description: 'Brug internationalt format: +4512345678',
        variant: 'destructive',
      });
      return;
    }

    addLog(`Ringer op: ${to}`, 'call');
    setStatus('busy');

    try {
      const call = await deviceRef.current.connect({ params: { To: to } });
      wireCall(call, 'outgoing');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`Opkald fejlede: ${msg}`, 'error');
      setStatus('ready');
      toast({ title: 'Opkald fejlede', description: msg, variant: 'destructive' });
    }
  }, [status, phoneNumber, addLog, wireCall, toast]);

  // ── Hang up ───────────────────────────────────────────────────────────────
  const hangup = useCallback(() => {
    if (activeCallRef.current) {
      activeCallRef.current.disconnect();
    } else if (incomingCall) {
      incomingCall.reject();
      setIncomingCall(null);
      setStatus('ready');
    }
  }, [incomingCall]);

  // ── Accept incoming ───────────────────────────────────────────────────────
  const acceptIncoming = useCallback(() => {
    if (!incomingCall) return;
    incomingCall.accept();
    wireCall(incomingCall, 'incoming');
    setIncomingCall(null);
    addLog('Indgående opkald besvaret', 'success');
  }, [incomingCall, wireCall, addLog]);

  // ── Reject incoming ───────────────────────────────────────────────────────
  const rejectIncoming = useCallback(() => {
    if (!incomingCall) return;
    incomingCall.reject();
    setIncomingCall(null);
    setStatus('ready');
    addLog('Indgående opkald afvist', 'info');
  }, [incomingCall, addLog]);

  // ── Mute toggle ───────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    if (!activeCallRef.current) return;
    activeCallRef.current.mute(!isMuted);
  }, [isMuted]);

  // ── Mount: init device; unmount: clean up ─────────────────────────────────
  useEffect(() => {
    void initDevice();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (deviceRef.current) {
        try { deviceRef.current.destroy(); } catch { /* ignore */ }
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ───────────────────────────────────────────────────────────────
  const fmtDuration = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const sc = STATUS_CONFIG[status];

  const busyLabel =
    isInCall    ? `I samtale  ${fmtDuration(duration)}` :
    isRinging   ? 'Ringer...' :
    incomingCall ? 'Indgående...' :
    STATUS_LABEL[status];

  const statusLabel = status === 'busy' ? busyLabel : STATUS_LABEL[status];

  const canCall = status === 'ready' && !isInCall && !isRinging && !incomingCall;

  // Filter quick-dial by search
  const filteredLeads = coldLeads.filter(l =>
    !quickDial ||
    l.name.toLowerCase().includes(quickDial.toLowerCase()) ||
    l.phone.includes(quickDial) ||
    (l.company ?? '').toLowerCase().includes(quickDial.toLowerCase()),
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-3xl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Phone className="h-6 w-6 text-green-600" />
          Softphone
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Browser-baseret opkald via Twilio Voice SDK
        </p>
      </div>

      {/* ── Status bar ─────────────────────────────────────────────────────── */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full shrink-0 ${sc.dot} ${sc.pulse ? 'animate-pulse' : ''}`} />
            <div>
              <p className="text-sm font-semibold">{statusLabel}</p>
              {identity && (
                <p className="text-xs text-muted-foreground">
                  Identitet: <span className="font-mono">{identity}</span>
                </p>
              )}
            </div>
            {(isInCall || isRinging) && (
              <Badge className="bg-blue-500 text-white tabular-nums">
                {isInCall ? fmtDuration(duration) : 'Ringer...'}
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={initDevice}
            disabled={status === 'connecting' || isInCall}
            className="gap-1.5 shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${status === 'connecting' ? 'animate-spin' : ''}`} />
            Genopret
          </Button>
        </div>
      </Card>

      {/* ── Incoming call alert ─────────────────────────────────────────────── */}
      {incomingCall && (
        <Card className="p-4 border-2 border-green-500 bg-green-50 dark:bg-green-950/20">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center animate-pulse">
                <PhoneIncoming className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-green-700 dark:text-green-300">
                  Indgående opkald
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  {(incomingCall.parameters.From as string | undefined) ?? 'Ukendt nummer'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1.5" onClick={acceptIncoming}>
                <Phone className="h-3.5 w-3.5" />
                Besvar
              </Button>
              <Button size="sm" variant="destructive" onClick={rejectIncoming} className="gap-1.5">
                <PhoneOff className="h-3.5 w-3.5" />
                Afvis
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ── Main grid: dialler + quick-dial ────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* ── Dialler ──────────────────────────────────────────────────────── */}
        <Card className="p-5 space-y-4">
          <div className="text-sm font-semibold">Ring op</div>

          <div className="flex gap-2">
            <Input
              placeholder="+4512345678"
              value={phoneNumber}
              onChange={e => setPhoneNumber(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canCall) void makeCall(); }}
              disabled={isInCall || isRinging}
              className="font-mono text-base tracking-wide"
              autoComplete="tel"
            />
            {!isInCall && !isRinging ? (
              <Button
                onClick={() => void makeCall()}
                disabled={!canCall || !phoneNumber.trim()}
                className="bg-green-600 hover:bg-green-700 gap-1.5 shrink-0"
              >
                <Phone className="h-4 w-4" />
                Ring
              </Button>
            ) : (
              <Button
                onClick={hangup}
                variant="destructive"
                className="gap-1.5 shrink-0"
              >
                <PhoneOff className="h-4 w-4" />
                Læg på
              </Button>
            )}
          </div>

          {/* In-call controls */}
          {isInCall && (
            <div className="flex items-center gap-2 pt-2 border-t flex-wrap">
              <Button
                variant={isMuted ? 'destructive' : 'outline'}
                size="sm"
                onClick={toggleMute}
                className="gap-1.5"
              >
                {isMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                {isMuted ? 'Lyd fra' : 'Mikrofon til'}
              </Button>
              <Button
                variant={isSpeaker ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setIsSpeaker(s => !s)}
                className="gap-1.5"
              >
                {isSpeaker ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                Højttaler
              </Button>
              <span className="text-xs text-muted-foreground ml-auto">
                Varighed: <span className="font-mono font-semibold">{fmtDuration(duration)}</span>
              </span>
            </div>
          )}

          {/* Format hint */}
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Brug internationalt format:{' '}
              <span className="font-mono">+45 12 34 56 78</span> (DK) ·{' '}
              <span className="font-mono">+1 555 123 4567</span> (US)
            </span>
          </div>
        </Card>

        {/* ── Quick-dial from cold leads ────────────────────────────────────── */}
        <Card className="p-5 space-y-3">
          <div className="text-sm font-semibold">Hurtig-opkald — kolde leads</div>
          <Input
            placeholder="Søg navn, firma eller nummer..."
            value={quickDial}
            onChange={e => setQuickDial(e.target.value)}
            className="h-8 text-sm"
          />
          <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
            {filteredLeads.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                {leadsQuery.isLoading ? 'Indlæser...' : 'Ingen kolde leads med telefonnummer'}
              </p>
            ) : (
              filteredLeads.slice(0, 20).map(lead => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-background/50 px-3 py-2 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0 mr-2">
                    <p className="text-xs font-medium truncate">{lead.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{lead.phone}</p>
                  </div>
                  <Button
                    size="sm"
                    disabled={!canCall}
                    onClick={() => {
                      setPhoneNumber(lead.phone);
                      void makeCall(lead.phone);
                    }}
                    className="h-7 px-2 bg-green-600 hover:bg-green-700 shrink-0"
                  >
                    <Phone className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* ── Event log ──────────────────────────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold">Opkaldslog</div>
          <div className="flex items-center gap-2">
            {callLog.length > 0 && (
              <button
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                onClick={() => setCallLog([])}
              >
                <X className="h-3 w-3" />
                Ryd
              </button>
            )}
          </div>
        </div>

        {callLog.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <PhoneMissed className="h-4 w-4" />
            Ingen events endnu. Foretag eller modtag et opkald for at se logs her.
          </div>
        ) : (
          <div className="space-y-1 max-h-56 overflow-y-auto font-mono text-xs">
            {callLog.map(entry => (
              <div key={entry.id} className="flex items-start gap-2">
                <span className="text-muted-foreground shrink-0 w-16">{entry.time}</span>
                <span className={
                  entry.type === 'error'   ? 'text-red-600 dark:text-red-400' :
                  entry.type === 'success' ? 'text-green-600 dark:text-green-400' :
                  entry.type === 'call'    ? 'text-blue-600 dark:text-blue-400 font-semibold' :
                  'text-foreground'
                }>
                  {entry.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Setup warning ──────────────────────────────────────────────────── */}
      {status === 'error' && (
        <Card className="p-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-2">
            ⚠️ Opsætning påkrævet
          </p>
          <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1 list-disc list-inside">
            <li>Kør Twilio-serveren: <span className="font-mono">cd twilio-server && npm run dev</span></li>
            <li>Kontrollér at alle <span className="font-mono">TWILIO_*</span> variabler er udfyldt i <span className="font-mono">.env</span></li>
            <li>Tjek <span className="font-mono">TWILIO_TWIML_APP_SID</span> og <span className="font-mono">TWILIO_API_KEY</span></li>
            <li>Tillad mikrofon-adgang i browseren</li>
            <li>ngrok skal køre og Webhook-URL'en skal være opdateret i Twilio Console</li>
          </ul>
        </Card>
      )}
    </div>
  );
}

// ── Validators ────────────────────────────────────────────────────────────────

function isValidPhoneOrClient(value: string): boolean {
  if (/^\+[1-9]\d{7,14}$/.test(value)) return true;          // E.164
  if (/^client:[a-zA-Z0-9_-]+$/.test(value)) return true;    // Twilio client identity
  return false;
}
